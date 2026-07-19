/* ============================================
 *  WATER ANGEL - ESP32 Firmware (v3 - fixed)
 *  Offline-first. Wi-Fi optional.
 *  Non‑blocking WiFi & beep. HTTP mutex.
 * ============================================ */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

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
const char* SUPABASE_URL = "https://pucmngrhhrzybuucrhuk.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Y21uZ3JoaHJ6eWJ1dWNyaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI0NjUsImV4cCI6MjA4ODUxODQ2NX0.sYgEcuUNfgoBCWocgNYED0L_IkOE7vV-dE9GpWElIdQ";
const char* DEVICE_SYSTEM_KEY = "DEVICE-BETA-002";

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

LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer setupServer(80);

enum DeviceMode { MODE_NORMAL, MODE_SETUP };
DeviceMode currentMode = MODE_NORMAL;

String  deviceId = "";
bool    wifiOnline = false;
float   tankHeight = 0;
String  tankHeightUnit = "inches";
bool    calibrated = false;

String  pumpMode = "AUTO";
bool    pumpOn = false;
float   upperThreshold = 90, lowerThreshold = 35, criticalThreshold = 25;

unsigned long lastDataSync=0, lastSettingsPoll=0, lastDisplay=0, lastSensorRead=0;
unsigned long lastWifiRetry=0;
unsigned long buttonPressStart=0;
unsigned long pumpOnStart=0, accumulatedRuntimeMs=0;
bool buttonHeld=false;
bool cloudCalibrationMode=false;

const unsigned long DATA_SYNC_MS    = 30000;
const unsigned long SETTINGS_POLL_MS= 10000;
const unsigned long DISPLAY_MS      = 1000;
const unsigned long SENSOR_MS       = 500;
const unsigned long WIFI_RETRY_MS   = 30000;

float lastValidLevel = 50, lastDistanceIn = 0;

// ============ NON‑BLOCKING BEEP ============
bool beepActive = false;
int beepRemaining = 0;
unsigned long beepNextChange = 0;
bool beepSoundOn = false;

void beep(int times, int dur = 120) {
  if (times <= 0) return;
  beepActive = true;
  beepRemaining = times;
  beepNextChange = millis();
  beepSoundOn = true;
  buzzOn(2000);
}
void beepUpdate() {
  if (!beepActive) return;
  unsigned long now = millis();
  if (now >= beepNextChange) {
    if (beepSoundOn) {
      buzzOff();
      beepSoundOn = false;
      beepNextChange = now + 80;
    } else {
      beepRemaining--;
      if (beepRemaining == 0) {
        beepActive = false;
        buzzOff();
        return;
      }
      buzzOn(2000);
      beepSoundOn = true;
      beepNextChange = now + 120;
    }
  }
}

// ============ BUZZER (tone) ============
void buzzerInit() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}
void buzzOn(int freq) {
  tone(BUZZER_PIN, freq);
}
void buzzOff() {
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}
void criticalAlarm() {
  static unsigned long t = 0;
  static bool on = false;
  if (millis() - t > 400) {
    t = millis();
    on = !on;
    if (on) buzzOn(2500);
    else buzzOff();
  }
}

// ============ EEPROM ============
void eepromWriteFloat(int a,float v){byte*p=(byte*)&v;for(int i=0;i<4;i++)EEPROM.write(a+i,p[i]);}
float eepromReadFloat(int a){float v;byte*p=(byte*)&v;for(int i=0;i<4;i++)p[i]=EEPROM.read(a+i);return v;}

