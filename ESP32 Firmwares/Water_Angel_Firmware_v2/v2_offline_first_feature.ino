/*
 * ============================================
 *  WATER ANGEL - ESP32 IoT Firmware (v2)
 *  Works fully offline. Wi-Fi optional.
 * ============================================
 */
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ============ PINS ============
#define TRIG_PIN       26
#define ECHO_PIN       27
#define TDS_PIN        34
#define RELAY_PIN      15
#define BUZZER_PIN     23
#define LED_GREEN      19
#define LED_RED        18
#define SETUP_BUTTON   33

// ============ SUPABASE ============
const char* SUPABASE_URL = "https://pucmngrhhrzybuucrhuk.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Y21uZ3JoaHJ6eWJ1dWNyaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI0NjUsImV4cCI6MjA4ODUxODQ2NX0.sYgEcuUNfgoBCWocgNYED0L_IkOE7vV-dE9GpWElIdQ";

// >>> REPLACE THIS with the System Key for THIS device (find it in the app's Profile or /admin page) <<<
const char* DEVICE_SYSTEM_KEY = "WA-TEST-2026-001";

// ============ EEPROM ============
#define EEPROM_SIZE        256
#define SSID_ADDR          0
#define PASS_ADDR          64
#define MAGIC_ADDR         192
#define TANK_HEIGHT_ADDR   196   // float, 4 bytes
#define UPPER_ADDR         200   // float
#define LOWER_ADDR         204   // float
#define CRIT_ADDR          208   // float
#define CALIB_FLAG_ADDR    212   // 1 byte
#define MAGIC_VALUE        0xAB

// ============ TDS ALERT ============
#define TDS_CRITICAL       600.0   // ppm

LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer setupServer(80);

enum DeviceMode { MODE_NORMAL, MODE_SETUP };
DeviceMode currentMode = MODE_NORMAL;

String   deviceId = "";
bool     wifiOnline = false;
bool     deviceRegistered = false;

float    tankHeight = 0;
String   tankHeightUnit = "inches";
bool     calibrated = false;

String   pumpMode = "AUTO";
bool     pumpOn = false;
float    upperThreshold = 90;
float    lowerThreshold = 35;
float    criticalThreshold = 25;

unsigned long lastDataSync = 0, lastSettingsPoll = 0, lastDisplay = 0, lastSensorRead = 0;
unsigned long buttonPressStart = 0;
bool          buttonHeld = false;

const unsigned long DATA_SYNC_MS    = 30000;
const unsigned long SETTINGS_POLL_MS= 10000;
const unsigned long DISPLAY_MS      = 1000;
const unsigned long SENSOR_MS       = 500;

float lastValidLevel = 50;
float lastDistanceIn = 0;

// Calibration mode requested from cloud
bool  cloudCalibrationMode = false;

// ============ EEPROM HELPERS ============
void eepromWriteFloat(int addr, float v) {
  byte* p = (byte*)&v;
  for (int i = 0; i < 4; i++) EEPROM.write(addr + i, p[i]);
}
float eepromReadFloat(int addr) {
  float v; byte* p = (byte*)&v;
  for (int i = 0; i < 4; i++) p[i] = EEPROM.read(addr + i);
  return v;
}
void saveCalibration() {
  EEPROM.begin(EEPROM_SIZE);
  eepromWriteFloat(TANK_HEIGHT_ADDR, tankHeight);
  eepromWriteFloat(UPPER_ADDR, upperThreshold);
  eepromWriteFloat(LOWER_ADDR, lowerThreshold);
  eepromWriteFloat(CRIT_ADDR,  criticalThreshold);
  EEPROM.write(CALIB_FLAG_ADDR, calibrated ? 1 : 0);
  EEPROM.commit(); EEPROM.end();
}
void loadCalibration() {
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(CALIB_FLAG_ADDR) == 1) {
    tankHeight        = eepromReadFloat(TANK_HEIGHT_ADDR);
    upperThreshold    = eepromReadFloat(UPPER_ADDR);
    lowerThreshold    = eepromReadFloat(LOWER_ADDR);
    criticalThreshold = eepromReadFloat(CRIT_ADDR);
    if (tankHeight > 0 && tankHeight < 500) calibrated = true;
    if (upperThreshold <= 0 || upperThreshold > 100) upperThreshold = 90;
    if (lowerThreshold <= 0 || lowerThreshold > 100) lowerThreshold = 35;
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
bool loadWifi(String &ssid, String &pass) {
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(MAGIC_ADDR) != MAGIC_VALUE) { EEPROM.end(); return false; }
  char buf[65];
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(SSID_ADDR + i); buf[64]=0; ssid = String(buf);
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(PASS_ADDR + i); buf[64]=0; pass = String(buf);
  EEPROM.end();
  return ssid.length() > 0;
}
void clearWifi() { EEPROM.begin(EEPROM_SIZE); EEPROM.write(MAGIC_ADDR, 0); EEPROM.commit(); EEPROM.end(); }

