# Water Angel ☔

**Water Angel** is a smart IoT water monitoring and pump-control system for household water tanks. An ESP32 sensor reads water level and TDS (water quality), uploads the telemetry to the cloud, and a mobile-first PWA lets you visualize it live, control the pump remotely, get alerts, and see AI-driven consumption forecasts — all in real time.

---

## ✨ Features

### Live Monitoring (Home)
- Animated tank visualization with upper / lower / critical threshold bands.
- Real-time **water level** and **TDS (water quality)** metric cards.
- 24-hour mini chart and weekly insight cards (avg daily usage, peak usage hour, time to empty estimate).
- **Time-to-Empty** card computed live in the PWA from the last 6 hours of data using a 5-point median filter, discarding refills and pump-ON periods, showing remaining litres out of tank capacity.
- **API status** indicator showing whether the device is online and how stale the last reading is.

### Analytics
- Weekly water-level, TDS, and pump-activity charts.
- **Daily Consumption (7 days)** chart in litres, sourced from a nightly database rollup.
- **ML Water Consumption Prediction** — a 7-day forecast (litres/day) trained on `daily_usage` by an external XGBoost service and served back to the app, with weekly total, daily average, and confidence.
- **Anomaly Detection** — automated, trigger-based checks for sudden level drops (>15%), low water (<10%), and high TDS (>600 ppm).

### Pump Control
- **AUTO / MANUAL** modes with three-tier thresholds (Upper, Lower, Critical).
- Manual **Turn ON / Turn OFF** buttons that write `pump_status` directly to `pump_settings` and set a `pending_command` the ESP32 polls and acknowledges.
- Dual status badges: **Commanded** (what the app sent) vs **Device** (what the ESP32 confirmed via telemetry).
- Toast notifications confirm every pump state change.
- Tank height configuration (inches or feet) and calibration mode.

### Alerts
- Real-time alert feed for low water, high TDS, pump issues, and anomalies.
- **Web Push notifications** via a VAPID-secured service worker.
- Per-category notification toggles in the profile.

### Profile
- Display name and email.
- Tank maximum capacity (litres) input — drives litres conversion across the app.
- Per-category alert preference toggles (low water, high TDS, pump status, anomalies).
- Device pairing (System Key or QR code) and multi-device support with active-device filtering.

### Onboarding
- Mandatory two-step `/setup` wizard for unpaired users: Wi-Fi provisioning (AP mode to the ESP32) then device pairing.

---

## 🏗️ Architecture

```
┌──────────┐   HTTPS    ┌────────────────────┐   Realtime    ┌────────────────┐
│  ESP32   │ ─────────► │  device-ingest     │ ───────────► │  PWA (React)   │
│ firmware │ ◄───────── │  Edge Function     │              │  + Capacitor   │
└──────────┘  poll cmd  └────────────────────┘              └────────────────┘
                                │                                   │
                                ▼                                   ▼
                        ┌────────────────┐                 ┌────────────────┐
                        │  Supabase DB   │ ◄──── reads ────│  PWA hooks     │
                        │  + Realtime    │                 └────────────────┘
                        │  + Triggers    │
                        └────────────────┘
                                ▲
                                │ REST (X-API-Token)
                          ┌────────────────┐
                          │  XGBoost ML    │  (Render, cron-triggered)
                          │  forecast svc   │
                          └────────────────┘
```

### Frontend (PWA)
- **React 18 + TypeScript + Vite 5**
- **Tailwind CSS v3** with a custom water-themed design system (semantic tokens, dark/light).
- **shadcn/ui** component primitives.
- **React Router** for navigation; **TanStack Query** for server state.
- **Recharts** for visualizations.
- **vite-plugin-pwa** — installable PWA with offline fallback and push-sw.
- **Capacitor** for native iOS/Android builds.

### Backend (Lovable Cloud / Supabase)
- **Auth** — email + password with email verification, Google OAuth, and a profile trigger.
- **Database tables** (all with ownership-based RLS):
  - `devices` — hardware registry, system key, owner, tank config, pending command.
  - `sensor_data` — raw water level, TDS, pump status telemetry.
  - `pump_settings` — mode, thresholds, pump status per device.
  - `daily_usage` — nightly rollup of litres used per day per device.
  - `ml_predictions` — ML forecasts (daily consumption, time to empty, anomalies).
  - `alerts` — generated alert events.
  - `profiles` — user preferences and notification toggles.
  - `push_subscriptions` — Web Push endpoints.
  - `admin_emails` / `user_roles` — admin authorization.
- **Realtime** subscriptions on sensor data, pump settings, daily usage, and predictions.
- **Database functions**: `rollup_daily_usage`, `backfill_daily_usage`, `detect_anomalies` (trigger), `trigger_push_on_alert` (trigger), `is_admin` / `has_role`.
- **pg_cron** nightly job for daily usage rollup and a 14-day data retention cleanup.