void saveCalibration() {
  EEPROM.begin(EEPROM_SIZE);
  eepromWriteFloat(TANK_HEIGHT_ADDR,tankHeight);
  eepromWriteFloat(UPPER_ADDR,upperThreshold);
  eepromWriteFloat(LOWER_ADDR,lowerThreshold);
  eepromWriteFloat(CRIT_ADDR,criticalThreshold);
  EEPROM.write(CALIB_FLAG_ADDR, calibrated?1:0);
  EEPROM.commit(); EEPROM.end();
}
void loadCalibration() {
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(CALIB_FLAG_ADDR)==1) {
    tankHeight        = eepromReadFloat(TANK_HEIGHT_ADDR);
    upperThreshold    = eepromReadFloat(UPPER_ADDR);
    lowerThreshold    = eepromReadFloat(LOWER_ADDR);
    criticalThreshold = eepromReadFloat(CRIT_ADDR);
    if (tankHeight>0 && tankHeight<500) calibrated=true;
    if (upperThreshold<=0||upperThreshold>100) upperThreshold=90;
    if (lowerThreshold<=0||lowerThreshold>100) lowerThreshold=35;
    if (criticalThreshold<=0||criticalThreshold>100) criticalThreshold=25;
  }
  EEPROM.end();
}
void saveWifi(String ssid,String pass){
  EEPROM.begin(EEPROM_SIZE);
  for(int i=0;i<64;i++)EEPROM.write(SSID_ADDR+i,0);
  for(int i=0;i<64;i++)EEPROM.write(PASS_ADDR+i,0);
  for(size_t i=0;i<ssid.length()&&i<63;i++)EEPROM.write(SSID_ADDR+i,ssid[i]);
  for(size_t i=0;i<pass.length()&&i<63;i++)EEPROM.write(PASS_ADDR+i,pass[i]);
  EEPROM.write(MAGIC_ADDR,MAGIC_VALUE);
  EEPROM.commit(); EEPROM.end();
}
bool loadWifi(String &ssid,String &pass){
  EEPROM.begin(EEPROM_SIZE);
  if(EEPROM.read(MAGIC_ADDR)!=MAGIC_VALUE){EEPROM.end();return false;}
  char buf[65];
  for(int i=0;i<64;i++) buf[i]=EEPROM.read(SSID_ADDR+i); buf[64]=0; ssid=String(buf);
  for(int i=0;i<64;i++) buf[i]=EEPROM.read(PASS_ADDR+i); buf[64]=0; pass=String(buf);
  EEPROM.end();
  return ssid.length()>0;
}
void clearWifi(){EEPROM.begin(EEPROM_SIZE);EEPROM.write(MAGIC_ADDR,0);EEPROM.commit();EEPROM.end();}

// ============ SENSORS ============
float readDistanceInches() {
  digitalWrite(TRIG_PIN,LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN,LOW);
  long d=pulseIn(ECHO_PIN,HIGH,30000);
  if(d==0) return -1;
  float in=(d*0.034/2.0)/2.54;
  if(in<2||in>120) return -1;
  return in;
}
float calcWaterLevel(){
  float d=readDistanceInches();
  if(d<0) return lastValidLevel;
  lastDistanceIn=d;
  if(tankHeight<=0) return -1;
  float lvl=((tankHeight-d)/tankHeight)*100.0;
  lvl=constrain(lvl,0,100);
  lastValidLevel=lvl;
  return lvl;
}
float readTDS(){
  long sum=0; for(int i=0;i<10;i++){ sum+=analogRead(TDS_PIN); delay(2); }
  float v=(sum/10.0)*3.3/4095.0;
  float tds=(133.42*v*v*v - 255.86*v*v + 857.39*v)*0.5;
  return max(0.0f,tds);
}

// ============ PUMP ============
void setPump(bool on){
  if(on==pumpOn) return;
  pumpOn=on; digitalWrite(RELAY_PIN, on?HIGH:LOW);
  if(on) pumpOnStart=millis();
  else if(pumpOnStart) { accumulatedRuntimeMs += millis()-pumpOnStart; pumpOnStart=0; }
}
void controlPump(float lvl,float tds){
  if(pumpMode=="AUTO" && tankHeight>0 && lvl>=0){
    if(lvl<=lowerThreshold && !pumpOn){ setPump(true); Serial.println("💧 Pump ON (auto)"); }
    else if(lvl>=upperThreshold && pumpOn){ setPump(false); Serial.println("💧 Pump OFF (auto)"); }
  }
  bool crit=false;
  if(tankHeight>0 && lvl>=0 && lvl<=criticalThreshold) crit=true;
  if(tds>TDS_CRITICAL) crit=true;
  if(crit){ digitalWrite(LED_RED,HIGH); criticalAlarm(); }
  else    { digitalWrite(LED_RED,LOW);  buzzOff(); }
  digitalWrite(LED_GREEN, pumpOn?HIGH:LOW);
}

