/* ============================================
 *  WATER ANGEL - ESP32 Firmware (v4 - Dual Core)
 *  ─────────────────────────────────────────────
 *  Core 1 : Sensor / Control (time-critical)
 *           → ultrasonic, TDS, pump, LCD, beep, button
 *           → NEVER blocked by network
 *
 *  Core 0 : Cloud / Network
 *           → fetchDeviceInfo, fetchPumpSettings
 *           → sendSensorData, WiFi management
 *           → can block for up to 10s without
 *             affecting pump or sensor logic
 *
 *  All existing logic preserved. Only the
 *  execution model (single-loop → dual-task)
 *  has changed.
 * ============================================ */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// FreeRTOS — included by ESP32 Arduino core automatically,
// but explicit includes make intent clear
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

// ============ PINS ============
#define TRIG_PIN     26
#define ECHO_PIN     27
#define TDS_PIN      34
#define RELAY_PIN    15
#define BUZZER_PIN   23
#define LED_GREEN    19
#define LED_RED      18
#define SETUP_BUTTON 33

// ============ SUPABASE ============
const char* SUPABASE_URL       = "https://pucmngrhhrzybuucrhuk.supabase.co";
const char* SUPABASE_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Y21uZ3JoaHJ6eWJ1dWNyaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI0NjUsImV4cCI6MjA4ODUxODQ2NX0.sYgEcuUNfgoBCWocgNYED0L_IkOE7vV-dE9GpWElIdQ";
const char* DEVICE_SYSTEM_KEY  = "DEVICE-BETA-002";

// ============ EEPROM ============
#define EEPROM_SIZE      256
#define SSID_ADDR        0
#define PASS_ADDR        64
#define MAGIC_ADDR       192
#define TANK_HEIGHT_ADDR 196
#define UPPER_ADDR       200
#define LOWER_ADDR       204
#define CRIT_ADDR        208
#define CALIB_FLAG_ADDR  212
#define MAGIC_VALUE      0xAB

#define TDS_CRITICAL 600.0

// ============ OBJECTS ============
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer setupServer(80);

// ============ ENUMS ============
enum DeviceMode { MODE_NORMAL, MODE_SETUP };
enum WiFiState  { WIFI_IDLE, WIFI_CONNECTING, WIFI_CONNECTED, WIFI_FAILED };

// ============ SHARED GLOBALS (protected by sharedMutex) ============
// These are read by sensorTask AND written by cloudTask.
// Always take sharedMutex before accessing them.
volatile float   upperThreshold    = 90;
volatile float   lowerThreshold    = 35;
volatile float   criticalThreshold = 25;
volatile float   tankHeight        = 0;
volatile bool    calibrated        = false;
volatile bool    wifiOnline        = false;
volatile bool    cloudCalibrationMode = false;
String           pumpMode          = "AUTO";  // "AUTO" | "MANUAL"
String           deviceId          = "";
String           tankHeightUnit    = "inches";

// ============ SENSOR-TASK-ONLY GLOBALS ============
// Written and read only from sensorTask — no mutex needed.
bool    pumpOn          = false;
float   lastValidLevel  = 50;
float   lastDistanceIn  = 0;
unsigned long pumpOnStart          = 0;
unsigned long long totalRuntimeMs  = 0;
// unsigned long accumulatedRuntimeMs = 0;
unsigned long buttonPressStart     = 0;
bool          buttonHeld           = false;
unsigned long lastDisplay_s        = 0;   // _s = sensorTask local timing
unsigned long lastSensorRead_s     = 0;

// ============ CLOUD-TASK-ONLY GLOBALS ============
// Written and read only from cloudTask — no mutex needed.
unsigned long lastDataSync_c     = 0;   // _c = cloudTask local timing
unsigned long lastSettingsPoll_c = 0;
unsigned long lastWifiRetry_c    = 0;
WiFiState     wifiState          = WIFI_IDLE;
unsigned long wifiConnectStart   = 0;
bool          httpInProgress     = false;

// ============ DEVICE MODE (set in setup, read in both tasks) ============
DeviceMode currentMode = MODE_NORMAL;

// ============ TIMING CONSTANTS ============
const unsigned long DATA_SYNC_MS     = 30000;
const unsigned long SETTINGS_POLL_MS = 5000;
const unsigned long DISPLAY_MS       = 1000;
const unsigned long SENSOR_MS        = 500;
const unsigned long WIFI_RETRY_MS    = 30000;