### Edge Functions
- **`device-ingest`** — the ESP32's secure endpoint. Verifies the device by `system_key` (bypassing RLS via the service role) to ingest telemetry and acknowledge `pending_command`. Keeps sensor data owner-only while letting the hardware write.
- **`ml-gateway`** — secured by `X-API-Token`. Exposes three routes for the external XGBoost forecasting service:
  - `GET /api/devices` — list of paired device IDs.
  - `GET /api/daily-usage/:deviceId` — usage history (last 90 days by default, `?days=` up to 365).
  - `POST /api/predictions` — replaces the previous forecast for a device and writes new daily-consumption predictions.
- **`send-push`** — delivers Web Push notifications to a user's subscribed endpoints, secured by an internal secret.

### ML Forecasting (external, Render)
- A separate Python service trains a **per-device XGBoost** model on `daily_usage` (litres), engineers calendar + lag + rolling features, recursively forecasts the next 7 days, and writes results back through the `ml-gateway`. Triggered on a schedule (cron-job.org). The PWA reads and displays only the latest forecast run.

---

## 📱 Pages & Routes

| Route        | Page         | Description                                  |
| ------------ | ------------ | -------------------------------------------- |
| `/`          | Home         | Live tank, metrics, time-to-empty, insights   |
| `/analytics` | Analytics    | Charts, daily consumption, ML forecast         |
| `/control`   | Control      | Pump mode, thresholds, manual on/off, tank height |
| `/alerts`    | Alerts       | Alert feed and push notification setup          |
| `/profile`   | Profile      | User prefs, tank capacity, device pairing      |
| `/setup`     | Setup        | Wi-Fi provisioning + device pairing wizard     |
| `/auth`      | Auth         | Sign in / sign up                              |
| `/admin`     | Admin        | Admin-only device and user management          |

Mobile-first with a bottom navigation bar: **Home · Analytics · Control · Alerts · Profile**.

---

## 🔌 ESP32 Hardware
- ESP32 with an ultrasonic water-level sensor and a TDS probe.
- Reads level + TDS, uploads via HTTPS to the `device-ingest` Edge Function.
- Polls `pending_command` and acknowledges manual pump commands.
- Three-slot priority queue for pending HTTP requests (commands preempt uploads).
- Auto-AP fallback for Wi-Fi provisioning when no credentials are stored.
- VapID-secured, stable TDS via `analogReadMilliVolts()` with voltage compensation.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm i

# Start the dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

> **Note:** This is a client-side React app. The backend (database, auth, edge functions, realtime) runs on Lovable Cloud. Configure the Supabase URL and publishable key via the project environment — do not edit `src/integrations/supabase/client.ts` (auto-generated).

## 📦 Native Mobile (Capacitor)

```bash
npm run build
npx cap sync
npx cap open ios     # or android
```

## 🛠️ Tech Stack

| Layer       | Tech                                                        |
| ----------- | ---------------------------------------------------------- |
| Frontend    | React 18, TypeScript, Vite 5, Tailwind CSS v3, shadcn/ui   |
| State       | TanStack Query, React Context, Supabase Realtime           |
| Charts      | Recharts                                                    |
| Mobile      | Capacitor (iOS / Android), vite-plugin-pwa                 |
| Backend     | Lovable Cloud (Supabase) — Auth, DB, Realtime, Edge Functions |
| ML          | XGBoost (Python) deployed on Render, cron-triggered         |

---

## 📂 Project Structure

```
src/
├── components/          # UI components (WaterTank, MetricCards, charts, etc.)
│   └── analytics/       # ML prediction, anomaly detection, clustering cards
├── pages/               # Route pages (Home, Analytics, Control, Alerts, Profile, Setup, Auth, Admin)
├── hooks/               # Data hooks (sensor, pump, daily usage, ML, time-to-empty, auth, device)
├── lib/                 # Utilities (water-utils, data-science, formatting)
└── integrations/supabase/  # Auto-generated Supabase client + types
supabase/
├── functions/           # Edge functions (device-ingest, ml-gateway, send-push)
└── config.toml          # Supabase project config (auto-generated)
```

---

## 🔐 Security

- **Row-Level Security** on every table — users only read/write their own devices' data.
- **Owner-based policies** on `sensor_data`, `daily_usage`, `ml_predictions`, `alerts`, and `pump_settings`.
- The ESP32 authenticates via a `system_key` through the `device-ingest` Edge Function — never with user credentials.
- The ML gateway is gated by an `X_API_TOKEN` secret.
- Admin access is checked server-side via `is_admin()` / `has_role()` security-definer functions — never via client-side storage.
- Web Push endpoints are validated server-side before delivery.

---

## 📝 License

This project is built and maintained on Lovable. See the Lovable project for details.