// ============ HTTPS HELPER (v3.1 - fixed GET timeouts) ============
WiFiClientSecure secureClient;
bool httpInProgress = false;

static void prepareSecureClient() {
  // Fresh socket every request — avoids half-closed TLS reuse bug
  secureClient.stop();
  secureClient.setInsecure();           // skip cert validation
  secureClient.setHandshakeTimeout(10); // seconds (ESP32 API)
  secureClient.setTimeout(10);          // seconds (ESP32 API) — NOT ms!
}

bool httpGetJson(const String& path, DynamicJsonDocument& doc) {
  if (!wifiOnline || httpInProgress) return false;
  httpInProgress = true;

  prepareSecureClient();
  HTTPClient http;
  http.setReuse(false);
  http.setTimeout(10000);               // ms — HTTPClient API
  http.setConnectTimeout(8000);

  String url = String(SUPABASE_URL) + path;
  bool success = false;

  if (http.begin(secureClient, url)) {
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Accept", "application/json");
    http.addHeader("Connection", "close");

    int code = http.GET();
    if (code == 200) {
      String body = http.getString();
      DeserializationError e = deserializeJson(doc, body);
      if (!e) success = true;
      else Serial.printf("JSON err: %s\n", e.c_str());
    } else {
      Serial.printf("GET %s -> %d\n", path.c_str(), code);
    }
    http.end();
  } else {
    Serial.println("http.begin fail");
  }

  secureClient.stop();                  // close socket cleanly
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
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=minimal");
    http.addHeader("Connection", "close");

    int code = http.POST(body);
    if (code >= 200 && code < 300) success = true;
    else Serial.printf("POST %s -> %d  %s\n", path.c_str(), code, http.getString().c_str());
    http.end();
  }

  secureClient.stop();
  httpInProgress = false;
  return success;
}

// ============ CLOUD ============
bool fetchDeviceInfo(){
  DynamicJsonDocument doc(1024);
  String path = "/rest/v1/devices?system_key=eq." + String(DEVICE_SYSTEM_KEY) +
                "&select=id,tank_height,tank_height_unit,calibration_mode,pending_command";
  if (!httpGetJson(path, doc)) return false;
  if (doc.size()==0) { Serial.println("⚠ device row not found"); return false; }
  deviceId = doc[0]["id"].as<String>();
  cloudCalibrationMode = doc[0]["calibration_mode"] | false;
  if (!doc[0]["tank_height"].isNull()) {
    float h = doc[0]["tank_height"].as<float>();
    if (h>0 && (!calibrated || fabs(h-tankHeight)>0.01)) {
      tankHeight=h;
      tankHeightUnit = doc[0]["tank_height_unit"] | "inches";
      calibrated=true; saveCalibration();
      Serial.printf("✓ tank height synced: %.2f %s\n", tankHeight, tankHeightUnit.c_str());
    }
  }
  return true;
}
bool fetchPumpSettings(){
  if (deviceId.isEmpty()) return false;
  DynamicJsonDocument doc(1024);
  String path = "/rest/v1/pump_settings?device_id=eq." + deviceId + "&select=*";
  if (!httpGetJson(path, doc)) return false;
  if (doc.size()==0) return false;
  pumpMode          = doc[0]["pump_mode"]          | "AUTO";
  upperThreshold    = doc[0]["upper_threshold"]    | 90.0;
  lowerThreshold    = doc[0]["lower_threshold"]    | 35.0;
  criticalThreshold = doc[0]["critical_threshold"] | 25.0;
  saveCalibration();
  if (pumpMode=="MANUAL") {
    bool desired = (String((const char*)(doc[0]["pump_status"] | "OFF")) == "ON");
    if (desired != pumpOn) { setPump(desired); Serial.printf("💧 Pump %s (manual)\n", desired?"ON":"OFF"); }
  }
  return true;
}
void sendSensorData(float lvl,float tds){
  if (deviceId.isEmpty()) return;
  unsigned long runtimeMs = accumulatedRuntimeMs + (pumpOn && pumpOnStart ? millis()-pumpOnStart : 0);
  accumulatedRuntimeMs = 0;
  if (pumpOn) pumpOnStart = millis();
  DynamicJsonDocument d(512);
  d["device_id"]=deviceId;
  d["water_level"]= lvl>=0?lvl:0;
  d["tds_value"]=tds;
  d["pump_status"]= pumpOn?"ON":"OFF";
  d["pump_mode"]=pumpMode;
  d["pump_runtime"]= runtimeMs/60000.0;
  String body; serializeJson(d,body);
  if (httpPostJson("/rest/v1/sensor_data", body))
    Serial.printf("📤 sync OK lvl=%.0f tds=%.0f rt=%.2fm\n", lvl, tds, runtimeMs/60000.0);
}