// ============ FreeRTOS PRIMITIVES ============
SemaphoreHandle_t sharedMutex;   // protects shared globals above
QueueHandle_t     toCloudQueue;  // sensorTask → cloudTask  (SensorSnapshot)
QueueHandle_t     toSensorQueue; // cloudTask  → sensorTask (CloudSettings)

// ─── Queue payload types ────────────────────────────────────────────
// Use plain char[] not String — safe to copy between tasks/cores.

struct SensorSnapshot {
  float level;
  float tds;
  bool  pumpOn;
  char  pumpMode[8];   // "AUTO\0" or "MANUAL\0"
  float runtimeMin;    // ← ADD THIS LINE
};

struct CloudSettings {
  float upper;
  float lower;
  float critical;
  float tankHt;
  char  tankHtUnit[16];
  char  pumpMode[8];
  char  devId[64];
  bool  calibMode;
  bool  hasManualCmd;
  bool  pumpOnManual;
  bool  newCalib;     // true → save to EEPROM after applying
};

// ============ NON-BLOCKING BEEP ============
bool          beepActive    = false;
int           beepRemaining = 0;
unsigned long beepNextChange = 0;
bool          beepSoundOn   = false;

void beep(int times, int dur = 120) {
  if (times <= 0) return;
  beepActive    = true;
  beepRemaining = times;
  beepNextChange = millis();
  beepSoundOn   = true;
  tone(BUZZER_PIN, 2000);
}

void beepUpdate() {
  if (!beepActive) return;
  unsigned long now = millis();
  if (now >= beepNextChange) {
    if (beepSoundOn) {
      noTone(BUZZER_PIN); digitalWrite(BUZZER_PIN, LOW);
      beepSoundOn    = false;
      beepNextChange = now + 80;
    } else {
      beepRemaining--;
      if (beepRemaining == 0) {
        beepActive = false;
        noTone(BUZZER_PIN); digitalWrite(BUZZER_PIN, LOW);
        return;
      }
      tone(BUZZER_PIN, 2000);
      beepSoundOn    = true;
      beepNextChange = now + 120;
    }
  }
}

// ============ BUZZER ============
void buzzerInit() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}
void buzzOn(int freq) { tone(BUZZER_PIN, freq); }
void buzzOff()        { noTone(BUZZER_PIN); digitalWrite(BUZZER_PIN, LOW); }

void criticalAlarm() {
  static unsigned long t  = 0;
  static bool          on = false;
  if (millis() - t > 400) {
    t  = millis();
    on = !on;
    if (on) buzzOn(2500); else buzzOff();
  }
}

// ============ EEPROM ============
void  eepromWriteFloat(int a, float v) {
  byte* p = (byte*)&v;
  for (int i = 0; i < 4; i++) EEPROM.write(a + i, p[i]);
}
float eepromReadFloat(int a) {
  float v; byte* p = (byte*)&v;
  for (int i = 0; i < 4; i++) p[i] = EEPROM.read(a + i);
  return v;
}

void saveCalibration() {
  // Called from sensorTask only (after applying CloudSettings).
  EEPROM.begin(EEPROM_SIZE);
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    eepromWriteFloat(TANK_HEIGHT_ADDR, tankHeight);
    eepromWriteFloat(UPPER_ADDR,       upperThreshold);
    eepromWriteFloat(LOWER_ADDR,       lowerThreshold);
    eepromWriteFloat(CRIT_ADDR,        criticalThreshold);
    EEPROM.write(CALIB_FLAG_ADDR, calibrated ? 1 : 0);
  xSemaphoreGive(sharedMutex);
  EEPROM.commit();
  EEPROM.end();
}

void loadCalibration() {
  // Called from setup() before tasks start — no mutex needed yet.
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(CALIB_FLAG_ADDR) == 1) {
    tankHeight        = eepromReadFloat(TANK_HEIGHT_ADDR);
    upperThreshold    = eepromReadFloat(UPPER_ADDR);
    lowerThreshold    = eepromReadFloat(LOWER_ADDR);
    criticalThreshold = eepromReadFloat(CRIT_ADDR);
    if (tankHeight > 0 && tankHeight < 500)   calibrated = true;
    if (upperThreshold    <= 0 || upperThreshold    > 100) upperThreshold    = 90;
    if (lowerThreshold    <= 0 || lowerThreshold    > 100) lowerThreshold    = 35;
    if (criticalThreshold <= 0 || criticalThreshold > 100) criticalThreshold = 25;
  }
  EEPROM.end();
}