// ============ BUZZER PATTERNS ============
void beep(int times, int dur = 120) {
  for (int i = 0; i < times; i++) {
    tone(BUZZER_PIN, 2000, dur);
    delay(dur + 80);
  }
}
void criticalAlarm() {  // call repeatedly
  static unsigned long t = 0;
  if (millis() - t > 600) {
    t = millis();
    tone(BUZZER_PIN, 2500, 250);
  }
}

// ============ SENSORS ============
float readDistanceInches() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long d = pulseIn(ECHO_PIN, HIGH, 30000);
  if (d == 0) return -1;
  float inches = (d * 0.034 / 2.0) / 2.54;
  if (inches < 2 || inches > 120) return -1;
  return inches;
}
float calcWaterLevel() {
  float dist = readDistanceInches();
  if (dist < 0) return lastValidLevel;
  lastDistanceIn = dist;
  if (tankHeight <= 0) return -1;  // not calibrated
  float level = ((tankHeight - dist) / tankHeight) * 100.0;
  level = constrain(level, 0, 100);
  lastValidLevel = level;
  return level;
}
float readTDS() {
  int raw = analogRead(TDS_PIN);
  float v = raw * 3.3 / 4095.0;
  float tds = (133.42*v*v*v - 255.86*v*v + 857.39*v) * 0.5;
  return max(0.0f, tds);
}

// ============ PUMP ============
void controlPump(float waterLevel, float tds) {
  // AUTO mode pump control (only if calibrated)
  if (pumpMode == "AUTO" && tankHeight > 0 && waterLevel >= 0) {
    if (waterLevel <= lowerThreshold && !pumpOn) {
      pumpOn = true; digitalWrite(RELAY_PIN, HIGH);
      Serial.println("💧 Pump ON (auto)");
    } else if (waterLevel >= upperThreshold && pumpOn) {
      pumpOn = false; digitalWrite(RELAY_PIN, LOW);
      Serial.println("💧 Pump OFF (auto)");
    }
  }

  // Critical alarm: low water OR bad TDS
  bool critical = false;
  if (tankHeight > 0 && waterLevel >= 0 && waterLevel <= criticalThreshold) critical = true;
  if (tds > TDS_CRITICAL) critical = true;

  if (critical) { digitalWrite(LED_RED, HIGH); criticalAlarm(); }
  else          { digitalWrite(LED_RED, LOW);  noTone(BUZZER_PIN); }

  digitalWrite(LED_GREEN, pumpOn ? HIGH : LOW);
}

