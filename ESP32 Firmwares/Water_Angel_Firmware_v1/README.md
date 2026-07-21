Version 1: Basic IoT Foundation
Version 1 establishes the core functionality of the Water Angel device, focusing on basic water level monitoring and cloud integration.
Core Hardware Integration: Supports an ultrasonic sensor for distance, a TDS sensor for water quality, a relay for pump control, and an LCD for status
.
Cloud Connectivity: Integrated with Supabase for data logging and fetching device configurations like tank height
.
WiFi Setup Mode: Includes an Access Point (AP) mode that serves a web portal (192.168.4.1) for users to configure WiFi credentials, which are then saved to EEPROM
.
Basic Control Logic: Uses a single-loop execution model to handle sensor reads, pump automation (Auto/Manual), and data syncing at fixed intervals