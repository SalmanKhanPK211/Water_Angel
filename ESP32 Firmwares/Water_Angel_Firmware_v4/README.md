Version 4: Dual-Core Multitasking
Version 4 represents a major architectural shift to utilize the full power of the ESP32's dual cores.
Dual-Core Execution (FreeRTOS): The firmware is split into two independent tasks:
Core 1 (Sensor Task): Handles time-critical operations like ultrasonic distance reading and pump control every 500ms
.
Core 0 (Cloud Task): Manages network-heavy tasks like Supabase syncs and WiFi reconnects, which can block for up to 10 seconds without affecting the pump's response time
.
Thread Safety: Uses FreeRTOS Mutexes and Queues to safely pass data between the two cores, ensuring that sensor data and cloud settings do not conflict
.
Hardware Safety: Added an explicit safety command to ensure the pump remains OFF during the boot process
.
Stability: By isolating the network logic, the device remains responsive to water level changes even during poor signal conditions or slow cloud responses