void saveWifi(String ssid, String pass) {
  EEPROM.begin(EEPROM_SIZE);
  for (int i = 0; i < 64; i++) EEPROM.write(SSID_ADDR + i, 0);
  for (int i = 0; i < 64; i++) EEPROM.write(PASS_ADDR + i, 0);
  for (size_t i = 0; i < ssid.length() && i < 63; i++) EEPROM.write(SSID_ADDR + i, ssid[i]);
  for (size_t i = 0; i < pass.length() && i < 63; i++) EEPROM.write(PASS_ADDR + i, pass[i]);
  EEPROM.write(MAGIC_ADDR, MAGIC_VALUE);
  EEPROM.commit(); EEPROM.end();
}

bool loadWifi(String& ssid, String& pass) {
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(MAGIC_ADDR) != MAGIC_VALUE) { EEPROM.end(); return false; }
  char buf[65];
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(SSID_ADDR + i); buf[64] = 0; ssid = String(buf);
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(PASS_ADDR + i); buf[64] = 0; pass = String(buf);
  EEPROM.end();
  return ssid.length() > 0;
}

void clearWifi() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.write(MAGIC_ADDR, 0);
  EEPROM.commit(); EEPROM.end();
}

// ============ SENSORS (sensorTask only) ============
float readDistanceInches() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long d = pulseIn(ECHO_PIN, HIGH, 30000);
  if (d == 0) return -1;
  float in = (d * 0.034 / 2.0) / 2.54;
  if (in < 0.5 || in > 120) return -1;
  return in;
}

float calcWaterLevel() {
  float d = readDistanceInches();
  if (d < 0) return lastValidLevel;
  lastDistanceIn = d;
  float th;
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    th = tankHeight;
  xSemaphoreGive(sharedMutex);
  if (th <= 0) return -1;
  float lvl = ((th - d) / th) * 100.0;
  lvl = constrain(lvl, 0, 100);
  lastValidLevel = lvl;
  return lvl;
}

float readTDS() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(TDS_PIN); delay(2); }
  float v   = (sum / 10.0) * 3.3 / 4095.0;
  float tds = (133.42 * v * v * v - 255.86 * v * v + 857.39 * v) * 0.5;
  return max(0.0f, tds);
}

// ============ PUMP (sensorTask only) ============
void setPump(bool on) {
  if (on == pumpOn) return;
  pumpOn = on;
  digitalWrite(RELAY_PIN, on ? LOW : HIGH);

  if (on) {
    pumpOnStart = millis();  // start timing the new session
  } else {
    // Accumulate the session that just ended into the total
    if (pumpOnStart) {
      totalRuntimeMs += (millis() - pumpOnStart);
      pumpOnStart = 0;
    }
  }
}

void controlPump(float lvl, float tds) {
  String pm;
  float  upper, lower, crit;
  float  th;
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    pm    = pumpMode;
    upper = upperThreshold;
    lower = lowerThreshold;
    crit  = criticalThreshold;
    th    = tankHeight;
  xSemaphoreGive(sharedMutex);

  if (pm == "AUTO" && th > 0 && lvl >= 0) {
    if      (lvl <= lower && !pumpOn) { setPump(true);  Serial.println("💧 Pump ON  (auto)"); }
    else if (lvl >= upper &&  pumpOn) { setPump(false); Serial.println("💧 Pump OFF (auto)"); }
  }

  bool critical = false;
  if (th > 0 && lvl >= 0 && lvl <= crit) critical = true;
  if (tds > TDS_CRITICAL)                critical = true;

  if (critical) { digitalWrite(LED_RED, HIGH); criticalAlarm(); }
  else          { digitalWrite(LED_RED, LOW);  buzzOff();       }

  digitalWrite(LED_GREEN, pumpOn ? HIGH : LOW);
}

// ============ HTTPS HELPERS (cloudTask only) ============
WiFiClientSecure secureClient;

