
# 💧 Water Angel

### IoT Smart Water Monitoring & Management System


**Autonomous · Offline-First · Dual-Core · Cloud-Connected**

[🌐 Live PWA](https://water-angel.vercel.app) · [📁 Repository](https://github.com/SalmanKhanPK211/Water_Angel) · [👤 Portfolio](https://salman-khan-data-scientist.vercel.app)



---

## 📋 Table of Contents


- [Project Overview]
- [Problem Statement]
- [Proposed Solution]
- [Project Highlights]
- [Features]
- [System Architecture]
- [Data Flow]
- [Project Workflow]
- [Hardware Components]
- [Software Stack]
- [Firmware Architecture]
- [Automatic Pump Logic]
- [Offline-First Architecture]
- [Dual-Core FreeRTOS]
- [Progressive Web Application]
- [Cloud Infrastructure]
- [Repository Structure]
- [Screenshots]
- [Installation & Setup]
- [Usage Guide]
- [Engineering Challenges]
- [Benefits]
- [Project Evolution]
- [Live Demonstration]
- [Future Enhancements]
- [Contributors]
- [License]



---

## 🌊 Project Overview

**Water Angel** is a production-grade, offline-first IoT system designed to autonomously monitor and manage household water storage tanks. Built around the Espressif ESP32 microcontroller and a cloud backend powered by Supabase, the system combines embedded firmware engineering, real-time sensor fusion, cloud synchronization, and a Progressive Web Application into a unified, reliable water management solution.

The system continuously measures **water level** via ultrasonic sensing and **water quality** via TDS (Total Dissolved Solids) analysis. Based on configurable thresholds, it automatically controls the water pump — preventing overflow, eliminating underflow, protecting pump hardware from dry-running, and flagging contaminated water — all without any human intervention.

What sets Water Angel apart from conventional smart home sensors is its **Offline-First Architecture**: all critical decision-making, sensor processing, pump control, and alerting logic runs entirely on the ESP32 without requiring an active internet connection. Cloud synchronization with Supabase and remote monitoring through the PWA are seamlessly layered on top as enhanced capabilities, not prerequisites.

The firmware (v4) implements a **Dual-Core FreeRTOS Architecture** that distributes workload across both physical cores of the ESP32, eliminating the class of timing bugs where slow HTTPS calls to Supabase would freeze the sensor loop and delay pump control — a real-world defect that caused measurable tank overflow during field testing.

> **University of Swabi — Department of Computer Science**
> BS Computer Science, Batch 12 — Semester 4 Final Year Project
> Successfully demonstrated live before the Higher Education Commission (HEC) evaluation panel

---

## ❗ Problem Statement

In Pakistan and across the developing world, water storage tank management remains a predominantly manual, error-prone process. Homes, educational institutions, apartment buildings, and small industries all rely on overhead or underground tanks filled by electric motor pumps — and nearly all of them operate on guesswork.

### 🚱 Water Overflow
The most prevalent failure mode: a user starts the pump and forgets to switch it off. The tank overflows, wasting clean water and causing structural damage to rooftops, walls, and electrical infrastructure. Pakistan's National Water Policy identifies household wastage as a leading driver of the country's trajectory toward absolute water scarcity.

### 🔧 Manual Pump Operation
Every fill cycle requires a human to consciously monitor the tank, walk to the motor room, and physically toggle a switch. This dependency on human attention creates consistent failure points — particularly at night, during absences, or in elderly households — and provides no safeguard against distraction or forgetfulness.

### ⚡ Electricity Wastage
Pumps running past full capacity draw current against a closed system. Extended unnecessary runtimes also accelerate motor wear, increasing replacement frequency and long-term cost. In regions where electricity is metered carefully, uncontrolled pump runtime has measurable economic impact.

### 🔕 Lack of Remote Monitoring
Users have no visibility into tank status while away from home. There is no way to verify whether the tank was filled before leaving, whether the pump is currently running, or whether a failure has occurred — short of physically returning or asking someone else to check.

### 📉 No Analytics or Usage Patterns
Without data logging, users cannot identify peak consumption windows, track daily and weekly usage trends, measure pump cycle frequency, or make informed decisions about water conservation. This absence of data makes any intelligent planning impossible.

### 🧪 Poor Water Quality Awareness
Groundwater contamination in Pakistan is a documented public health crisis, with high TDS levels linked to kidney disease and gastrointestinal illness. Conventional tank systems provide zero indication of water quality — users have no mechanism to detect contamination before it reaches the tap.

### ☁️ No Cloud Connectivity or Historical Records
All events — overflow incidents, dry runs, pump cycles — are unrecorded. There is no historical audit trail, no timestamped data, and no mechanism to analyse trends over time or share data across family members using different devices.

### 🧠 No Offline Intelligence
The few commercial IoT water controllers that exist in the market require constant internet connectivity and fail silently when the network goes down. In environments with unreliable infrastructure — load-shedding, intermittent mobile data — these systems offer no guarantee of continued protection.

---

## 💡 Proposed Solution

Water Angel addresses every identified failure mode through an integrated system of hardware sensing, embedded intelligence, cloud services, and a remote interface:

```
┌─────────────────────────────────────────────────────────────────┐
│                      WATER ANGEL SYSTEM                         │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Ultrasonic  │    │  TDS Sensor  │    │   Setup Button   │  │
│  │   Sensor     │    │  (Analog)    │    │   (WiFi Config)  │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                      │             │
│         └──────────────────┴──────────────────────┘            │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │   ESP32-WROOM   │                          │
│                   │  (Dual-Core)    │                          │
│                   │  FreeRTOS v4    │                          │
│                   └──┬───────────┬──┘                          │
│                      │           │                             │
│           ┌──────────▼──┐    ┌───▼──────────┐                 │
│           │  Core 1     │    │  Core 0      │                 │
│           │  Sensor &   │    │  Cloud &     │                 │
│           │  Control    │    │  Network     │                 │
│           └──────┬──────┘    └──────┬───────┘                 │
│                  │                  │                          │
│         ┌────────▼──────┐    ┌──────▼────────┐                │
│         │  Relay Module │    │   Supabase    │                │
│         │  (Pump ON/OFF)│    │   (Cloud DB)  │                │
│         └───────────────┘    └──────┬────────┘                │
│                                     │                          │
│                              ┌──────▼────────┐                │
│                              │  Water Angel  │                │
│                              │  PWA (Vercel) │                │
│                              └──────┬────────┘                │
│                                     │                          │
│                              ┌──────▼────────┐                │
│                              │     User      │                │
│                              │ (Any Browser) │                │
│                              └───────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

The ESP32 runs two parallel FreeRTOS tasks. **Core 1** handles time-critical sensor reads and pump switching every 500 ms, independently of network state. **Core 0** handles all cloud communication asynchronously. Users interact with the system through a 5-tab Progressive Web Application. All configuration persists to EEPROM so the system survives power cycles and internet outages without losing calibration.

---

## ✨ Project Highlights

| Feature | Description | Status |
|---|---|---|
| 🔄 **Offline-First Architecture** | Full pump control & monitoring without internet | ✅ Production |
| ⚡ **Dual-Core ESP32 Firmware** | FreeRTOS tasks on Core 0 & Core 1 simultaneously | ✅ v4.0 |
| 📱 **Progressive Web Application** | 5-tab PWA accessible from any mobile browser | ✅ Live |
| 🤖 **Automatic Pump Control** | Threshold-based ON/OFF with hysteresis | ✅ Production |
| 🧪 **Water Quality Monitoring** | Real-time TDS sensing with Safe/Unsafe flagging | ✅ Production |
| ☁️ **Cloud Synchronization** | Supabase real-time sync every 30 seconds | ✅ Production |
| 📊 **Smart Analytics Dashboard** | 7-day trends, efficiency score, weekly report | ✅ Live |
| 🔔 **Real-Time Alerts** | Overflow, leak, critical level, high TDS | ✅ Production |
| 🕹️ **Manual Override** | Remote pump ON/OFF via PWA in manual mode | ✅ Production |
| 📡 **WiFi Provisioning** | Captive portal setup via `WaterAngel_Setup` AP | ✅ Production |
| 🔗 **Device Pairing** | Secure hardware-to-account linking via Device Key | ✅ Production |
| 💾 **EEPROM Persistence** | Config survives reboots and power outages | ✅ Production |
| 🖥️ **Local LCD Display** | 16×2 I2C display for offline status feedback | ✅ Production |
| 🔒 **Mutex-Protected Shared State** | Thread-safe cross-core data access via FreeRTOS | ✅ v4.0 |
| 📈 **Pump Runtime Tracking** | Monotonic runtime counter, per-sync delta reporting | ✅ v4.0 |

---

## 🛠️ Features

### 🔩 Hardware Features

- **Ultrasonic Water Level Sensing**: HC-SR04 mounted at the top of the tank continuously measures the air-to-water distance. The ESP32 converts this to a percentage based on the configured tank height, with automatic clamping between 0% and 100%.
- **TDS Water Quality Monitoring**: An analog TDS probe measures the concentration of dissolved solids in parts per million (ppm). Readings above 600 ppm trigger critical alerts and flag water as unsafe.
- **Relay-Driven Pump Control**: A 5V single-channel relay module provides electrically isolated switching of the water pump. The relay is fail-safe: it defaults to open (pump OFF) at power-on.
- **16×2 I2C LCD**: Displays water level percentage, TDS reading, pump status (ON/OFF), operating mode (AUTO/MANUAL), and WiFi connectivity status. All information is available offline without any network dependency.
- **LED Indicators**: Green LED indicates pump activity and normal operation. Red LED signals critical conditions (water level below critical threshold, TDS above 600 ppm). Both LEDs operate independently of network status.
- **Active Buzzer**: Provides audible alerts during critical events. Implements a non-blocking beep state machine so alarms do not interfere with the 50 ms sensor cycle.
- **Setup Button**: Holding the button for 3 seconds initiates WiFi provisioning mode, creating a captive portal AP named `WaterAngel_Setup`. Credential changes do not require reflashing firmware.
- **EEPROM Storage**: Persists WiFi credentials, tank height, upper threshold, lower threshold, critical threshold, and calibration flags across power cycles and firmware restarts.

### ⚙️ Firmware Features

- **Dual-Core FreeRTOS Task Architecture**: `sensorTask` pinned to Core 1 at priority 2; `cloudTask` pinned to Core 0 at priority 1.
- **Non-Blocking Sensor Loop**: Pump control decisions are made every 500 ms unconditionally, regardless of network activity.
- **Non-Blocking Beep Engine**: Beep timing implemented as a state machine with `millis()`-based scheduling, never using `delay()`.
- **Non-Blocking WiFi State Machine**: WiFi connection management is an enum-driven state machine (`WIFI_IDLE → WIFI_CONNECTING → WIFI_CONNECTED / WIFI_FAILED`) with 30-second reconnection retry.
- **FreeRTOS Queues**: `toCloudQueue` (SensorSnapshot, depth 1) and `toSensorQueue` (CloudSettings, depth 1) with `xQueueOverwrite` semantics for always-fresh data.
- **Mutex-Protected Shared Globals**: All shared state (`tankHeight`, thresholds, `pumpMode`, `wifiOnline`, `cloudCalibrationMode`, `deviceId`) protected by `sharedMutex`.
- **HTTPS Security**: All Supabase communication uses TLS via `WiFiClientSecure`. Per-request socket teardown prevents half-closed TLS reuse bugs.
- **Offline-First Pump Logic**: If the internet is unavailable, `controlPump()` continues running using EEPROM-persisted thresholds. Cloud settings are applied incrementally as they arrive.
- **Monotonic Runtime Counter**: `totalRuntimeMs` accumulates pump ON-time exclusively in `sensorTask` (Core 1). The cloud task reads runtime via `SensorSnapshot` queue copy, never directly.
- **WiFi Provisioning Captive Portal**: When in Setup Mode, the ESP32 creates a standalone AP, serves a responsive HTML form, saves credentials to EEPROM on submission, and auto-restarts.

### 📱 Progressive Web Application Features

- **Real-Time Dashboard**: Live tank fill gauge, water level %, TDS reading with Safe/Unsafe badge, pump status, and last update timestamp.
- **24-Hour History Chart**: Line chart of water level over the last 24 hours, rendered from Supabase time-series data.
- **Smart Insights Engine**: Auto-generated recommendations including estimated time to empty, peak usage window identification, and refill timing suggestions.
- **7-Day Analytics**: Water level history trend, daily consumption bars, TDS quality trend, pump activity chart, and a Water Efficiency Score (0–100).
- **Weekly Smart Report**: Automated weekly digest of total water used, average daily consumption, highest usage day, average TDS, and pump activation count.
- **Pump Control Panel**: Toggle between AUTO and MANUAL modes. In MANUAL mode, Turn ON / Turn OFF buttons send commands via Supabase which the ESP32 polls every 10 seconds.
- **Threshold Configuration**: Sliders for Upper Threshold (Pump OFF), Lower Threshold (Pump ON), and Critical Threshold (Alert) with live percentage display and Supabase persistence.
- **Tank Height Calibration**: Input for tank height in inches or centimeters. Value is synced to Supabase and pulled by the ESP32 on next settings poll.
- **Alert Feed**: Timestamped, categorized alert log. Types include Critical Water Level, High TDS, Sudden Level Drop (leak detection), and Pump Status changes.
- **Device Pairing**: Each hardware unit is assigned a unique Device Key during registration. The PWA links to a hardware device by entering this key, establishing a secure one-to-one mapping.
- **WiFi Credential Update**: Remote WiFi configuration change flow — sends new credentials to Supabase, which the ESP32 retrieves and writes to EEPROM on next sync.
- **Push Notification Preferences**: Independent toggles for Low Water Alerts, High TDS Alerts, Pump Status Alerts, and Anomaly Detection alerts.
- **Offline PWA Support**: The application shell is cached for offline viewing. Live data requires connectivity but the UI remains accessible.

### ☁️ Cloud Features

- **Real-Time Data Sync**: Sensor readings (water level, TDS, pump status, runtime) are posted to Supabase every 30 seconds when online.
- **Settings Distribution**: Pump mode, thresholds, tank height, and manual commands are stored in Supabase and pulled by the ESP32 every 10 seconds.
- **Device Registry**: Each physical device is registered in the `devices` table with its system key, tank configuration, and calibration mode flag.
- **PostgreSQL Time-Series Storage**: `sensor_data` table stores all readings with device ID and timestamp, enabling trend queries, efficiency scoring, and historical charting.
- **REST API**: All ESP32–Supabase communication uses standard Supabase REST (`/rest/v1/`) with `apikey` header authentication and `Bearer` token authorization.
- **Row-Level Security**: Supabase RLS policies ensure each device can only read and write its own data rows.
- **Vercel Deployment**: PWA is deployed and served from Vercel with automatic HTTPS, CDN edge caching, and zero-downtime deployments.

### 📊 Analytics Features

- **Water Efficiency Score**: A 0–100 composite metric derived from overflow frequency, pump duty cycle, peak-to-average ratio, and TDS trend direction.
- **Consumption Trend Analysis**: 7-day rolling consumption bar chart, with day-of-week breakdown and highest usage day identification.
- **TDS Quality Trend**: 7-day TDS trend line with Improving/Degrading/Stable classification.
- **Pump Activity Monitoring**: Bar chart of pump activation frequency per day, helping identify abnormal cycling patterns indicative of leaks or threshold misconfiguration.
- **Data Insights Panel**: Estimated time to empty, peak usage period (e.g., 16:00–17:00), average weekly TDS, and quality trend direction.
- **Recommendations Engine**: Automated text recommendations (e.g., "Refill tank before evening peak usage", "TDS elevated — consider checking source water quality").

### 🔌 Offline Features

- **Local Pump Control**: `controlPump()` runs every 500 ms using EEPROM-cached thresholds regardless of internet status.
- **Local Alerting**: Red LED and buzzer activate on critical water level or high TDS without any cloud dependency.
- **EEPROM Configuration Persistence**: All settings survive power cuts and network outages.
- **LCD Status Display**: Full local visibility of system state without requiring a phone or internet connection.
- **Automatic Cloud Resync**: When connectivity is restored, all pending sensor data is synced and updated settings are pulled without user intervention.

### 🔐 Security Features

- **HTTPS-Only Cloud Communication**: All Supabase API calls use TLS 1.2/1.3 via `WiFiClientSecure` with per-request socket lifecycle management.
- **API Key Authentication**: Supabase `apikey` and `Bearer` token headers on every request.
- **Device Key Pairing**: Hardware units are identified by a unique device key that must be entered in the PWA, preventing unauthorized devices from appearing in a user's dashboard.
- **EEPROM Credential Storage**: WiFi passwords are stored in ESP32 EEPROM, not hardcoded in firmware, enabling credential rotation without reflashing.
- **No Credentials in Codebase**: The firmware reads all secrets from EEPROM at runtime; no WiFi password or API key appears in the source tree in plaintext (except the Supabase anonymous key, which is intentionally public under RLS).

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WATER ANGEL ECOSYSTEM                           │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     HARDWARE LAYER                              │  │
│  │                                                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │  HC-SR04     │  │  TDS Sensor  │  │  Setup Button        │  │  │
│  │  │  Ultrasonic  │  │  (Analog 34) │  │  (GPIO 33)           │  │  │
│  │  │  TRIG:26     │  │              │  │                      │  │  │
│  │  │  ECHO:27     │  │              │  │                      │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │  │
│  │         │                 │                     │               │  │
│  │         └─────────────────┴─────────────────────┘               │  │
│  │                           │                                     │  │
│  │              ┌────────────▼─────────────┐                       │  │
│  │              │     ESP32-WROOM-32        │                       │  │
│  │              │   240 MHz Dual-Core LX6   │                       │  │
│  │              │   FreeRTOS v4 Firmware    │                       │  │
│  │              │   520 KB SRAM / 4 MB Flash│                       │  │
│  │              └────────────┬─────────────┘                       │  │
│  │                           │                                     │  │
│  │  ┌─────────┐ ┌──────────┐ │ ┌───────────────┐  ┌────────────┐  │  │
│  │  │5V Relay │ │16×2 I2C  │ │ │ Green LED     │  │ Red LED +  │  │  │
│  │  │GPIO 15  │ │LCD 0x27  │ │ │ GPIO 19       │  │ Buzzer     │  │  │
│  │  │         │ │          │ │ │ (Pump ON)     │  │ GPIO 18/23 │  │  │
│  │  └────┬────┘ └──────────┘ │ └───────────────┘  └────────────┘  │  │
│  │       │                   │                                     │  │
│  │  ┌────▼────┐         ┌────▼─────────────────────────────────┐  │  │
│  │  │  Water  │         │          WiFi 802.11 b/g/n            │  │  │
│  │  │  Pump   │         └──────────────────┬───────────────────┘  │  │
│  │  └─────────┘                            │                      │  │
│  └──────────────────────────────────────────│──────────────────────┘  │
│                                             │                          │
│  ┌──────────────────────────────────────────▼──────────────────────┐  │
│  │                      CLOUD LAYER                                │  │
│  │                                                                 │  │
│  │    ┌─────────────────────────────────────────────────────┐     │  │
│  │    │              Supabase (PostgreSQL)                  │     │  │
│  │    │                                                     │     │  │
│  │    │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │     │  │
│  │    │  │  devices     │  │ pump_settings│  │sensor_   │  │     │  │
│  │    │  │  table       │  │  table       │  │data table│  │     │  │
│  │    │  └──────────────┘  └──────────────┘  └──────────┘  │     │  │
│  │    └─────────────────────────────────────────────────────┘     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                             │                          │
│  ┌──────────────────────────────────────────▼──────────────────────┐  │
│  │                   APPLICATION LAYER                             │  │
│  │                                                                 │  │
│  │         Water Angel PWA (Vercel / React / TypeScript)          │  │
│  │                                                                 │  │
│  │    ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌───────┐ ┌───────┐  │  │
│  │    │  Home   │ │ Analytics │ │ Control │ │Alerts │ │Profile│  │  │
│  │    └─────────┘ └───────────┘ └─────────┘ └───────┘ └───────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 Data Flow

### Sensor → User (Upward Flow)

```
┌───────────────────────────────────────────────────────────────┐
│                      UPWARD DATA FLOW                         │
│                                                               │
│  ┌────────────────────┐                                       │
│  │  Sensors           │                                       │
│  │  HC-SR04 → level % │──── Every 500ms ──────────────────┐  │
│  │  TDS → ppm         │                                    │  │
│  └────────────────────┘                                    │  │
│                                                            ▼  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              ESP32 Core 1 (sensorTask)                 │   │
│  │  calcWaterLevel() → controlPump() → lcdNormal()        │   │
│  │  SensorSnapshot { level, tds, pumpOn, runtimeMin }     │   │
│  └──────────────────────────┬─────────────────────────────┘   │
│                             │ xQueueOverwrite (toCloudQueue)   │
│                             ▼                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              ESP32 Core 0 (cloudTask)                  │   │
│  │  sendSensorData() → POST /rest/v1/sensor_data          │   │
│  │  Every 30 seconds when WiFi connected                  │   │
│  └──────────────────────────┬─────────────────────────────┘   │
│                             │ HTTPS POST                       │
│                             ▼                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Supabase (PostgreSQL)                     │   │
│  │  sensor_data: {device_id, water_level, tds_value,      │   │
│  │                pump_status, pump_mode, pump_runtime,   │   │
│  │                created_at}                             │   │
│  └──────────────────────────┬─────────────────────────────┘   │
│                             │ REST API                         │
│                             ▼                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Water Angel PWA (Vercel)                  │   │
│  │  Real-time dashboard, analytics, alerts                │   │
│  └──────────────────────────┬─────────────────────────────┘   │
│                             │ Browser                          │
│                             ▼                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                     User                               │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### User → Pump (Downward Command Flow)

```
┌───────────────────────────────────────────────────────────────┐
│                    DOWNWARD COMMAND FLOW                       │
│                                                               │
│  User (PWA) ──► Sets pump mode or threshold                   │
│       │                                                        │
│       ▼                                                        │
│  Supabase: UPDATE pump_settings SET pump_mode='MANUAL',        │
│                                    pump_status='ON'            │
│       │                                                        │
│       ▼ (polled every 10s by cloudTask)                        │
│  ESP32 Core 0: fetchPumpSettings()                             │
│  Builds CloudSettings { pumpMode, upper, lower, critical,      │
│                          hasManualCmd, pumpOnManual }          │
│       │                                                        │
│       ▼ xQueueOverwrite (toSensorQueue)                        │
│  ESP32 Core 1: Receives CloudSettings on next 50ms tick        │
│  Calls setPump(true) or setPump(false)                         │
│       │                                                        │
│       ▼                                                        │
│  Relay Module: digitalWrite(RELAY_PIN, LOW)  ← Pump ON         │
│       │                                                        │
│       ▼                                                        │
│  Water Pump: Running                                           │
└───────────────────────────────────────────────────────────────┘
```

> **⏱️ End-to-end command latency (user tap → relay close):** approximately 10–12 seconds under normal network conditions (10-second Supabase poll interval + 50 ms task cycle + relay switching time).

---

## ⚙️ Project Workflow

A complete operational cycle of Water Angel from power-on to steady-state operation:

**1. Power-On Initialization**
The ESP32 boots, initializes all GPIO pins, activates the LCD backlight, and immediately sets the relay to HIGH (pump OFF) before any other logic runs — a deliberate safety default.

**2. EEPROM Configuration Load**
`loadCalibration()` reads tank height, upper/lower/critical thresholds, and the calibration flag from EEPROM. `loadWifi()` reads stored WiFi credentials. If valid data exists, the system is fully configured before any network contact.

**3. Setup Button Check**
If the Setup Button is held at boot, `clearWifi()` is called and the system enters Setup Mode as an AP. Otherwise normal mode proceeds.

**4. Dual-Core Task Launch**
`sensorTask` is pinned to Core 1 at priority 2. `cloudTask` is pinned to Core 0 at priority 1. FreeRTOS scheduler takes over; `loop()` becomes permanently idle.

**5. Core 1 — Continuous Sensor Loop (every 500 ms)**
`calcWaterLevel()` fires the ultrasonic pulse, reads echo duration, converts to distance, and divides by configured tank height to produce a percentage. `readTDS()` averages 10 ADC samples and applies the TDS polynomial calibration formula. `controlPump()` applies threshold logic and drives the relay. The LCD is updated every 1000 ms.

**6. Core 1 — Queue Processing (every 50 ms tick)**
The task checks `toSensorQueue` for any `CloudSettings` payload. If one exists, it atomically updates shared globals under `sharedMutex`, writes to EEPROM if calibration data changed, and executes any pending manual pump command.

**7. Core 0 — WiFi Management (every 10 s)**
`updateWifiConnection()` checks the WiFi state machine. On disconnect, triggers reconnection after `WIFI_RETRY_MS` (30 s).

**8. Core 0 — Settings Poll (every 10 s)**
`fetchDeviceInfo()` issues a GET to `/rest/v1/devices`. `fetchPumpSettings()` issues a GET to `/rest/v1/pump_settings`. Results are packed into a `CloudSettings` struct and sent via `xQueueOverwrite(toSensorQueue)`.

**9. Core 0 — Data Sync (every 30 s)**
`xQueuePeek(toCloudQueue)` retrieves the latest `SensorSnapshot`. `sendSensorData()` issues a POST to `/rest/v1/sensor_data`. Runtime is included from the snapshot's `runtimeMin` field — computed and owned exclusively by Core 1.

**10. Steady State**
Both cores run their respective loops indefinitely. Network failures cause the cloud task to pause syncing and retry; the sensor/control task continues unaffected at its 500 ms cadence.

---

## 🔌 Hardware Components

| Component | Model | GPIO / Interface | Role |
|---|---|---|---|
| **Microcontroller** | ESP32-WROOM-32 | — | Central processing, WiFi, FreeRTOS |
| **Ultrasonic Sensor** | HC-SR04 | TRIG: 26, ECHO: 27 | Distance-to-water-surface measurement |
| **TDS Sensor** | TDS Meter V1.0 | ANALOG: 34 | Total Dissolved Solids water quality |
| **Relay Module** | 5V Single-Channel | GPIO: 15 | Pump switching (electrically isolated) |
| **LCD Display** | 16×2 I2C (0x27) | SDA/SCL (I2C) | Local status display |
| **LED Green** | 5mm Standard | GPIO: 19 | Pump ON / normal operation indicator |
| **LED Red** | 5mm Standard | GPIO: 18 | Critical alert indicator |
| **Buzzer** | Active Buzzer | GPIO: 23 | Audible alert for critical conditions |
| **Setup Button** | Tactile Pushbutton | GPIO: 33 | WiFi provisioning trigger |
| **Water Pump** | 3–6V Mini Submersible | Via relay | Water source to tank fill |

> **⚠️ Electrical Note:** The relay module provides electrical isolation between the ESP32's 3.3V logic and the pump's operating voltage. Never connect the pump directly to ESP32 GPIO pins.

---

## 💻 Software Stack

| Layer | Technology | Role |
|---|---|---|
| **Firmware Language** | C++ (Arduino Framework) | ESP32 firmware development |
| **IDE** | Arduino IDE 2.x | Firmware editing, compilation, and flashing |
| **RTOS** | FreeRTOS (ESP-IDF bundled) | Dual-core task scheduling, queues, mutexes |
| **HTTP Client** | ESP32 HTTPClient + WiFiClientSecure | HTTPS communication with Supabase |
| **JSON** | ArduinoJson 7.x | Serialization/deserialization of API payloads |
| **Storage** | EEPROM (ESP32 flash emulation) | Persistent configuration storage |
| **LCD Library** | LiquidCrystal_I2C | 16×2 display control over I2C |
| **Frontend Language** | TypeScript / JavaScript | PWA logic and UI |
| **Frontend Framework** | React (Vite) | Component-based PWA architecture |
| **Styling** | Tailwind CSS | Responsive mobile-first UI |
| **Charts** | Recharts | Water level, TDS, and pump analytics visualization |
| **Backend / Database** | Supabase (PostgreSQL) | Cloud data storage, REST API, authentication |
| **Deployment** | Vercel | PWA hosting with CDN, HTTPS, CI/CD |
| **Version Control** | Git / GitHub | Source code management and collaboration |
| **Editor (PWA)** | Visual Studio Code | PWA development |

---

## 🧠 Firmware Architecture

### Initialization Sequence

```
setup()
  │
  ├── Serial.begin(115200)
  ├── pinMode() for all GPIO
  ├── digitalWrite(RELAY_PIN, HIGH)  ← Pump OFF (safety)
  ├── buzzerInit()
  ├── lcd.init() + lcd.backlight()
  ├── loadCalibration()              ← EEPROM → thresholds, tankHeight
  ├── Boot-time Setup Button check
  ├── xSemaphoreCreateMutex()        ← sharedMutex
  ├── xQueueCreate(1, SensorSnapshot) ← toCloudQueue
  ├── xQueueCreate(1, CloudSettings)  ← toSensorQueue
  ├── startWifiConnection()
  ├── xTaskCreatePinnedToCore(sensorTask, Core 1, priority 2)
  └── xTaskCreatePinnedToCore(cloudTask,  Core 0, priority 1)
```

### Sensor Task (Core 1)

Runs every 50 ms via `vTaskDelay(pdMS_TO_TICKS(50))`. Sensor and pump logic fires on a 500 ms sub-interval. LCD updates on a 1000 ms sub-interval.

```
sensorTask() — Core 1, Priority 2
  │
  ├── [every tick]  beepUpdate()          ← non-blocking beep state machine
  ├── [every tick]  handleButton()        ← setup mode detection
  ├── [every tick]  xQueueReceive(toSensorQueue)
  │     ├── Update shared globals under sharedMutex
  │     ├── saveCalibration() if newCalib
  │     └── setPump() if hasManualCmd
  │
  └── [every 500ms] Sensor cycle
        ├── calcWaterLevel()              ← ultrasonic pulse → distance → %
        ├── readTDS()                     ← 10-sample ADC average → ppm
        ├── controlPump(lvl, tds)         ← threshold comparison → relay
        ├── Build SensorSnapshot
        │     └── runtimeMin computed here (Core 1 only)
        ├── xQueueOverwrite(toCloudQueue, snap)
        └── [every 1000ms] lcdNormal()
```

### Cloud Task (Core 0)

Runs every 100 ms via `vTaskDelay(pdMS_TO_TICKS(100))`. All HTTPS operations execute here, able to block for up to 10 seconds without impacting Core 1.

```
cloudTask() — Core 0, Priority 1
  │
  ├── [every tick]    updateWifiConnection()   ← WiFi state machine
  ├── [every tick]    wifiOnline update under sharedMutex
  │
  ├── [every 10s]     Settings poll
  │     ├── fetchDeviceInfo(s)               ← GET /devices
  │     ├── fetchPumpSettings(s)             ← GET /pump_settings
  │     └── xQueueOverwrite(toSensorQueue, s)
  │
  └── [every 30s]     Data sync
        ├── xQueuePeek(toCloudQueue, snap)
        └── sendSensorData(snap.level, snap.tds, snap.pumpOn,
                           snap.pumpMode, snap.runtimeMin)
```

### HTTPS Communication

All HTTP functions (`httpGetJson`, `httpPostJson`) follow a consistent lifecycle:

```
prepareSecureClient()     ← stop, setInsecure, setTimeout
http.begin(secureClient)
http.addHeader(apikey / Authorization / Content-Type)
code = http.GET() / http.POST()
http.end()
secureClient.stop()       ← explicit socket teardown
```

Sockets are torn down after every request to prevent TLS session reuse across reconnects.

---

## 🔄 Automatic Pump Logic

### Threshold Hierarchy

```
  100% ─────────────────────────────────────────
        │                                      │
        │   SAFE ZONE (pump OFF when ≥ upper)  │
        │                                      │
  90%  ─┼─── UPPER THRESHOLD (default 90%) ───┼─── Pump turns OFF
        │                                      │
        │   NORMAL ZONE (pump runs if below   │
        │   lower and stopped if above upper)  │
        │                                      │
  30%  ─┼─── LOWER THRESHOLD (default 30%) ───┼─── Pump turns ON
        │                                      │
        │   WARNING ZONE                       │
        │                                      │
  20%  ─┼─── CRITICAL THRESHOLD (default 20%)─┼─── Red LED + Buzzer
        │                                      │
        │   CRITICAL ZONE (immediate alert)   │
        │                                      │
  0%   ─────────────────────────────────────────
```

### Pump Control Flowchart

```
  controlPump(lvl, tds) called every 500ms
          │
          ▼
  ┌───────────────────┐
  │  mode == "AUTO"?  │
  │  tankHeight > 0?  │
  │  lvl valid?       │
  └──────┬────────────┘
     YES │                NO → skip auto logic
         │
         ▼
  ┌──────────────────────────────┐
  │  lvl <= lowerThreshold AND   │──── YES ──► setPump(true)
  │  pump is currently OFF?      │            Serial: "Pump ON (auto)"
  └──────────────────────────────┘
         │
         NO
         │
         ▼
  ┌──────────────────────────────┐
  │  lvl >= upperThreshold AND   │──── YES ──► setPump(false)
  │  pump is currently ON?       │            Serial: "Pump OFF (auto)"
  └──────────────────────────────┘
         │
         ▼
  ┌────────────────────────────────┐
  │  lvl <= criticalThreshold  OR  │──── YES ──► LED_RED HIGH
  │  tds > TDS_CRITICAL (600ppm)?  │            criticalAlarm()
  └────────────────────────────────┘
         │
         NO → LED_RED LOW, buzzOff()
         │
         ▼
  ┌────────────────────────────────┐
  │  LED_GREEN = pumpOn state      │
  └────────────────────────────────┘
```

### Operating Modes

| Mode | Trigger | Behavior |
|---|---|---|
| **AUTO** | Default / set via PWA | Pump controlled entirely by threshold logic |
| **MANUAL** | Set via PWA | Threshold logic suspended; pump responds to PWA commands |
| **CRITICAL** | lvl ≤ criticalThreshold OR tds > 600 ppm | Red LED and buzzer activate regardless of mode |
| **SETUP** | Button held 3 s | Sensor loop suspended; AP created for WiFi config |
| **OFFLINE** | WiFi unavailable | AUTO/MANUAL logic continues using EEPROM thresholds |

---

## 📴 Offline-First Architecture

The offline-first design principle is not a fallback mechanism — it is the primary design philosophy of Water Angel. Cloud connectivity is an enhancement, not a dependency.

### Why Offline-First Matters in Pakistan

Load-shedding schedules, intermittent mobile data, and unreliable ISP infrastructure mean that internet connectivity cannot be assumed in residential and semi-urban environments. Any system that halts pump control on network loss is unsuitable for these conditions.

### Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                   OFFLINE-FIRST LAYERS                       │
│                                                             │
│  Layer 1: EEPROM Persistence                                │
│  ─────────────────────────────────────────────────────────  │
│  WiFi credentials, tank height, upper/lower/critical        │
│  thresholds, and calibration flag survive power cycles.     │
│  Written on every cloud settings update. Read at boot.      │
│                                                             │
│  Layer 2: Local Decision Making                             │
│  ─────────────────────────────────────────────────────────  │
│  controlPump() runs every 500ms using locally-cached        │
│  thresholds. No API call is required to turn the pump       │
│  ON or OFF. The system is fully autonomous offline.         │
│                                                             │
│  Layer 3: Local Feedback                                    │
│  ─────────────────────────────────────────────────────────  │
│  LCD, LEDs, and buzzer provide full operational feedback    │
│  without internet. Critical alerts fire locally.            │
│                                                             │
│  Layer 4: Cloud Synchronization (when available)           │
│  ─────────────────────────────────────────────────────────  │
│  When WiFi connects or reconnects, cloudTask begins          │
│  syncing immediately. No data is lost; readings are         │
│  timestamped at the server with current time on receipt.   │
│                                                             │
│  Layer 5: Automatic Recovery                               │
│  ─────────────────────────────────────────────────────────  │
│  WiFi retry every 30 seconds. No user intervention         │
│  required. Settings and commands queued in Supabase are     │
│  applied on the first successful poll after reconnect.      │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Dual-Core FreeRTOS Architecture

This is the most technically significant engineering decision in Water Angel v4, introduced to solve a critical real-world defect.

### The Problem (v3 Firmware)

In v3, all operations ran sequentially in `loop()` on a single core. HTTPS calls to Supabase (`sendSensorData`, `fetchDeviceInfo`, `fetchPumpSettings`) used synchronous HTTP with up to 10-second timeouts. During these calls, `loop()` was completely blocked — sensor reads stopped, `controlPump()` did not run, and the pump could not be switched OFF. If a tank reached 90% while a cloud call was in progress, it overflowed.

This was observed in field testing and confirmed as a genuine root cause of water wastage.

### The Solution (v4 Firmware)

```
┌─────────────────────────────────────────────────────────────────┐
│                   ESP32 DUAL-CORE FREERTOS                       │
│                                                                  │
│  ┌──────────────────────────┐   ┌──────────────────────────┐    │
│  │    CORE 1 — sensorTask   │   │    CORE 0 — cloudTask    │    │
│  │    Priority: 2 (higher)  │   │    Priority: 1 (lower)   │    │
│  │    Stack: 8 KB           │   │    Stack: 20 KB           │    │
│  │                          │   │                          │    │
│  │  • calcWaterLevel()      │   │  • updateWifiConnection()│    │
│  │  • readTDS()             │   │  • fetchDeviceInfo()     │    │
│  │  • controlPump()         │   │  • fetchPumpSettings()   │    │
│  │  • lcdNormal()           │   │  • sendSensorData()      │    │
│  │  • beepUpdate()          │   │  • WiFi retry            │    │
│  │  • handleButton()        │   │                          │    │
│  │  • setupServer (AP mode) │   │  ← Can block up to 10s   │    │
│  │                          │   │    with NO effect on     │    │
│  │  ← NEVER blocked by HTTP │   │    Core 1 operations     │    │
│  │  ← Pump reacts in <550ms │   │                          │    │
│  └──────────┬───────────────┘   └──────────┬───────────────┘    │
│             │                              │                     │
│    FreeRTOS Queue: toCloudQueue            │                     │
│    ────────────────────────────────────────►                     │
│    SensorSnapshot { level, tds, pumpOn, pumpMode, runtimeMin }  │
│                                                                  │
│    FreeRTOS Queue: toSensorQueue                                 │
│    ◄────────────────────────────────────────                     │
│    CloudSettings { upper, lower, critical, tankHt, pumpMode,    │
│                    devId, calibMode, hasManualCmd, pumpOnManual }│
│                                                                  │
│    Shared Globals (sharedMutex):                                 │
│    upperThreshold, lowerThreshold, criticalThreshold,           │
│    tankHeight, pumpMode, wifiOnline, cloudCalibrationMode,      │
│    deviceId, tankHeightUnit                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Queue Design

Both queues have **depth 1** with `xQueueOverwrite` write semantics. This means:
- The consumer always reads the **latest** data, never stale readings from minutes ago
- There is no queue backlog to drain — the freshest state is always available immediately
- Memory usage is bounded: each queue holds exactly one struct at all times

### Data Race Analysis and Resolution

During v4 development, three data races were identified and resolved:

🔍 Race 1: pumpOn written without mutex, read with mutex

`fetchPumpSettings()` read `pumpOn` under `sharedMutex`, but `setPump()` wrote it without the mutex — making the lock on the read side provide no protection. **Fix:** replaced the raw global read with `snap.pumpOn` from the queue snapshot, which is a safe copied value.


🔍 Race 2: beep() called from cloudTask

`updateWifiConnection()` called `beep(1)` on WiFi connect from Core 0. The beep state machine variables (`beepActive`, `beepRemaining`, `beepNextChange`, `beepSoundOn`) were read and written by `beepUpdate()` on Core 1 every 50 ms — a race on four variables. **Fix:** replaced with a `volatile bool requestBeep` flag. Core 0 sets it; Core 1 reads, clears, and calls `beep()` on its own tick.

🔍 Race 3: accumulatedRuntimeMs and pumpOnStart accessed from both cores

The v4 first version read `accumulatedRuntimeMs` and `pumpOnStart` from Core 0 in the data sync block, while Core 1's `setPump()` wrote them. **Fix:** runtime computation was moved entirely to Core 1. `totalRuntimeMs` is now a monotonically increasing counter maintained exclusively in `setPump()`. The snapshot carries `runtimeMin` computed on Core 1; the cloud task reads only from the snapshot, never from raw globals.



### Benefits of Dual-Core Architecture

| Single-Core (v3) | Dual-Core (v4) |
|---|---|
| HTTP blocks pump control | HTTP never touches pump control |
| Overflow during slow Supabase calls | Overflow impossible from network latency |
| Pump reaction time: 0–30+ seconds | Pump reaction time: < 550 ms guaranteed |
| Single point of failure | Network failure isolated to Core 0 |
| `delay()` patterns possible | `vTaskDelay()` yields, never blocks scheduler |
| Beep state shared unsafely | All beep owned by sensorTask exclusively |
| Runtime computed from both cores | Runtime owned exclusively by Core 1 |

---

## 📱 Progressive Web Application

The Water Angel PWA is a React + TypeScript application deployed on Vercel, accessible from any mobile browser without installation.

**Live URL:** [https://water-angel.vercel.app](https://water-angel.vercel.app)

### Tab 1 — Home Dashboard

The central monitoring interface. Displays:
- ESP32 online/offline status with last-seen timestamp
- Animated visual tank fill gauge (0–100%)
- Water Level % (large, primary metric)
- TDS Value in ppm with Safe / Unsafe colour badge
- Pump Status (ON / OFF) and Last Update timestamp
- 24-hour water level history line chart
- Smart Insights panel: Avg Daily Usage, Estimated Time to Empty, Peak Usage window
- Auto-generated recommendations (e.g., "Refill before evening peak")

### Tab 2 — Analytics Dashboard

Transforms raw Supabase time-series into actionable intelligence:
- **Water Level History** — 7-day trend line with refill events visible as step-ups
- **Daily Consumption** — 7-day bar chart of level drop per day
- **Water Quality (TDS) Trend** — 7-day TDS line chart with Improving/Stable/Degrading classification
- **Pump Activity** — bar chart of daily pump activation count
- **Data Insights Panel**: estimated empty time, peak period, weekly and daily TDS averages
- **Water Efficiency Score** — 0–100 composite metric
- **Weekly Smart Report** — auto-generated summary table
- **Recommendations** — machine-generated advisory text based on usage patterns

### Tab 3 — Controls

The configuration and command centre:
- **Mode Toggle**: MANUAL ↔ AUTO slider
- **Manual Control** (in MANUAL mode): Turn ON / Turn OFF buttons, current pump state badge
- **Tank Height**: numeric input (inches or cm) with `Save Tank Height` button
- **Threshold Sliders**: Upper (Pump OFF), Lower (Pump ON), Critical (Alert) with live % display and `Save Thresholds` button

### Tab 4 — Alerts

Real-time categorized alert log:
- **Critical Water Level**: level below critical threshold, immediate refill required
- **Sudden Level Drop**: ≥ 15% drop between readings, flagged as possible leak
- **High TDS**: above 600 ppm, water quality unsafe
- **Pump Status Changes**: activation and deactivation events
- Each alert includes category, timestamp, and descriptive message

### Tab 5 — Profile & Account

- **User Information**: display name and email
- **Device Pairing**: connect PWA to a hardware unit by entering its unique Device Key; shows Connected / Unpaired status
- **Notification Preferences**: independent toggles for Low Water, High TDS, Pump Status, and Anomaly Detection alerts
- **System Settings**: Change Wi-Fi Configuration, Calibrate Height, Change Password
- **Logout**

---

## ☁️ Cloud Infrastructure

### Supabase Database Schema

📊 Table Definitions

**`devices`** — Hardware device registry
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
system_key      TEXT UNIQUE NOT NULL     -- e.g. 'DEVICE-BETA-002'
tank_height     FLOAT                    -- inches
tank_height_unit TEXT DEFAULT 'inches'
calibration_mode BOOLEAN DEFAULT FALSE
pending_command TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**`pump_settings`** — Per-device operating configuration
```sql
id                UUID PRIMARY KEY
device_id         UUID REFERENCES devices(id)
pump_mode         TEXT DEFAULT 'AUTO'     -- 'AUTO' | 'MANUAL'
pump_status       TEXT DEFAULT 'OFF'      -- 'ON' | 'OFF' (manual command)
upper_threshold   FLOAT DEFAULT 90
lower_threshold   FLOAT DEFAULT 35
critical_threshold FLOAT DEFAULT 25
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**`sensor_data`** — Time-series readings
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
device_id     UUID REFERENCES devices(id)
water_level   FLOAT                -- percentage 0–100
tds_value     FLOAT                -- ppm
pump_status   TEXT                 -- 'ON' | 'OFF'
pump_mode     TEXT                 -- 'AUTO' | 'MANUAL'
pump_runtime  FLOAT                -- minutes (monotonic delta)
created_at    TIMESTAMPTZ DEFAULT NOW()
```



### REST API Communication

The ESP32 communicates exclusively via the Supabase PostgREST REST API:

```
GET  /rest/v1/devices?system_key=eq.DEVICE-BETA-002&select=...
GET  /rest/v1/pump_settings?device_id=eq.<uuid>&select=*
POST /rest/v1/sensor_data                            (body: JSON)
```

All requests carry:
```
apikey: <supabase-anon-key>
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
Connection: close
```

---

## 📁 Repository Structure

```
Water_Angel/
│
├── 📁 ESP32_Firmware/
│   ├── WaterAngel_v1/
│   │   └── WaterAngel_v1.ino          # Basic IoT foundation
│   ├── WaterAngel_v2/
│   │   └── WaterAngel_v2.ino          # Offline-first with EEPROM
│   ├── WaterAngel_v3/
│   │   └── WaterAngel_v3.ino          # Non-blocking HTTP & beep
│   └── WaterAngel_v4/
│       └── WaterAngel_v4.ino          # Dual-core FreeRTOS (current)
│
├── 📁 PWA/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/             # Home tab components
│   │   │   ├── Analytics/             # Chart components
│   │   │   ├── Controls/              # Pump & threshold controls
│   │   │   ├── Alerts/                # Alert feed
│   │   │   └── Profile/               # Account & device pairing
│   │   ├── lib/
│   │   │   └── supabase.ts            # Supabase client
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript type definitions
│   │   └── App.tsx                    # Root application
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── 📁 Circuit_Guide/
│   ├── WaterAngel_Circuit_Diagram.png # Fritzing breadboard diagram
│   └── WaterAngel_Wiring_Guide.pdf    # Component connection reference
│
├── 📁 Documentation/
│   ├── WaterAngel_ProjectProposal.pdf # Academic project proposal
│   ├── FirmwareChangelog.md           # Version history and changes
│   └── APIReference.md                # Supabase endpoint documentation
│
├── 📁 Visual_Assets/
│   ├── hardware/                      # Circuit board photographs
│   ├── screenshots/                   # PWA interface screenshots
│   └── poster/                        # Project poster (print-ready)
│
├── 📁 Project_Videos/
│   └── WaterAngel_Demo.mp4            # Live demonstration recording
│
├── README.md                          # This document
└── LICENSE                            # All Rights Reserved
```

---

## 📸 Screenshots

🔩 Hardware

```
┌──────────────────────────────────────┐
│                                      │
│     [ Circuit Diagram Image ]        │
│     ESP32 + HC-SR04 + TDS Sensor     │
│     + Relay + LCD + LEDs + Buzzer    │
│                                      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│                                      │
│     [ Main Circuit Board Photo ]     │
│     Breadboard prototype showing     │
│     LCD reading: Lvl:90% TDS:118     │
│                  Pmp:OFF AUTO        │
│                                      │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│                                      │
│     [ Tank Setup Photo ]             │
│     Water tank with ultrasonic       │
│     sensor and TDS probe mounted     │
│                                      │
└──────────────────────────────────────┘
```

📱 PWA — Home Dashboard

```
┌──────────────────────────────────────┐
│  💧 Water Angel                      │
│                                      │
│  ● WiFi  ESP32: Online   Last: now   │
│                                      │
│         ┌──────────────┐             │
│         │              │             │
│         │     92%      │             │
│         │              │             │
│         └──────────────┘             │
│          Water Tank Level            │
│                                      │
│  💧 Water Level    ⏱ TDS Value       │
│  92%               0 ppm             │
│                    Safe              │
│                                      │
│  ⏻ Pump Status    🕐 Last Update     │
│  OFF               16:35:15          │
│                                      │
│  Water Level — Last 24h              │
│  [Line Chart]                        │
│                                      │
│  Smart Insights                      │
│  • Avg Daily: 20% level drop         │
│  • Est. Empty: 17 hours              │
│  • Peak Usage: 16:00-17:00           │
└──────────────────────────────────────┘
```

📊 PWA — Analytics

```
┌──────────────────────────────────────┐
│  Water Level History [Line Chart]    │
│  ─────────────────────────────────   │
│  Daily Consumption [Bar Chart]       │
│  ─────────────────────────────────   │
│  Water Quality (TDS) Trend           │
│  ─────────────────────────────────   │
│  Pump Activity [Bar Chart]           │
│                                      │
│  Data Insights                       │
│  Peak Usage Period:  16:00–17:00     │
│  Avg TDS (Week):     70 ppm          │
│  Quality Trend:      Improving       │
│                                      │
│  Water Efficiency Score              │
│         [ 60 / 100 ]                 │
│                                      │
│  Weekly Smart Report                 │
│  Total Water Used:   20% level drop  │
│  Avg Daily Usage:    20%             │
│  Pump Activations:   3               │
└──────────────────────────────────────┘
```

🕹️ PWA — Controls

```
┌──────────────────────────────────────┐
│  Pump Control                        │
│                                      │
│  Pump Mode: MANUAL ━━━●━━━━ AUTO     │
│                                      │
│  Tank Height                         │
│  [  30  ] Inches ▾                   │
│  ≈ 2.5 feet                          │
│  [ Save Tank Height ]                │
│                                      │
│  Threshold Settings                  │
│  Upper (Pump OFF)  ━━━━━━━━━━● 90%  │
│  Lower (Pump ON)   ━━━●━━━━━━━ 30%  │
│  Critical (Alert)  ●━━━━━━━━━━ 20%  │
│  [ Save Thresholds ]                 │
└──────────────────────────────────────┘
```

🔔 PWA — Alerts

```
┌──────────────────────────────────────┐
│  🔔 Alerts                           │
│                                      │
│  🔴 Sudden drop detected: 83.5%      │
│     Possible leak.                   │
│     Water_level • 17/06/2026 16:51   │
│                                      │
│  🔴 Critical level: 9.6%.            │
│     Immediate refill required.       │
│     Water_level • 17/06/2026 16:51   │
│                                      │
│  🔴 High TDS: 1099 ppm.              │
│     Water quality unsafe.            │
│     Water_quality • 17/06/2026 16:30 │
└──────────────────────────────────────┘
```


---

## 🚀 Installation & Setup

### Firmware

ESP32 Firmware Setup

**Prerequisites**
- Arduino IDE 2.x
- ESP32 board package (Espressif Systems v2.x via Boards Manager)

**Required Libraries** (install via Library Manager)
- `LiquidCrystal_I2C` by Frank de Brabander
- `ArduinoJson` by Benoit Blanchon (v7.x)

**Steps**
1. Clone the repository:
   ```bash
   git clone https://github.com/SalmanKhanPK211/Water_Angel.git
   cd Water_Angel/ESP32_Firmware/WaterAngel_v4
   ```
2. Open `WaterAngel_v4.ino` in Arduino IDE.
3. Update the Supabase credentials in the firmware header if using your own project:
   ```cpp
   const char* SUPABASE_URL  = "https://your-project.supabase.co";
   const char* SUPABASE_KEY  = "your-anon-key";
   const char* DEVICE_SYSTEM_KEY = "DEVICE-YOUR-ID";
   ```
4. Select **Board**: `ESP32 Dev Module` (or WROOM-32 variant)
5. Select **Upload Speed**: `115200`
6. Select **Partition Scheme**: `Default 4MB with spiffs`
7. Click **Upload**.
8. Open Serial Monitor at 115200 baud to observe boot sequence.

**WiFi Configuration (after flashing)**

1. Hold the Setup Button for 3 seconds — the LCD shows `SETUP MODE / 192.168.4.1`
2. Connect your phone to WiFi network `WaterAngel_Setup`
3. Open a browser and navigate to `192.168.4.1`
4. Enter your WiFi SSID and password, tap Connect
5. The ESP32 saves credentials to EEPROM and restarts

> **ℹ️ Note:** Stack overflow on Core 0 during TLS handshakes is the most common first-time issue. If you see `Task stack overflow` in Serial, increase the `cloudTask` stack from `20480` to `24576` in `xTaskCreatePinnedToCore`.


### PWA

Progressive Web Application Setup

**Prerequisites**
- Node.js 18+
- A Supabase project with the schema described above

**Steps**
```bash
cd Water_Angel/PWA
npm install
```

Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```bash
npm run dev          # Development server at http://localhost:5173
npm run build        # Production build → /dist
```

**Vercel Deployment**
```bash
npm install -g vercel
vercel deploy --prod
```

Or connect the GitHub repository to Vercel for automatic CI/CD on every push to `main`.


---

## 📖 Usage Guide

| Step | Action | Expected Result |
|---|---|---|
| **1. Power On** | Connect ESP32 to power supply | LCD shows "Water Angel / Booting v4..." then level readings |
| **2. WiFi Connect** | (First time) Hold Setup Button 3s, connect to AP, enter credentials | ESP32 connects, green LED flickers, beep sounds |
| **3. Pair Device** | Open PWA → Profile → Device Pairing → Enter Device Key | PWA shows Connected status for your hardware unit |
| **4. Calibrate** | PWA → Controls → Enter tank height → Save | ESP32 pulls new height on next 10s poll; level % updates |
| **5. Set Thresholds** | PWA → Controls → Adjust sliders → Save | Thresholds active within 10s on ESP32 |
| **6. Monitor** | PWA → Home Dashboard | Real-time level, TDS, pump status, and 24h chart |
| **7. Control Pump** | PWA → Controls → Switch to MANUAL → Turn ON / OFF | Pump responds within ~12 seconds |
| **8. View Analytics** | PWA → Analytics → Review 7-day charts | Usage patterns, efficiency score, recommendations |
| **9. Receive Alerts** | PWA → Alerts | Timestamped log of all critical events |
| **10. Update WiFi** | PWA → Profile → Change Wi-Fi | New credentials pushed to device via Supabase |

---

## ⚔️ Engineering Challenges

| Challenge | Impact | Solution | Version |
|---|---|---|---|
| **Blocking HTTPS calls freezing sensor loop** | Tank overflow during Supabase latency spikes | Dual-Core FreeRTOS — cloud on Core 0, sensor on Core 1 | v4 |
| **Data races on `pumpOn`, `pumpOnStart`, `accumulatedRuntimeMs`** | Corrupted runtime data, unsafe pump commands | Runtime ownership moved to Core 1 exclusively; raw global reads replaced with queue snapshot reads | v4 |
| **`beep()` called from cloudTask while sensorTask reads beep state** | Race on 4 beep state variables across cores | `volatile bool requestBeep` flag — cloudTask signals, sensorTask executes | v4 |
| **TLS socket reuse causing stuck HTTP clients** | Failed cloud syncs requiring restart | `secureClient.stop()` after every request; fresh socket per request | v3 |
| **WiFi credentials hardcoded — inflexible deployment** | Firmware reflash required per-household | EEPROM credential storage with captive portal AP provisioning | v2 |
| **Configuration loss on power failure** | System reverts to defaults mid-operation | Full EEPROM persistence of all thresholds and tank calibration | v2 |
| **Non-blocking beep with `delay()` patterns** | Sensor loop stalls during alert sounds | State machine beep engine using `millis()` — zero blocking | v3 |
| **Pump dry-run on empty source tank** | Motor wear and damage | Critical threshold alarm + manual override capability | v1 |
| **Variable TDS readings from ADC noise** | False contamination alerts | 10-sample averaging before polynomial calibration formula | v1 |
| **Stack overflow on cloudTask with TLS** | ESP32 panic and restart | 20 KB stack allocation for cloudTask; raised to 24 KB if needed | v4 |

---

## 🌱 Benefits

### 💧 Water Conservation
Automated overflow prevention eliminates the largest single source of household water wastage. Every litre saved matters in a country heading toward absolute water scarcity.

### ⚡ Electricity Savings
The pump runs only when the water level is below the lower threshold and stops automatically at the upper threshold. No unnecessary runtime. No dry-running damage. Monthly electricity consumption from the pump motor is measurably reduced.

### 🤖 Full Automation
The system operates 24/7 without requiring any human monitoring or intervention. Residents can travel, sleep, or be otherwise occupied without worrying about tank overflow or shortages.

### 📱 Remote Monitoring
The PWA provides complete system visibility from anywhere with an internet connection. Check tank level, TDS reading, pump status, and the last 24 hours of history from any device.

### 📊 Data-Driven Decisions
Weekly analytics, efficiency scores, and usage trend charts empower users to understand their water consumption patterns and make informed conservation decisions.

### 🧪 Water Quality Awareness
Continuous TDS monitoring detects contamination events in real time. Users receive immediate alerts when water quality degrades below safe thresholds — a meaningful public health contribution in regions with ground-water quality concerns.

### 📴 Offline Reliability
The system continues protecting the tank through internet outages, power fluctuations, and network unavailability. The offline-first architecture makes it deployable in rural and semi-urban environments where connectivity is unreliable.

### 📈 Scalability
The same hardware and firmware stack can be deployed across multiple tanks in a building, a housing society, or an agricultural facility. Each device registers independently with Supabase and pairs with a user account.

### 🔒 Reliability
FreeRTOS guarantees that sensor reads and pump control are never preempted by network operations. The 550 ms maximum pump reaction time is a hard architectural guarantee, not a statistical average.

### 👥 User Friendly
No technical expertise is required to operate the system once installed. The PWA is intuitive, mobile-optimized, and provides plain-language recommendations alongside all technical data.

---

## 📜 Project Evolution

```
Timeline
│
├── 📌 Version 1 — Basic IoT Foundation
│   ├── Ultrasonic water level sensing
│   ├── TDS quality monitoring
│   ├── Relay-driven pump control
│   ├── Threshold-based AUTO mode
│   ├── 16×2 I2C LCD display
│   └── Initial Supabase integration (synchronous, single-loop)
│
├── 📌 Version 2 — Offline-First Architecture
│   ├── EEPROM persistence for all configuration
│   ├── WiFi provisioning captive portal (WaterAngel_Setup AP)
│   ├── Credentials stored in EEPROM (not hardcoded)
│   ├── System continues operating through internet outages
│   └── Settings survive power cycles without reconfiguration
│
├── 📌 Version 3 — Non-Blocking Firmware
│   ├── Non-blocking WiFi state machine
│   │   (WIFI_IDLE → WIFI_CONNECTING → WIFI_CONNECTED/FAILED)
│   ├── Non-blocking beep state machine (millis-based, no delay())
│   ├── Per-request TLS socket lifecycle (secureClient.stop())
│   ├── HTTP mutex (httpInProgress flag) preventing re-entrance
│   └── Timeout tuning (10s HTTP, 8s connect, 10s TLS handshake)
│
└── 📌 Version 4 — Dual-Core FreeRTOS (Current)
    ├── sensorTask pinned to Core 1, priority 2
    ├── cloudTask pinned to Core 0, priority 1
    ├── FreeRTOS queue-based inter-core communication
    │   (SensorSnapshot → Core 0, CloudSettings → Core 1)
    ├── sharedMutex protecting all shared globals
    ├── Runtime ownership consolidated in Core 1 (monotonic counter)
    ├── Data race elimination (pumpOn, beep state, runtime variables)
    ├── Pump reaction time guaranteed < 550 ms
    └── Tank overflow from network latency: eliminated
```

---

## 🏛️ Live Demonstration

Water Angel was successfully demonstrated live before the **Higher Education Commission (HEC) of Pakistan** evaluation committee as part of the University of Swabi Computer Science Department's project evaluation programme.

The demonstration covered the complete end-to-end system:

- **Hardware Layer**: ESP32 prototype with ultrasonic level sensing, TDS monitoring, relay-controlled pump, I2C LCD, and LED indicators — operating in real time with a physical water tank
- **Firmware Operation**: Automatic pump control cycling demonstrated live, with threshold-based switching visible on the LCD
- **Offline-First Capability**: WiFi disconnected during demonstration; pump control continued without interruption
- **Cloud Layer**: Supabase real-time data sync demonstrated with live sensor readings appearing in the database
- **Progressive Web Application**: All five PWA tabs demonstrated on a mobile device, including analytics, manual pump control, and alert monitoring

The evaluation panel commended the project's technical depth, practical applicability to Pakistan's water management challenges, and the quality of engineering exhibited in the firmware architecture.

---

## 🔮 Future Enhancements

| Enhancement | Description | Priority |
|---|---|---|
| 🤖 **AI Water Consumption Prediction** | LSTM-based model trained on historical Supabase data to predict daily consumption and pre-schedule pump activation | High |
| 💧 **Advanced Leak Detection** | Multi-sample anomaly detection algorithm using exponential moving averages to distinguish legitimate consumption from abnormal drops | High |
| 🔔 **Native Push Notifications** | Firebase Cloud Messaging integration for true push alerts to Android and iOS without the PWA open | Medium |
| 📱 **Native Mobile App** | React Native application offering offline storage, push notifications, and better hardware integration than the PWA | Medium |
| ☀️ **Solar-Powered Operation** | Integration with a solar charge controller and LiFePO4 battery pack to enable fully grid-independent operation | Medium |
| 🎤 **Voice Assistant Integration** | Google Home / Amazon Alexa skill for voice queries ("Alexa, what is my tank level?") | Low |
| 🔧 **Predictive Pump Maintenance** | Motor runtime and cycle frequency analysis to predict maintenance intervals and alert before failure | High |
| 🧪 **Advanced Water Quality Sensors** | pH sensor, turbidity sensor, and dissolved oxygen probe integration alongside existing TDS monitoring | Medium |
| 🌦️ **Weather API Integration** | Pull local rainfall forecasts to automatically adjust fill thresholds (reduce upper threshold before anticipated rain) | Low |
| 🏘️ **Smart Community Dashboard** | Multi-device aggregated view for building managers, housing societies, or agricultural operations | Medium |

---

## 👥 Contributors


**Salman Khan**
*Project Lead & Firmware Engineer*

BS Computer Science, Batch 12
University of Swabi
CGPA: 3.84

[Portfolio](https://salman-khan-data-scientist.vercel.app) · [GitHub](https://github.com/SalmanKhanPK211)



**Shayan Asim**
*Hardware & Integration Engineer*

BS Computer Science, Batch 12
University of Swabi
Section B, Roll No. 93


**Muhammad Hamza Jamal**
*Testing & Documentation*

BS Computer Science, Batch 12
University of Swabi
Section B, Roll No. 57


### 👨‍🏫 Supervisor

**Dr. Saeed Ahmad**
Assistant Professor — Department of Computer Science
University of Swabi, Khyber Pakhtunkhwa, Pakistan

---

## 🔗 Links

| Resource | URL |
|---|---|
| 📁 GitHub Repository | [github.com/SalmanKhanPK211/Water_Angel](https://github.com/SalmanKhanPK211/Water_Angel) |
| 🌐 Live PWA | [water-angel.vercel.app](https://water-angel.vercel.app) |
| 👤 Developer Portfolio | [salman-khan-data-scientist.vercel.app](https://salman-khan-data-scientist.vercel.app) |
| 🎓 University | [uswabi.edu.pk](https://uswabi.edu.pk) |

---

## 📄 License

```
Water Angel — IoT Smart Water Monitoring & Management System
Copyright © 2026 Salman Khan, Shayan Asim, Muhammad Hamza Jamal
University of Swabi — Department of Computer Science

ALL RIGHTS RESERVED

This software, firmware, documentation, circuit designs, visual assets,
datasets, and all associated materials (collectively, "the Work") are the
exclusive intellectual property of the authors listed above.

No part of the Work may be reproduced, copied, distributed, transmitted,
displayed, modified, adapted, translated, published, sublicensed, or used
to create derivative works — in whole or in part — in any form or by any
means (electronic, mechanical, photocopying, recording, or otherwise)
without prior written permission from the copyright holders.

Specifically prohibited without written authorization:
  • Commercial use or integration into any commercial product or service
  • Academic submission or re-use without proper attribution and permission
  • Distribution of the firmware in compiled or source form
  • Reproduction of circuit designs for manufacturing or resale
  • Use of the project name, logo, or associated branding

Academic and educational reference (citation with attribution) is permitted
provided no code, circuit diagrams, or documentation are reproduced verbatim.

For licensing inquiries, collaboration requests, or permission grants:
  Contact: Salman Khan
  GitHub:  https://github.com/SalmanKhanPK211
  Portfolio: https://salman-khan-data-scientist.vercel.app

THE WORK IS PROVIDED FOR DEMONSTRATION PURPOSES ONLY.
THE AUTHORS MAKE NO WARRANTIES, EXPRESS OR IMPLIED, AND DISCLAIM ALL
LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL
DAMAGES ARISING FROM USE OR REFERENCE TO THE WORK.
```

---


**💧 Water Angel** · Smart IoT Water Management System

*Save Water, Smart Future*

Made with ❤️ at the University of Swabi, Pakistan

