/*
 * ============================================
 *  WATER ANGEL - ESP32 IoT Firmware
 *  LCD FIXED - Shows Height Properly
 * ============================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <EEPROM.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ============ PIN DEFINITIONS ============
#define TRIG_PIN       26
#define ECHO_PIN       27
#define TDS_PIN        34      // Analog
#define RELAY_PIN      15
#define BUZZER_PIN     23
#define LED_GREEN      19
#define LED_RED        18
#define SETUP_BUTTON   33

// ============ SUPABASE CONFIG ============
const char* SUPABASE_URL = "https://pucmngrhhrzybuucrhuk.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Y21uZ3JoaHJ6eWJ1dWNyaHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDI0NjUsImV4cCI6MjA4ODUxODQ2NX0.sYgEcuUNfgoBCWocgNYED0L_IkOE7vV-dE9GpWElIdQ";
const char* DEVICE_SYSTEM_KEY = "YOUR_SYSTEM_KEY";

// ============ EEPROM LAYOUT ============
#define EEPROM_SIZE     200
#define SSID_ADDR       0
#define PASS_ADDR       64
#define MAGIC_ADDR      192
#define MAGIC_VALUE     0xAB

// ============ OBJECTS ============
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer setupServer(80);

// ============ STATE ============
enum DeviceMode { MODE_SETUP, MODE_CALIBRATION, MODE_NORMAL };
DeviceMode currentMode = MODE_SETUP;

String deviceId = "";
float tankHeight = 0;
String tankHeightUnit = "in";
bool calibrated = false;

String pumpMode = "auto";
bool pumpOn = false;
float upperThreshold = 90;
float lowerThreshold = 35;
float criticalThreshold = 25;

unsigned long lastDataSync = 0;
unsigned long lastSettingsPoll = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastUltrasonicRead = 0;
unsigned long buttonPressStart = 0;
bool buttonHeld = false;

const unsigned long DATA_SYNC_INTERVAL = 30000;
const unsigned long SETTINGS_POLL_INTERVAL = 10000;
const unsigned long DISPLAY_INTERVAL = 1000;
const unsigned long ULTRASONIC_INTERVAL = 500;

float lastValidWaterLevel = 50;
float lastDisplayDistance = 0;

// ============ EEPROM FUNCTIONS ============
void saveWifiCredentials(String ssid, String pass) {
  EEPROM.begin(EEPROM_SIZE);
  for (int i = 0; i < 64; i++) EEPROM.write(SSID_ADDR + i, 0);
  for (int i = 0; i < 64; i++) EEPROM.write(PASS_ADDR + i, 0);
  for (int i = 0; i < ssid.length(); i++) EEPROM.write(SSID_ADDR + i, ssid[i]);
  for (int i = 0; i < pass.length(); i++) EEPROM.write(PASS_ADDR + i, pass[i]);
  EEPROM.write(MAGIC_ADDR, MAGIC_VALUE);
  EEPROM.commit();
  EEPROM.end();
}

bool loadWifiCredentials(String &ssid, String &pass) {
  EEPROM.begin(EEPROM_SIZE);
  if (EEPROM.read(MAGIC_ADDR) != MAGIC_VALUE) {
    EEPROM.end();
    return false;
  }
  char buf[65];
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(SSID_ADDR + i);
  buf[64] = 0;
  ssid = String(buf);
  for (int i = 0; i < 64; i++) buf[i] = EEPROM.read(PASS_ADDR + i);
  buf[64] = 0;
  pass = String(buf);
  EEPROM.end();
  return ssid.length() > 0;
}

void clearWifiCredentials() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.write(MAGIC_ADDR, 0);
  EEPROM.commit();
  EEPROM.end();
}

// ============ ULTRASONIC SENSOR ============
float readDistanceInches() {
  noInterrupts();
  
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  
  interrupts();
  
  if (duration == 0) {
    return -1;
  }
  
  float distanceCM = duration * 0.034 / 2;
  float distanceInches = distanceCM / 2.54;
  
  if (distanceInches < 2 || distanceInches > 120) {
    return -1;
  }
  
  return distanceInches;
}

float calculateWaterLevel() {
  float distInches = readDistanceInches();
  
  if (distInches < 0) {
    return lastValidWaterLevel;
  }
  
  // Store for display
  lastDisplayDistance = distInches;
  
  if (tankHeight <= 0) {
    return distInches;
  }
  
  float waterHeight = tankHeight - distInches;
  float level = (waterHeight / tankHeight) * 100.0;
  float constrainedLevel = constrain(level, 0, 100);
  
  lastValidWaterLevel = constrainedLevel;
  
  static int readCount = 0;
  readCount++;
  if (readCount >= 10) {
    readCount = 0;
    Serial.printf("Distance: %.1f in, Tank: %.1f in, Water: %.0f%%\n", 
                  distInches, tankHeight, constrainedLevel);
  }
  
  return constrainedLevel;
}

// ============ TDS SENSOR ============
float readTDS() {
  int raw = analogRead(TDS_PIN);
  float voltage = raw * 3.3 / 4095.0;
  float tds = (133.42 * voltage * voltage * voltage 
             - 255.86 * voltage * voltage 
             + 857.39 * voltage) * 0.5;
  return max(0.0f, tds);
}

// ============ SUPABASE FUNCTIONS ============
bool fetchDeviceId() {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/devices?system_key=eq." + DEVICE_SYSTEM_KEY + "&select=id,tank_height,tank_height_unit";
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, payload);
    if (doc.size() > 0) {
      deviceId = doc[0]["id"].as<String>();
      if (!doc[0]["tank_height"].isNull()) {
        tankHeight = doc[0]["tank_height"].as<float>();
        tankHeightUnit = doc[0]["tank_height_unit"].as<String>();
        calibrated = true;
        Serial.printf("✓ Tank height loaded: %.2f %s\n", tankHeight, tankHeightUnit.c_str());
      } else {
        Serial.println("⚠ Tank height is NULL in database");
      }
      http.end();
      return true;
    }
  }
  http.end();
  return false;
}

bool fetchPumpSettings() {
  if (deviceId.isEmpty()) return false;
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/pump_settings?device_id=eq." + deviceId + "&select=*";
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(1024);
    deserializeJson(doc, payload);
    if (doc.size() > 0) {
      pumpMode = doc[0]["pump_mode"].as<String>();
      upperThreshold = doc[0]["upper_threshold"].as<float>();
      lowerThreshold = doc[0]["lower_threshold"].as<float>();
      criticalThreshold = doc[0]["critical_threshold"].as<float>();
      http.end();
      return true;
    }
  }
  http.end();
  return false;
}

bool sendSensorData(float waterLevel, float tds, float pumpRuntime) {
  if (deviceId.isEmpty()) return false;
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_data";
  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");
  
  DynamicJsonDocument doc(512);
  doc["device_id"] = deviceId;
  doc["water_level"] = round(waterLevel * 10) / 10.0;
  doc["tds_value"] = round(tds * 10) / 10.0;
  doc["pump_status"] = pumpOn ? "on" : "off";
  doc["pump_mode"] = pumpMode;
  doc["pump_runtime"] = pumpRuntime;
  
  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  http.end();
  return code == 201;
}

// ============ PUMP CONTROL ============
void controlPump(float waterLevel) {
  if (pumpMode == "auto" && tankHeight > 0) {
    if (waterLevel <= lowerThreshold && !pumpOn) {
      pumpOn = true;
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("💧 Pump ON - Water level low");
    } else if (waterLevel >= upperThreshold && pumpOn) {
      pumpOn = false;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("💧 Pump OFF - Water level high");
    }
  }

  if (waterLevel <= criticalThreshold && waterLevel > 0 && tankHeight > 0) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER_PIN, 2000, 200);
  } else {
    digitalWrite(LED_RED, LOW);
    noTone(BUZZER_PIN);
  }

  digitalWrite(LED_GREEN, pumpOn ? HIGH : LOW);
}

// ============ LCD DISPLAY FUNCTIONS ============
void updateLCD_Calibration(float distance) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TANK HEIGHT:");
  lcd.setCursor(0, 1);
  if (distance > 0) {
    lcd.print(" ");
    lcd.print(distance, 1);
    lcd.print(" in  ");
    lcd.print("Set in App");
  } else {
    lcd.print(" No Sensor!");
  }
}

void updateLCD_Normal(float waterLevel, float tds, float rawDistance) {
  lcd.clear();
  
  // Line 1: Water Level and TDS
  lcd.setCursor(0, 0);
  if (tankHeight > 0) {
    lcd.print("Lvl:");
    lcd.print((int)waterLevel);
    lcd.print("%");
  } else {
    lcd.print("Dist:");
    lcd.print((int)rawDistance);
    lcd.print("in");
  }
  
  lcd.print(" TDS:");
  lcd.print((int)tds);
  
  // Line 2: Pump Status and Mode
  lcd.setCursor(0, 1);
  lcd.print("Pump:");
  lcd.print(pumpOn ? "ON " : "OFF");
  lcd.print(" ");
  lcd.print(pumpMode == "auto" ? "AUTO" : "MANUAL");
  
  // Show tank height if calibrated
  if (tankHeight > 0) {
    lcd.setCursor(12, 1);
    lcd.print("H:");
    lcd.print((int)tankHeight);
  }
}

// ============ SETUP MODE ============
void handleSetWifi() {
  String ssid = setupServer.arg("ssid");
  String pass = setupServer.arg("pass");

  if (ssid.length() == 0) {
    setupServer.send(400, "text/plain", "SSID required");
    return;
  }

  saveWifiCredentials(ssid, pass);
  setupServer.send(200, "text/plain", "OK. Connecting to " + ssid + "...");
  
  lcd.clear();
  lcd.print("Credentials");
  lcd.setCursor(0, 1);
  lcd.print("Saved! Rebooting");
  delay(2000);
  ESP.restart();
}

void handleRoot() {
  String html = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:#fff;}";
  html += "input{width:100%;padding:10px;margin:5px 0 15px;border-radius:8px;border:1px solid #333;background:#16213e;color:#fff;}";
  html += "button{width:100%;padding:12px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;}";
  html += "h2{color:#0ea5e9;}</style></head><body>";
  html += "<h2>Water Angel Setup</h2>";
  html += "<form action='/setwifi' method='GET'>";
  html += "<label>Wi-Fi Name (SSID):</label><input name='ssid' required>";
  html += "<label>Password:</label><input name='pass' type='password'>";
  html += "<button type='submit'>Connect Device</button>";
  html += "</form></body></html>";
  setupServer.send(200, "text/html", html);
}

void startSetupMode() {
  currentMode = MODE_SETUP;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("WaterAngel_Setup", "");
  
  setupServer.on("/", handleRoot);
  setupServer.on("/setwifi", handleSetWifi);
  setupServer.begin();

  lcd.clear();
  lcd.print("SETUP MODE");
  lcd.setCursor(0, 1);
  lcd.print("192.168.4.1");
  
  Serial.println("📡 AP Mode started: WaterAngel_Setup");
}

bool connectToWifi() {
  String ssid, pass;
  if (!loadWifiCredentials(ssid, pass)) return false;
  
  lcd.clear();
  lcd.print("Connecting...");
  lcd.setCursor(0, 1);
  lcd.print(ssid.substring(0, 16));
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected! IP: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    delay(1500);
    return true;
  }
  
  Serial.println("\n❌ Wi-Fi connection failed!");
  return false;
}

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n╔════════════════════════════════╗");
  Serial.println("║     WATER ANGEL FIRMWARE      ║");
  Serial.println("╚════════════════════════════════╝\n");
  
  // Disable GPIO2 to prevent errors
  pinMode(2, INPUT);
  digitalWrite(2, LOW);
  
  // Initialize pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(TDS_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(SETUP_BUTTON, INPUT_PULLUP);
  
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  
  // Test ultrasonic sensor
  Serial.println("📡 Testing ultrasonic sensor...");
  int successCount = 0;
  for(int i = 0; i < 5; i++) {
    float test = readDistanceInches();
    if(test > 0) {
      Serial.printf("  ✓ Test %d: %.2f inches\n", i+1, test);
      successCount++;
    } else {
      Serial.printf("  ✗ Test %d: No echo\n", i+1);
    }
    delay(200);
  }
  Serial.printf("  Success rate: %d/5\n\n", successCount);
  
  // LCD init
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.print("Water Angel");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  delay(1000);
  
  // Connect to WiFi
  if (connectToWifi()) {
    // Fetch device info
    if (fetchDeviceId()) {
      if (calibrated && tankHeight > 0) {
        currentMode = MODE_NORMAL;
        fetchPumpSettings();
        lcd.clear();
        lcd.print("System Ready!");
        lcd.setCursor(0, 1);
        lcd.print("Height: ");
        lcd.print(tankHeight, 1);
        lcd.print("\"");
        Serial.printf("✅ System ready! Tank height: %.1f inches\n", tankHeight);
        delay(2000);
      } else {
        currentMode = MODE_CALIBRATION;
        lcd.clear();
        lcd.print("CALIBRATION");
        lcd.setCursor(0, 1);
        lcd.print("Set height in app");
        Serial.println("⚠ Calibration mode - Set tank height in Supabase");
        delay(2000);
      }
    } else {
      lcd.clear();
      lcd.print("Device not found");
      lcd.setCursor(0, 1);
      lcd.print("Check system key");
      Serial.println("❌ Device not found in database!");
      delay(3000);
      currentMode = MODE_NORMAL;
    }
  } else {
    startSetupMode();
  }
}

void loop() {
  unsigned long now = millis();
  
  // Check setup button (hold 3 seconds)
  if (digitalRead(SETUP_BUTTON) == LOW) {
    if (!buttonHeld) {
      buttonPressStart = now;
      buttonHeld = true;
    } else if (now - buttonPressStart >= 3000) {
      clearWifiCredentials();
      lcd.clear();
      lcd.print("Entering Setup");
      lcd.setCursor(0, 1);
      lcd.print("Mode...");
      delay(1000);
      startSetupMode();
      buttonHeld = false;
    }
  } else {
    buttonHeld = false;
  }

  // ========== SETUP MODE ==========
  if (currentMode == MODE_SETUP) {
    setupServer.handleClient();
    digitalWrite(LED_RED, (millis() / 500) % 2);
    return;
  }

  // ========== CALIBRATION MODE ==========
  if (currentMode == MODE_CALIBRATION) {
    if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
      lastDisplayUpdate = now;
      float distance = readDistanceInches();
      updateLCD_Calibration(distance);
      
      // Print to serial every few seconds
      static unsigned long lastSerialPrint = 0;
      if (now - lastSerialPrint >= 5000) {
        lastSerialPrint = now;
        if (distance > 0) {
          Serial.printf("📏 Calibration - Distance to water: %.2f inches\n", distance);
        } else {
          Serial.println("⚠ Calibration - No sensor reading!");
        }
      }
    }
    
    // Poll database for tank_height
    if (now - lastSettingsPoll >= SETTINGS_POLL_INTERVAL) {
      lastSettingsPoll = now;
      if (fetchDeviceId() && calibrated && tankHeight > 0) {
        currentMode = MODE_NORMAL;
        fetchPumpSettings();
        lcd.clear();
        lcd.print("Calibrated!");
        lcd.setCursor(0, 1);
        lcd.print("Height: ");
        lcd.print(tankHeight, 1);
        lcd.print("\"");
        Serial.printf("✅ Calibration complete! Tank height: %.1f inches\n", tankHeight);
        delay(2000);
      }
    }
    return;
  }

  // ========== NORMAL MODE ==========
  if (now - lastUltrasonicRead >= ULTRASONIC_INTERVAL) {
    lastUltrasonicRead = now;
    
    // Read sensors
    float rawDistance = readDistanceInches();
    float waterLevel = calculateWaterLevel();
    float tds = readTDS();
    
    // Control pump
    controlPump(waterLevel);
    
    // Update LCD
    if (now - lastDisplayUpdate >= DISPLAY_INTERVAL) {
      lastDisplayUpdate = now;
      updateLCD_Normal(waterLevel, tds, rawDistance);
    }
    
    // Sync data to Supabase
    if (now - lastDataSync >= DATA_SYNC_INTERVAL) {
      lastDataSync = now;
      float runtime = pumpOn ? DATA_SYNC_INTERVAL / 1000.0 : 0;
      if (tankHeight > 0) {
        if (sendSensorData(waterLevel, tds, runtime)) {
          Serial.printf("📤 Data sent: Level=%.0f%%, TDS=%.0f, Pump=%s\n", 
                        waterLevel, tds, pumpOn ? "ON" : "OFF");
        }
      } else {
        // Still show distance if not calibrated
        if (rawDistance > 0) {
          Serial.printf("📏 Distance: %.1f inches (not calibrated)\n", rawDistance);
        }
      }
    }
  }
  
  // Poll settings from database
  if (now - lastSettingsPoll >= SETTINGS_POLL_INTERVAL) {
    lastSettingsPoll = now;
    if (tankHeight > 0) {
      fetchPumpSettings();
    }
  }
}