static void prepareSecureClient() {
  secureClient.stop();
  secureClient.setInsecure();
  secureClient.setHandshakeTimeout(10);
  secureClient.setTimeout(10);
}

bool httpGetJson(const String& path, DynamicJsonDocument& doc) {
  if (!wifiOnline || httpInProgress) return false;
  httpInProgress = true;

  prepareSecureClient();
  HTTPClient http;
  http.setReuse(false);
  http.setTimeout(10000);
  http.setConnectTimeout(8000);

  String url     = String(SUPABASE_URL) + path;
  bool   success = false;

  if (http.begin(secureClient, url)) {
    http.addHeader("apikey",         SUPABASE_KEY);
    http.addHeader("Authorization",  String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Accept",         "application/json");
    http.addHeader("Connection",     "close");

    int code = http.GET();
    if (code == 200) {
      String body = http.getString();
      DeserializationError e = deserializeJson(doc, body);
      if (!e) success = true;
      else Serial.printf("JSON err: %s\n", e.c_str());
    } else {
      Serial.printf("GET %s → %d\n", path.c_str(), code);
    }
    http.end();
  } else {
    Serial.println("http.begin fail");
  }

  secureClient.stop();
  httpInProgress = false;
  return success;
}

bool httpPostJson(const String& path, const String& body) {
  if (!wifiOnline || httpInProgress) return false;
  httpInProgress = true;

  prepareSecureClient();
  HTTPClient http;
  http.setReuse(false);
  http.setTimeout(10000);
  http.setConnectTimeout(8000);

  bool success = false;
  if (http.begin(secureClient, String(SUPABASE_URL) + path)) {
    http.addHeader("apikey",        SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Content-Type",  "application/json");
    http.addHeader("Prefer",        "return=minimal");
    http.addHeader("Connection",    "close");

    int code = http.POST(body);
    if (code >= 200 && code < 300) success = true;
    else Serial.printf("POST %s → %d  %s\n", path.c_str(), code, http.getString().c_str());
    http.end();
  }

  secureClient.stop();
  httpInProgress = false;
  return success;
}

// ============ CLOUD FUNCTIONS (cloudTask only) ============
// These now fill a CloudSettings struct instead of directly writing
// globals. The struct is sent to sensorTask via toSensorQueue.
// HTTP can block here for up to 10s — sensor loop is unaffected.

bool fetchDeviceInfo(CloudSettings& out) {
  DynamicJsonDocument doc(1024);
  String path = "/rest/v1/devices?system_key=eq." + String(DEVICE_SYSTEM_KEY) +
                "&select=id,tank_height,tank_height_unit,calibration_mode,pending_command";
  if (!httpGetJson(path, doc)) return false;
  if (doc.size() == 0) { Serial.println("⚠ device row not found"); return false; }

  strncpy(out.devId, doc[0]["id"].as<String>().c_str(), 63);
  out.devId[63]   = '\0';
  out.calibMode   = doc[0]["calibration_mode"] | false;

  out.newCalib = false;
  if (!doc[0]["tank_height"].isNull()) {
    float h = doc[0]["tank_height"].as<float>();
    // Read current tankHeight under mutex for comparison
    float curH;
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
      curH = tankHeight;
    xSemaphoreGive(sharedMutex);

    if (h > 0 && fabs(h - curH) > 0.01) {
      out.tankHt   = h;
      strncpy(out.tankHtUnit,
              (doc[0]["tank_height_unit"] | "inches"), 15);
      out.tankHtUnit[15] = '\0';
      out.newCalib = true;
      Serial.printf("✓ tank height synced: %.2f %s\n", h, out.tankHtUnit);
    } else {
      out.tankHt = curH;  // no change
    }
  }
  return true;
}

bool fetchPumpSettings(CloudSettings& out) {
  if (strlen(out.devId) == 0) return false;

  DynamicJsonDocument doc(1024);
  String path = "/rest/v1/pump_settings?device_id=eq." +
                String(out.devId) + "&select=*";
  if (!httpGetJson(path, doc)) return false;
  if (doc.size() == 0) return false;

  strncpy(out.pumpMode, (doc[0]["pump_mode"] | "AUTO"), 7);
  out.pumpMode[7]  = '\0';
  out.upper        = doc[0]["upper_threshold"]    | 90.0f;
  out.lower        = doc[0]["lower_threshold"]    | 35.0f;
  out.critical     = doc[0]["critical_threshold"] | 25.0f;
  out.newCalib     = true;  // always save thresholds

  out.hasManualCmd = false;
if (String(out.pumpMode) == "MANUAL") {
  bool desired = (String((const char*)(doc[0]["pump_status"] | "OFF")) == "ON");
  // Get current pump state from the latest snapshot (safe, no mutex)
  bool cur = false;
  SensorSnapshot snap;
  if (xQueuePeek(toCloudQueue, &snap, 0) == pdTRUE) {
    cur = snap.pumpOn;   // snapshot copy, not a live pointer
  }
  if (desired != cur) {
    out.hasManualCmd = true;
    out.pumpOnManual = desired;
  }
}
  return true;
}

void sendSensorData(float lvl, float tds, bool pumping,
                    const char* pm, float runtimeMin) {
  // Read deviceId safely
  String devId;
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    devId = deviceId;
  xSemaphoreGive(sharedMutex);
  if (devId.isEmpty()) return;

  DynamicJsonDocument d(512);
  d["device_id"]   = devId;
  d["water_level"] = lvl >= 0 ? lvl : 0;
  d["tds_value"]   = tds;
  d["pump_status"] = pumping ? "ON" : "OFF";
  d["pump_mode"]   = pm;
  d["pump_runtime"]= runtimeMin;

  String body; serializeJson(d, body);
  if (httpPostJson("/rest/v1/sensor_data", body))
    Serial.printf("📤 sync OK lvl=%.0f tds=%.0f rt=%.2fm\n",
                  lvl, tds, runtimeMin);
}

// ============ LCD (sensorTask only) ============
void lcdLine(int row, const String& s) {
  String t = s;
  while (t.length() < 16) t += ' ';
  if (t.length() > 16) t = t.substring(0, 16);
  lcd.setCursor(0, row); lcd.print(t);
}

void lcdNormal(float lvl, float tds) {
  bool   calibMode;
  float  th;
  bool   wifi;
  String pm;   // ✅ Local copy to hold pumpMode safely

  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    calibMode = cloudCalibrationMode;
    th        = tankHeight;
    wifi      = wifiOnline;
    pm        = pumpMode;   // ✅ Copy the shared String INSIDE the mutex
  xSemaphoreGive(sharedMutex);

  String l1, l2;
  if (calibMode) {
    l1 = "CALIB:" + String(lastDistanceIn, 1) + "in";
    l2 = "Set in app";
  } else {
    if (th > 0 && lvl >= 0)
      l1 = "Lvl:" + String((int)lvl) + "% TDS:" + String((int)tds);
    else
      l1 = "D:" + String((int)lastDistanceIn) + "in TDS:" + String((int)tds);
    
    // ✅ Use the LOCAL copy 'pm' instead of the global 'pumpMode'
    l2 = String("Pmp:") + (pumpOn ? "ON " : "OFF") + " " +
         pm + (wifi ? "  N" : "  -");
  }
  lcdLine(0, l1); lcdLine(1, l2);
}

// ============ SETUP MODE WEB HANDLERS ============
void handleRoot() {
  setupServer.send(200, "text/html",
    "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:#fff}"
    "input{width:100%;padding:10px;margin:5px 0 15px;border-radius:8px;"
    "border:1px solid #333;background:#16213e;color:#fff}"
    "button{width:100%;padding:12px;background:#0ea5e9;color:#fff;"
    "border:none;border-radius:8px;font-size:16px}"
    "h2{color:#0ea5e9}</style></head><body><h2>Water Angel Setup</h2>"
    "<form action='/setwifi' method='GET'>"
    "<label>Wi-Fi SSID</label><input name='ssid' required>"
    "<label>Password</label><input name='pass' type='password'>"
    "<button>Connect</button></form></body></html>");
}

void handleSetWifi() {
  String ssid = setupServer.arg("ssid"), pass = setupServer.arg("pass");
  if (!ssid.length()) { setupServer.send(400, "text/plain", "SSID required"); return; }
  saveWifi(ssid, pass);
  setupServer.send(200, "text/plain", "Saved. Rebooting...");
  beep(2); delay(1500); ESP.restart();
}

void startSetupMode() {
  currentMode = MODE_SETUP;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("WaterAngel_Setup", "");
  setupServer.on("/",        handleRoot);
  setupServer.on("/setwifi", handleSetWifi);
  setupServer.begin();
  lcd.clear(); lcdLine(0, "SETUP MODE"); lcdLine(1, "192.168.4.1");
  Serial.println("📡 AP: WaterAngel_Setup");
}

// ============ NON-BLOCKING WIFI STATE MACHINE ============
void startWifiConnection() {
  String ssid, pass;
  if (!loadWifi(ssid, pass)) {
    wifiState  = WIFI_FAILED;
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
      wifiOnline = false;
    xSemaphoreGive(sharedMutex);
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  wifiState        = WIFI_CONNECTING;
  wifiConnectStart = millis();
  Serial.printf("Connecting to %s", ssid.c_str());
}

void updateWifiConnection() {
  // Called from cloudTask only
  if (wifiState != WIFI_CONNECTING) return;

  if (WiFi.status() == WL_CONNECTED) {
    wifiState = WIFI_CONNECTED;
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
      wifiOnline = true;
    xSemaphoreGive(sharedMutex);
    Serial.println(" ✅ " + WiFi.localIP().toString());
    beep(1);

  } else if (millis() - wifiConnectStart > 10000) {
    wifiState = WIFI_FAILED;
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
      wifiOnline = false;
    xSemaphoreGive(sharedMutex);
    Serial.println(" ❌ offline");

  } else {
    static unsigned long lastDot = 0;
    if (millis() - lastDot > 500) { lastDot = millis(); Serial.print("."); }
  }
}

// =============================================================
//  TASK 1 — SENSOR / CONTROL  (Core 1, priority 2)
//  ─────────────────────────────────────────────────────────────
//  Runs every 50 ms via vTaskDelay.
//  Sensor + pump cycle runs every SENSOR_MS (500 ms).
//  LCD updates every DISPLAY_MS (1000 ms).
//  Never touches network. Never blocked by cloud task.
// =============================================================
void sensorTask(void* param) {
  Serial.println("[SENSOR] Task started on Core " + String(xPortGetCoreID()));

  for (;;) {
    unsigned long now = millis();

    // ── Non-blocking beep ──────────────────────────────────
    beepUpdate();

    // ── Setup-button (long-press 3 s → enter setup mode) ──
    if (digitalRead(SETUP_BUTTON) == LOW) {
      if (!buttonHeld) { buttonPressStart = now; buttonHeld = true; }
      else if (now - buttonPressStart >= 3000) {
        clearWifi();
        lcd.clear(); lcdLine(0, "Entering Setup");
        vTaskDelay(pdMS_TO_TICKS(1000));
        startSetupMode();
        buttonHeld = false;
      }
    } else {
      buttonHeld = false;
    }

    // ── Setup mode: hand off to web server, skip sensor ───
    if (currentMode == MODE_SETUP) {
      setupServer.handleClient();
      digitalWrite(LED_RED, (now / 500) % 2);
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }

    // ── Apply settings received from cloud task ────────────
    CloudSettings incoming;
    if (xQueueReceive(toSensorQueue, &incoming, 0) == pdTRUE) {

      xSemaphoreTake(sharedMutex, portMAX_DELAY);
        // Only overwrite thresholds if cloud sent valid values
        if (incoming.upper    > 0) upperThreshold    = incoming.upper;
        if (incoming.lower    > 0) lowerThreshold    = incoming.lower;
        if (incoming.critical > 0) criticalThreshold = incoming.critical;
        if (incoming.tankHt   > 0) {
          tankHeight     = incoming.tankHt;
          tankHeightUnit = String(incoming.tankHtUnit);
          calibrated     = true;
        }
        pumpMode             = String(incoming.pumpMode);
        cloudCalibrationMode = incoming.calibMode;
        if (strlen(incoming.devId) > 0) deviceId = String(incoming.devId);
      xSemaphoreGive(sharedMutex);

      // Persist to EEPROM if calibration data changed
      if (incoming.newCalib) saveCalibration();

      // Apply manual pump command if cloud sent one
      if (incoming.hasManualCmd) {
        setPump(incoming.pumpOnManual);
        Serial.printf("[SENSOR] 💧 Pump %s (manual cmd from cloud)\n",
                      incoming.pumpOnManual ? "ON" : "OFF");
      }
    }

    // ── Sensor + pump cycle ───────────────────────────────
if (now - lastSensorRead_s >= SENSOR_MS) {
  lastSensorRead_s = now;

  float lvl = calcWaterLevel();
  float tds = readTDS();
  controlPump(lvl, tds);

  // Build snapshot
  SensorSnapshot snap;
  snap.level  = (lvl >= 0) ? lvl : 0;
  snap.tds    = tds;
  snap.pumpOn = pumpOn;

  // Runtime: total accumulated + current session (if pump is ON)
  unsigned long long rtMs = totalRuntimeMs;
  if (pumpOn && pumpOnStart) {
    rtMs += (millis() - pumpOnStart);
  }
  snap.runtimeMin = (float)rtMs / 60000.0f;

  // ⚠️ DO NOT reset totalRuntimeMs or pumpOnStart here.
  // They only change when the pump state changes (in setPump).

  String pm;
  xSemaphoreTake(sharedMutex, portMAX_DELAY);
    pm = pumpMode;
  xSemaphoreGive(sharedMutex);
  strncpy(snap.pumpMode, pm.c_str(), 7);
  snap.pumpMode[7] = '\0';

  xQueueOverwrite(toCloudQueue, &snap);

  if (now - lastDisplay_s >= DISPLAY_MS) {
    lastDisplay_s = now;
    lcdNormal(lvl, tds);
  }
}

    // Yield — 50 ms sleep keeps pump reaction time ≤ 550 ms
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// =============================================================
//  TASK 2 — CLOUD / NETWORK  (Core 0, priority 1)
//  ─────────────────────────────────────────────────────────────
//  Polls Supabase every 10 s.
//  Syncs sensor data every 30 s.
//  HTTP calls can block for up to 10 s — sensorTask is unaffected.
// =============================================================
void cloudTask(void* param) {
  Serial.println("[CLOUD]  Task started on Core " + String(xPortGetCoreID()));

  // Give sensorTask a moment to start and initialise
  vTaskDelay(pdMS_TO_TICKS(2000));

  for (;;) {
    unsigned long now = millis();

    // ── WiFi state machine (non-blocking) ─────────────────
    updateWifiConnection();

    bool connected = (WiFi.status() == WL_CONNECTED);
    xSemaphoreTake(sharedMutex, portMAX_DELAY);
      wifiOnline = connected;
    xSemaphoreGive(sharedMutex);

    if (connected) {

      // ── Settings poll every 10 s ───────────────────────
      if (now - lastSettingsPoll_c >= SETTINGS_POLL_MS) {
        lastSettingsPoll_c = now;

        // Build a fresh CloudSettings struct —
        // fetch functions fill it, then we queue it.
        CloudSettings s;
        memset(&s, 0, sizeof(s));

        // Read current shared values as defaults
        xSemaphoreTake(sharedMutex, portMAX_DELAY);
          s.upper    = upperThreshold;
          s.lower    = lowerThreshold;
          s.critical = criticalThreshold;
          s.tankHt   = tankHeight;
          strncpy(s.tankHtUnit, tankHeightUnit.c_str(), 15); s.tankHtUnit[15] = '\0';
          strncpy(s.pumpMode,   pumpMode.c_str(),       7);  s.pumpMode[7]    = '\0';
          strncpy(s.devId,      deviceId.c_str(),       63); s.devId[63]      = '\0';
          s.calibMode = cloudCalibrationMode;
        xSemaphoreGive(sharedMutex);

        // fetchDeviceInfo — may block up to 10 s on this core only
        bool devOk = fetchDeviceInfo(s);
        if (devOk) {
          // fetchPumpSettings — may block up to 10 s on this core only
          fetchPumpSettings(s);
          // Send merged settings to sensorTask
          xQueueOverwrite(toSensorQueue, &s);
          Serial.printf("[CLOUD]  ✓ settings sent → pump=%s up=%.0f lo=%.0f cr=%.0f\n",
                        s.pumpMode, s.upper, s.lower, s.critical);
        }
      }

      // ── Data sync every 30 s ───────────────────────────
      // ── Data sync every 30 s ───────────────────────────
if (now - lastDataSync_c >= DATA_SYNC_MS) {
  lastDataSync_c = now;

  SensorSnapshot snap;
  if (xQueuePeek(toCloudQueue, &snap, 0) == pdTRUE) {
    // runtimeMin was computed and reset by sensorTask on Core 1.
    // We never touch accumulatedRuntimeMs, pumpOnStart, or pumpOn
    // directly — all data comes through the queue snapshot.
    sendSensorData(snap.level, snap.tds, snap.pumpOn,
                   snap.pumpMode, snap.runtimeMin);
  }
}

    } else {
      // ── Wi-Fi retry every 30 s ─────────────────────────
      if (wifiState != WIFI_CONNECTING &&
          now - lastWifiRetry_c >= WIFI_RETRY_MS) {
        lastWifiRetry_c = now;
        startWifiConnection();
      }
    }

    // Yield — 100 ms is fine for cloud polling cadence
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// =============================================================
//  SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== WATER ANGEL v4 - DUAL CORE ===");

  // Pin setup
  pinMode(TRIG_PIN,     OUTPUT);
  pinMode(ECHO_PIN,     INPUT);
  pinMode(TDS_PIN,      INPUT);
  pinMode(RELAY_PIN,    OUTPUT);
  pinMode(LED_GREEN,    OUTPUT);
  pinMode(LED_RED,      OUTPUT);
  pinMode(SETUP_BUTTON, INPUT_PULLUP);

  // Pump OFF at boot — safety first
  digitalWrite(RELAY_PIN, HIGH);
  buzzerInit();

  // LCD
  lcd.init(); lcd.backlight();
  lcdLine(0, "Water Angel"); lcdLine(1, "Booting v4...");

  // Load saved calibration before tasks start
  loadCalibration();
  Serial.printf("Stored: tank=%.1f cal=%d up=%.0f lo=%.0f cr=%.0f\n",
                tankHeight, (int)calibrated,
                (float)upperThreshold, (float)lowerThreshold,
                (float)criticalThreshold);

  // Check setup button at boot
  if (digitalRead(SETUP_BUTTON) == LOW) {
    delay(2000);
    if (digitalRead(SETUP_BUTTON) == LOW) {
      clearWifi(); startSetupMode(); return;
    }
  }

  // Create FreeRTOS synchronisation primitives
  sharedMutex   = xSemaphoreCreateMutex();
  toCloudQueue  = xQueueCreate(1, sizeof(SensorSnapshot));
  toSensorQueue = xQueueCreate(1, sizeof(CloudSettings));

  if (!sharedMutex || !toCloudQueue || !toSensorQueue) {
    Serial.println("❌ FreeRTOS resource creation failed — halting");
    while (true) { delay(1000); }
  }

  // Start Wi-Fi connection (non-blocking state machine)
  startWifiConnection();
  currentMode = MODE_NORMAL;

  // ── Create tasks ──────────────────────────────────────────
  //
  //  sensorTask: Core 1, priority 2 (higher)
  //    - 8 KB stack: sensor code is lean, no TLS
  //
  //  cloudTask:  Core 0, priority 1 (lower)
  //    - 20 KB stack: TLS + ArduinoJson need headroom
  //    - If you see stack-overflow panics, raise to 24576
  //
  BaseType_t r1 = xTaskCreatePinnedToCore(
    sensorTask,   // function
    "SensorTask", // name (for debug)
    8192,         // stack bytes
    NULL,         // parameter
    2,            // priority (higher = more urgent)
    NULL,         // handle (not needed)
    1             // Core 1
  );

  BaseType_t r2 = xTaskCreatePinnedToCore(
    cloudTask,
    "CloudTask",
    20480,        // 20 KB — TLS is memory-hungry
    NULL,
    1,            // lower priority than sensor task
    NULL,
    0             // Core 0
  );

  if (r1 != pdPASS || r2 != pdPASS) {
    Serial.println("❌ Task creation failed — check available heap");
    while (true) { delay(1000); }
  }

  Serial.println("✅ Both tasks started. loop() going idle.");
}

// =============================================================
//  LOOP — intentionally idle
//  Both cores are now managed by FreeRTOS tasks.
//  loop() runs on Core 1 at priority 1 (below sensorTask).
// =============================================================
void loop() {
  vTaskDelay(portMAX_DELAY);
}