// ============ CLOUD ============
bool fetchDeviceInfo() {
  if (!wifiOnline) return false;
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices?system_key=eq." + DEVICE_SYSTEM_KEY +
               "&select=id,tank_height,tank_height_unit,calibration_mode,pending_command";
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, http.getString());
    if (doc.size() > 0) {
      deviceId = doc[0]["id"].as<String>();
      deviceRegistered = true;
      cloudCalibrationMode = doc[0]["calibration_mode"] | false;
      if (!doc[0]["tank_height"].isNull()) {
        float h = doc[0]["tank_height"].as<float>();
        if (h > 0 && (!calibrated || fabs(h - tankHeight) > 0.01)) {
          tankHeight = h;
          tankHeightUnit = doc[0]["tank_height_unit"] | "inches";
          calibrated = true;
          saveCalibration();
          Serial.printf("✓ Tank height synced from cloud: %.2f %s\n", tankHeight, tankHeightUnit.c_str());
        }
      }
      ok = true;
    }
  }
  http.end();
  return ok;
}
bool fetchPumpSettings() {
  if (!wifiOnline || deviceId.isEmpty()) return false;
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/pump_settings?device_id=eq." + deviceId + "&select=*";
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  int code = http.GET();
  bool ok = false;
  if (code == 200) {
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, http.getString());
    if (doc.size() > 0) {
      pumpMode          = doc[0]["pump_mode"]          | "AUTO";
      upperThreshold    = doc[0]["upper_threshold"]    | 90.0;
      lowerThreshold    = doc[0]["lower_threshold"]    | 35.0;
      criticalThreshold = doc[0]["critical_threshold"] | 25.0;
      saveCalibration();

      // MANUAL pump command
      if (pumpMode == "MANUAL") {
        bool desired = (doc[0]["pump_status"] | "OFF") == "ON";
        if (desired != pumpOn) {
          pumpOn = desired;
          digitalWrite(RELAY_PIN, pumpOn ? HIGH : LOW);
          Serial.printf("💧 Pump %s (manual remote)\n", pumpOn ? "ON" : "OFF");
        }
      }
      ok = true;
    }
  }
  http.end();
  return ok;
}
void sendSensorData(float level, float tds, float runtime) {
  if (!wifiOnline || deviceId.isEmpty()) return;
  HTTPClient http;
  http.begin(String(SUPABASE_URL) + "/rest/v1/sensor_data");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");
  DynamicJsonDocument doc(512);
  doc["device_id"]   = deviceId;
  doc["water_level"] = level >= 0 ? level : 0;
  doc["tds_value"]   = tds;
  doc["pump_status"] = pumpOn ? "ON" : "OFF";
  doc["pump_mode"]   = pumpMode;
  doc["pump_runtime"]= runtime;
  String body; serializeJson(doc, body);
  int code = http.POST(body);
  if (code == 201) Serial.printf("📤 Sync OK lvl=%.0f TDS=%.0f\n", level, tds);
  else             Serial.printf("⚠ Sync failed (%d)\n", code);
  http.end();
}

// ============ LCD ============
void lcdNormal(float level, float tds) {
  lcd.clear();
  lcd.setCursor(0,0);
  if (cloudCalibrationMode) {
    lcd.print("CALIB: ");
    lcd.print(lastDistanceIn, 1); lcd.print(" in");
    lcd.setCursor(0,1);
    lcd.print("Set in app");
    return;
  }
  if (tankHeight > 0 && level >= 0) {
    lcd.print("Lvl:"); lcd.print((int)level); lcd.print("% ");
  } else {
    lcd.print("Dist:"); lcd.print((int)lastDistanceIn); lcd.print("in ");
  }
  lcd.print("TDS:"); lcd.print((int)tds);
  lcd.setCursor(0,1);
  lcd.print("Pump:"); lcd.print(pumpOn ? "ON " : "OFF");
  lcd.print(" "); lcd.print(pumpMode);
  lcd.setCursor(13,1);
  lcd.print(wifiOnline ? "NET" : "OFF");
}

// ============ SETUP MODE (AP) ============
void handleRoot() {
  String html = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:#fff}"
    "input{width:100%;padding:10px;margin:5px 0 15px;border-radius:8px;border:1px solid #333;background:#16213e;color:#fff}"
    "button{width:100%;padding:12px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;font-size:16px}"
    "h2{color:#0ea5e9}</style></head><body><h2>Water Angel Setup</h2>"
    "<form action='/setwifi' method='GET'>"
    "<label>Wi-Fi Name (SSID):</label><input name='ssid' required>"
    "<label>Password:</label><input name='pass' type='password'>"
    "<button>Connect</button></form></body></html>";
  setupServer.send(200, "text/html", html);
}
void handleSetWifi() {
  String ssid = setupServer.arg("ssid"), pass = setupServer.arg("pass");
  if (!ssid.length()) { setupServer.send(400, "text/plain", "SSID required"); return; }
  saveWifi(ssid, pass);
  setupServer.send(200, "text/plain", "Saved. Rebooting...");
  beep(2);
  delay(1500);
  ESP.restart();
}
void startSetupMode() {
  currentMode = MODE_SETUP;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("WaterAngel_Setup", "");
  setupServer.on("/", handleRoot);
  setupServer.on("/setwifi", handleSetWifi);
  setupServer.begin();
  lcd.clear(); lcd.print("SETUP MODE");
  lcd.setCursor(0,1); lcd.print("192.168.4.1");
  Serial.println("📡 AP started: WaterAngel_Setup");
}

