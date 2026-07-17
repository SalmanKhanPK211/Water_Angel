# 💧 Water Angel PWA

Water Angel PWA is a modern Progressive Web Application (PWA) designed to remotely monitor, control, and manage the Water Angel IoT Smart Water Management System. The application provides real-time insights into water level, water quality, pump activity, analytics, alerts, and device settings through an intuitive and responsive user interface.

---

# Overview

The application communicates with the Water Angel ESP32 device through a Supabase cloud backend and follows an offline-first architecture. Users can monitor their water tank from anywhere, configure thresholds, receive alerts, and manage system settings directly from the application.

---

# Features

## Home Dashboard

The Home Dashboard provides a complete overview of the water tank status.

Features include:

- Live water level monitoring
- Animated tank visualization
- Water quality (TDS) monitoring
- Safe / Unsafe water indication
- Pump status monitoring
- Last synchronization time
- Water level history graph
- Smart recommendations

---

## Analytics Dashboard

The Analytics module provides historical insights and usage statistics.

It includes:

- Water consumption trends
- Pump runtime statistics
- Daily and weekly water usage
- Water level history
- Water quality history
- Performance analytics

---

## Pump Controls

The application supports both Automatic and Manual operating modes.

### Automatic Mode

- Automatic pump control
- Configurable upper and lower thresholds
- Manual override support
- Critical water level protection

### Manual Mode

- Remote pump ON/OFF control
- Instant command synchronization
- Suitable for maintenance and testing

---

## Alerts

The notification system keeps users informed about important events.

Supported alerts include:

- Low water level
- Critical water level
- High TDS
- Pump ON/OFF events
- Device offline status
- System anomalies

Users can review alert history and manage notifications directly within the application.

---

## Profile & Settings

The Profile section allows users to personalize and configure the system.

Features include:

- Device pairing using a unique device key
- Wi-Fi configuration
- Tank height calibration
- Water level threshold configuration
- Notification preferences
- Account management
- Password management

---

# Offline-First Architecture

The application is designed to operate reliably even during internet outages.

Key capabilities include:

- Local device configuration storage
- Automatic synchronization when connectivity returns
- Continuous automatic pump control
- Reliable monitoring under unstable network conditions

---

# System Workflow

Water Angel follows a cloud-connected IoT architecture.

```
Sensors
   │
   ▼
ESP32 Firmware
   │
   ▼
Supabase Cloud
   │
   ▼
Water Angel PWA
   │
   ▼
User
```

The application enables secure two-way communication between the user and the Water Angel hardware.

---

# Technology Stack

## Frontend

- Progressive Web Application (PWA)
- HTML5
- CSS3
- JavaScript

## Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Realtime Database

## IoT Hardware

- ESP32 WROOM
- HC-SR04 Ultrasonic Sensor
- TDS Sensor
- Relay Module
- 16×2 LCD Display

## Deployment

- Vercel

---

# Core Capabilities

- Real-time Water Level Monitoring
- Water Quality Monitoring (TDS)
- Automatic Pump Control
- Manual Pump Control
- Remote Monitoring
- Smart Analytics
- Historical Data Visualization
- Cloud Synchronization
- Offline-First Operation
- Responsive Mobile Interface
- Device Pairing
- Wi-Fi Configuration
- Smart Alerts

---

# Deployment

The application is deployed using Vercel.

Recommended configuration:

- Root Directory: `PWA`
- Build Command: `npm run build`
- Output Directory: `dist`

---

# Future Enhancements

- Multi-device support
- AI-powered water consumption prediction
- AI-based anomaly detection
- Push notifications
- Voice assistant integration
- Advanced analytics dashboard
- Smart scheduling
- Native Android and iOS support

---

# Project Goals

The Water Angel PWA aims to:

- Improve water management efficiency
- Reduce water wastage
- Enable remote monitoring
- Improve drinking water awareness
- Automate household water systems
- Deliver reliable offline operation
- Provide an intuitive user experience

---

# Author

**Salman Khan**

BS Computer Science

University of Swabi

---

# License

Copyright © 2026 Salman Khan and Team.

All rights reserved.

This software and its source code are the intellectual property of the Water Angel development team. Unauthorized copying, modification, redistribution, or commercial use without written permission is prohibited.