// ============ LCD ============
void lcdLine(int row, const String& s){
  String t=s; while(t.length()<16) t+=' '; if(t.length()>16) t=t.substring(0,16);
  lcd.setCursor(0,row); lcd.print(t);
}
void lcdNormal(float lvl,float tds){
  String l1, l2;
  if (cloudCalibrationMode) {
    l1 = "CALIB:" + String(lastDistanceIn,1) + "in";
    l2 = "Set in app";
  } else {
    if (tankHeight>0 && lvl>=0) l1 = "Lvl:" + String((int)lvl) + "% TDS:" + String((int)tds);
    else                        l1 = "D:" + String((int)lastDistanceIn) + "in TDS:" + String((int)tds);
    l2 = String("Pmp:") + (pumpOn?"ON ":"OFF") + " " + pumpMode + (wifiOnline?"  N":"  -");
  }
  lcdLine(0,l1); lcdLine(1,l2);
}

// ============ SETUP MODE ============
void handleRoot(){
  setupServer.send(200,"text/html",
   "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
   "<style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:#fff}"
   "input{width:100%;padding:10px;margin:5px 0 15px;border-radius:8px;border:1px solid #333;background:#16213e;color:#fff}"
   "button{width:100%;padding:12px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;font-size:16px}"
   "h2{color:#0ea5e9}</style></head><body><h2>Water Angel Setup</h2>"
   "<form action='/setwifi' method='GET'>"
   "<label>Wi-Fi SSID</label><input name='ssid' required>"
   "<label>Password</label><input name='pass' type='password'>"
   "<button>Connect</button></form></body></html>");
}
void handleSetWifi(){
  String ssid=setupServer.arg("ssid"), pass=setupServer.arg("pass");
  if(!ssid.length()){ setupServer.send(400,"text/plain","SSID required"); return; }
  saveWifi(ssid,pass);
  setupServer.send(200,"text/plain","Saved. Rebooting...");
  beep(2); delay(1500); ESP.restart();
}
void startSetupMode(){
  currentMode=MODE_SETUP;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("WaterAngel_Setup","");
  setupServer.on("/",handleRoot);
  setupServer.on("/setwifi",handleSetWifi);
  setupServer.begin();
  lcd.clear(); lcdLine(0,"SETUP MODE"); lcdLine(1,"192.168.4.1");
  Serial.println("📡 AP: WaterAngel_Setup");
}

// ============ NON‑BLOCKING WIFI ============
enum WiFiState { WIFI_IDLE, WIFI_CONNECTING, WIFI_CONNECTED, WIFI_FAILED };
WiFiState wifiState = WIFI_IDLE;
unsigned long wifiConnectStart = 0;

