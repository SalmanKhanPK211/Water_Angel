 # Water Angel - Circuit Diagram & System Guide

## 📋 Components Required

| # | Component | Qty | Notes |
|---|-----------|-----|-------|
| 1 | ESP32 Dev Board (30-pin) | 1 | Main controller |
| 2 | HC-SR04 Ultrasonic Sensor | 1 | Water level measurement |
| 3 | TDS Sensor Module (Analog) | 1 | Water quality |
| 4 | 5V Relay Module (1-channel) | 1 | Pump control |
| 5 | I2C LCD 16x2 (with PCF8574) | 1 | Display |
| 6 | Green LED | 1 | Pump ON indicator |
| 7 | Red LED | 1 | Critical alarm |
| 8 | Active Buzzer (5V) | 1 | Alarm sound |
| 9 | Push Button | 1 | Setup mode trigger |
| 10 | 220Ω Resistor | 2 | For LEDs |
| 11 | 10KΩ Resistor | 1 | Pull-up for button |
| 12 | Breadboard + Jumpers | - | Wiring |
| 13 | 5V Power Supply | 1 | For ESP32 + relay |
| 14 | Water Pump (12V/5V) | 1 | Submersible pump |

---

## 🔌 Wiring Connections

### HC-SR04 Ultrasonic Sensor
```
HC-SR04          ESP32
─────────────────────────
VCC    ────────  5V (VIN)
GND    ────────  GND
TRIG   ────────  GPIO 26
ECHO   ────────  GPIO 27
```
> ⚠️ Mount sensor at the TOP of the tank, facing downward.

### TDS Sensor Module
```
TDS Module       ESP32
─────────────────────────
VCC    ────────  3.3V
GND    ────────  GND
AOUT   ────────  GPIO 34 (Analog)
```
> Probe goes INTO the water.

### 5V Relay Module (Pump Control)
```
Relay Module     ESP32
─────────────────────────
VCC    ────────  5V (VIN)
GND    ────────  GND
IN     ────────  GPIO 15

Relay Output Side:
COM    ────────  Pump Power (+)
NO     ────────  Power Supply (+)
               (Pump GND connects directly to Power Supply GND)
```

### I2C LCD (16x2)
```
LCD (I2C)        ESP32
─────────────────────────
VCC    ────────  5V (VIN)
GND    ────────  GND
SDA    ────────  GPIO 21
SCL    ────────  GPIO 22
```
> Default I2C address: 0x27. If not working, try 0x3F.

### LEDs
```
Green LED        ESP32
─────────────────────────
(+) Anode ──── 220Ω ──── GPIO 19
(-) Cathode ────────────  GND

Red LED          ESP32
─────────────────────────
(+) Anode ──── 220Ω ──── GPIO 18
(-) Cathode ────────────  GND
```

### Buzzer
```
Buzzer           ESP32
─────────────────────────
(+)    ────────  GPIO 23
(-)    ────────  GND
```

### Setup Button
```
Button           ESP32
─────────────────────────
One leg ───────  GPIO 33
Other leg ─────  GND
```
> Uses internal pull-up resistor (INPUT_PULLUP).

---

---

## ⚙️ How the System Works

### Phase 1: First Boot (Setup Mode)
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Power ON   │────►│ No saved     │────►│ Start AP:   │
│  ESP32      │     │ Wi-Fi creds? │ YES │ WaterAngel_ │
│             │     │              │     │ Setup       │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                    ┌──────────────┐              │
                    │ User connects│◄─────────────┘
                    │ phone to AP  │
                    │ Opens app    │
                    │ or browser   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │ Sends SSID & │────►│ ESP32 saves │
                    │ Password via │     │ to EEPROM & │
                    │ HTTP request │     │ reboots     │
                    └──────────────┘     └─────────────┘
```

### Phase 2: Calibration Mode
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Wi-Fi       │────►│ Fetch device │────►│ tank_height  │
│ Connected!  │     │ from DB      │     │ is NULL?     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │ YES
                                          ┌──────▼───────┐
                                          │ CALIBRATION  │
                                          │ LCD shows    │
                                          │ raw distance │
                                          │ in inches    │
                                          └──────┬───────┘
                                                 │
                    ┌──────────────┐              │
                    │ User enters  │◄─────────────┘
                    │ tank height  │  (poll DB every 10s)
                    │ in the app   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Switch to    │
                    │ NORMAL mode  │
                    └──────────────┘
```

### Phase 3: Normal Operation
```
    ┌─────────────────────────────────────┐
    │         NORMAL MODE LOOP            │
    │                                     │
    │  Every 1 second:                    │
    │  ├─ Read ultrasonic → water level   │
    │  ├─ Read TDS → water quality        │
    │  ├─ Update LCD display              │
    │  └─ Control pump (AUTO mode):       │
    │      ├─ Level ≤ lower → Pump ON     │
    │      ├─ Level ≥ upper → Pump OFF    │
    │      └─ Level ≤ critical → ALARM!   │
    │                                     │
    │  Every 10 seconds:                  │
    │  └─ Poll pump_settings from DB      │
    │     (mode, thresholds)              │
    │                                     │
    │  Every 30 seconds:                  │
    │  └─ Send sensor data to DB          │
    │     (level, TDS, pump status)       │
    │                                     │
    │  Button held 3 seconds:             │
    │  └─ Clear Wi-Fi → Enter Setup Mode  │
    └─────────────────────────────────────┘
```

### Data Flow Overview
```
    ┌──────────┐        ┌───────────┐        ┌──────────────┐
    │  ESP32   │──POST──►│  Supabase │◄──GET──│  Water Angel │
    │ Hardware │        │  Database  │        │   Mobile App │
    │          │◄─GET───│           │        │              │
    └──────────┘        └───────────┘        └──────────────┘
    
    ESP32 SENDS:                    APP READS:
    • sensor_data (level, TDS)      • sensor_data (charts)
    • pump status                   • alerts
                                    • device info
    ESP32 READS:                    
    • pump_settings                 APP WRITES:
    • device config (tank_height)   • pump_settings
                                    • tank_height (calibration)
                                    • alerts preferences
```

---

## 🔧 Arduino IDE Libraries Required

Install these via Library Manager:
1. **LiquidCrystal_I2C** by Frank de Brabander
2. **ArduinoJson** by Benoit Blanchon (v6+)
3. **WiFi** (built-in with ESP32 board)
4. **WebServer** (built-in with ESP32 board)
5. **HTTPClient** (built-in with ESP32 board)
6. **EEPROM** (built-in with ESP32 board)

### ESP32 Board Setup
1. Add ESP32 board URL in Arduino IDE Preferences:
   `https://dl.espressif.com/dl/package_esp32_index.json`
2. Install "ESP32 by Espressif Systems" from Board Manager
3. Select board: "ESP32 Dev Module"
4. Upload speed: 115200

---

## 🛡️ Safety Notes

1. **Water + Electricity**: Keep all electronics ABOVE water line. Only the TDS probe and ultrasonic sensor face should be near water.
2. **Relay for Pump**: Use relay rated for your pump's voltage/current. For high-power pumps (>5A), use a relay module with optocoupler isolation.
3. **Power Supply**: Use a stable 5V 2A+ supply for ESP32. Pump should have separate power if >12V.
4. **Waterproofing**: Enclose electronics in a waterproof box. Use cable glands for sensor wires.