// Try Wi-Fi non-blocking-ish (10s timeout, then give up and run offline)
bool tryWifiConnect() {
  String ssid, pass;
  if (!loadWifi(ssid, pass)) return false;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  Serial.printf("Connecting to %s", ssid.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(300); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" ✅ " + WiFi.localIP().toString());
    beep(1);
    return true;
  }
  Serial.println(" ❌ offline");
  return false;
}

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== WATER ANGEL v2 ===");

  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  pinMode(TDS_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT); pinMode(LED_RED, OUTPUT);
  pinMode(SETUP_BUTTON, INPUT_PULLUP);
  digitalWrite(RELAY_PIN, LOW);

  lcd.init(); lcd.backlight();
  lcd.print("Water Angel"); lcd.setCursor(0,1); lcd.print("Booting...");

  loadCalibration();
  Serial.printf("Stored: tankH=%.1f calib=%d up=%.0f lo=%.0f cr=%.0f\n",
                tankHeight, calibrated, upperThreshold, lowerThreshold, criticalThreshold);

  // Hold setup button at boot to force AP mode
  if (digitalRead(SETUP_BUTTON) == LOW) {
    delay(2000);
    if (digitalRead(SETUP_BUTTON) == LOW) { clearWifi(); startSetupMode(); return; }
  }

  wifiOnline = tryWifiConnect();
  if (wifiOnline) {
    if (fetchDeviceInfo()) fetchPumpSettings();
    else { lcd.clear(); lcd.print("Device not found"); lcd.setCursor(0,1); lcd.print("Check sys key"); delay(2500); }
  }
  // Whether or not Wi-Fi worked, run normal mode
  currentMode = MODE_NORMAL;
}

// ============ LOOP ============
void loop() {
  unsigned long now = millis();

  // Setup-button long press → AP mode
  if (digitalRead(SETUP_BUTTON) == LOW) {
    if (!buttonHeld) { buttonPressStart = now; buttonHeld = true; }
    else if (now - buttonPressStart >= 3000) {
      clearWifi();
      lcd.clear(); lcd.print("Entering Setup");
      delay(1000);
      startSetupMode();
      buttonHeld = false;
    }
  } else buttonHeld = false;

  if (currentMode == MODE_SETUP) {
    setupServer.handleClient();
    digitalWrite(LED_RED, (now / 500) % 2);
    return;
  }

  // ---- NORMAL MODE (works offline) ----
  if (now - lastSensorRead >= SENSOR_MS) {
    lastSensorRead = now;
    float level = calcWaterLevel();
    float tds   = readTDS();
    controlPump(level, tds);

    if (now - lastDisplay >= DISPLAY_MS) {
      lastDisplay = now;
      lcdNormal(level, tds);
    }

    // Cloud sync (only if online)
    if (wifiOnline && now - lastDataSync >= DATA_SYNC_MS) {
      lastDataSync = now;
      float runtime = pumpOn ? DATA_SYNC_MS / 1000.0 : 0;
      sendSensorData(level >= 0 ? level : 0, tds, runtime);
    }
  }

  // Periodic Wi-Fi reconnect attempt + settings poll
  if (now - lastSettingsPoll >= SETTINGS_POLL_MS) {
    lastSettingsPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      wifiOnline = true;
      fetchDeviceInfo();
      fetchPumpSettings();
    } else {
      wifiOnline = false;
      // Try silent reconnect (non-blocking attempt)
      String ssid, pass;
      if (loadWifi(ssid, pass)) WiFi.begin(ssid.c_str(), pass.c_str());
    }
  }
}