void startWifiConnection() {
  String ssid, pass;
  if (!loadWifi(ssid, pass)) {
    wifiState = WIFI_FAILED;
    wifiOnline = false;
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  wifiState = WIFI_CONNECTING;
  wifiConnectStart = millis();
  Serial.printf("Connecting to %s", ssid.c_str());
}

void updateWifiConnection() {
  if (wifiState == WIFI_CONNECTING) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiState = WIFI_CONNECTED;
      wifiOnline = true;
      Serial.println(" ✅ " + WiFi.localIP().toString());
      beep(1);
    } else if (millis() - wifiConnectStart > 10000) {
      wifiState = WIFI_FAILED;
      wifiOnline = false;
      Serial.println(" ❌ offline");
    } else {
      static unsigned long lastDot = 0;
      if (millis() - lastDot > 500) {
        lastDot = millis();
        Serial.print(".");
      }
    }
  }
}

// ============ SETUP ============
void setup(){
  Serial.begin(115200);
  Serial.println("\n=== WATER ANGEL v3 ===");
  pinMode(TRIG_PIN,OUTPUT); pinMode(ECHO_PIN,INPUT); pinMode(TDS_PIN,INPUT);
  pinMode(RELAY_PIN,OUTPUT); pinMode(LED_GREEN,OUTPUT); pinMode(LED_RED,OUTPUT);
  pinMode(SETUP_BUTTON,INPUT_PULLUP);
  digitalWrite(RELAY_PIN,LOW);
  buzzerInit();
  lcd.init(); lcd.backlight();
  lcdLine(0,"Water Angel"); lcdLine(1,"Booting...");

  loadCalibration();
  Serial.printf("Stored: tank=%.1f cal=%d up=%.0f lo=%.0f cr=%.0f\n",
                tankHeight,calibrated,upperThreshold,lowerThreshold,criticalThreshold);

  if(digitalRead(SETUP_BUTTON)==LOW){
    delay(2000);
    if(digitalRead(SETUP_BUTTON)==LOW){ clearWifi(); startSetupMode(); return; }
  }

  // secureClient.setInsecure() removed — now called per-request inside prepareSecureClient()
  startWifiConnection();
  currentMode = MODE_NORMAL;
}

// ============ LOOP ============
void loop(){
  unsigned long now = millis();

  beepUpdate();
  updateWifiConnection();

  if(digitalRead(SETUP_BUTTON)==LOW){
    if(!buttonHeld){ buttonPressStart=now; buttonHeld=true; }
    else if(now-buttonPressStart>=3000){
      clearWifi(); lcd.clear(); lcdLine(0,"Entering Setup"); delay(1000);
      startSetupMode(); buttonHeld=false;
    }
  } else buttonHeld=false;

  if(currentMode == MODE_SETUP){
    setupServer.handleClient();
    digitalWrite(LED_RED,(now/500)%2);
    return;
  }

  if(now - lastSensorRead >= SENSOR_MS){
    lastSensorRead = now;
    float lvl = calcWaterLevel();
    float tds = readTDS();
    controlPump(lvl, tds);
    if(now - lastDisplay >= DISPLAY_MS){
      lastDisplay = now;
      lcdNormal(lvl, tds);
    }
    if(wifiOnline && (now - lastDataSync >= DATA_SYNC_MS)){
      lastDataSync = now;
      sendSensorData(lvl >= 0 ? lvl : 0, tds);
    }
  }

  if(now - lastSettingsPoll >= SETTINGS_POLL_MS){
    lastSettingsPoll = now;
    if(WiFi.status() == WL_CONNECTED){
      wifiOnline = true;
      fetchDeviceInfo();
      fetchPumpSettings();
    } else {
      wifiOnline = false;
      if(wifiState != WIFI_CONNECTING && (now - lastWifiRetry >= WIFI_RETRY_MS)){
        lastWifiRetry = now;
        startWifiConnection();
      }
    }
  }
}