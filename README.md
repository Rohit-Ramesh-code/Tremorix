# Tremorix — Adaptive Tremor-Cancelling Smart Spoon

Tremorix is an end-to-end assistive technology system for people living with hand tremors (e.g. Parkinson's disease). It pairs a custom-built hardware spoon with a web dashboard that tracks stabilisation performance, surfaces clinical metrics, and automatically adapts the device's compensation algorithm based on the user's tremor history.

---

## Table of Contents

- [System Overview](#system-overview)
- [Hardware](#hardware)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Flash the ESP32 Firmware](#1-flash-the-esp32-firmware)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Start the Analytics Server (server.js)](#3-start-the-analytics-server-serverjs)
  - [4. Run the BLE Bridge](#4-run-the-ble-bridge)
  - [5. Start the App Server and Frontend](#5-start-the-app-server-and-frontend)
- [How It Works](#how-it-works)
  - [Tremor Cancellation Algorithm](#tremor-cancellation-algorithm)
  - [Adaptive Mode Selection](#adaptive-mode-selection)
  - [BLE Communication Protocol](#ble-communication-protocol)
  - [Tremor Frequency Metric](#tremor-frequency-metric)
- [Web Application](#web-application)
  - [Pages and Routes](#pages-and-routes)
  - [Dashboard](#dashboard)
  - [Exercises](#exercises)
  - [Messages](#messages)
- [API Reference](#api-reference)
  - [App Server (Port 5000)](#app-server-port-5000)
  - [Analytics Server (Port 3000)](#analytics-server-port-3000)
- [Database Schema](#database-schema)
- [Tech Stack](#tech-stack)

---

## System Overview

```
┌─────────────────┐     BLE      ┌──────────────────┐   WebSocket   ┌─────────────────┐
│  Tremor Spoon   │ ──────────► │  ble_bridge.py   │ ────────────► │   server.js     │
│  (ESP32 + IMU)  │ ◄────────── │  (Python bridge) │ ◄──────────── │  (Analytics WS) │
└─────────────────┘  mode cmds  └──────────────────┘   set_mode    └────────┬────────┘
                                                                             │ REST
                                                                    ┌────────▼────────┐
                                                               ┌────┤  server/        │
                                                               │    │  (App API :5000)│
                                                               │    └─────────────────┘
                                                               │
                                                        ┌──────▼──────┐
                                                        │  React App  │
                                                        │  (Vite :5173)│
                                                        └─────────────┘
```

The device continuously measures pitch and roll at 100 Hz and actively counteracts tremor using two servo motors. Sensor readings are streamed over BLE to a Python bridge, which relays them to the analytics server. Every 60 seconds the server analyses the user's 7-day tremor history, determines the optimal stabilisation mode, and sends the mode command back to the device.

---

## Hardware

| Component | Spec |
|-----------|------|
| Microcontroller | ESP32 WROOM-32 |
| IMU | MPU-6050 (I²C, SDA GPIO 21, SCL GPIO 22) |
| Pitch servo | MG90S Micro Servo on GPIO 19 |
| Roll servo | MG90S Micro Servo on GPIO 18 |
| Firmware loop rate | 100 Hz |
| BLE TX rate | 10 Hz (every 10 loops) |
| Servo range | 20°–160° (centre 90°) |

---

## Project Structure

```
Tremorix/
├── tremor_spoon.ino       # ESP32 Arduino firmware
├── ble_bridge.py          # Python BLE ↔ WebSocket bridge
├── server.js              # Analytics WebSocket + HTTP server (port 3000)
├── client/                # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx        # Router and route definitions
│   │   └── pages/
│   │       ├── ProfileSelect.jsx   # Landing / onboarding page
│   │       ├── Login.jsx           # Login with role selection
│   │       ├── PatientList.jsx     # Doctor: list of patients
│   │       ├── Dashboard.jsx       # Waveform chart + metrics
│   │       ├── Exercises.jsx       # Gentle hand exercise program
│   │       ├── Messages.jsx        # Doctor notes and messages
│   │       └── ProfileMenu.jsx     # Settings and device management
│   └── package.json
├── server/                # App REST API (port 5000)
│   ├── index.js           # Express entry point
│   ├── db/
│   │   ├── schema.sql     # SQLite schema (profiles + telemetry)
│   │   └── tremorix.db    # SQLite database (git-ignored)
│   └── routes/
│       ├── profiles.js    # GET /api/profiles
│       └── telemetry.js   # GET /api/profiles/:id/telemetry
└── package.json           # Root scripts (dev + seed)
```

---

## Architecture

The system has four independent processes:

| Process | Runtime | Port | Role |
|---------|---------|------|------|
| `tremor_spoon.ino` | ESP32 | BLE | Stabilises the spoon; streams IMU data |
| `ble_bridge.py` | Python | — | Bridges BLE notifications to WebSocket |
| `server.js` | Node.js | 3000 | Stores device data; computes adaptive mode |
| `server/index.js` | Node.js | 5000 | Serves profile + telemetry data to the React app |
| `client/` | Vite | 5173 | React dashboard UI |

The two servers are intentionally separate: `server.js` owns the real-time device pipeline, while `server/index.js` owns the user-facing profile and historical data API.

---

## Getting Started

### Prerequisites

- **Hardware:** ESP32 + MPU-6050 + 2× MG90S servos wired as above
- **Arduino IDE** with the following libraries installed:
  - `ESP32Servo`
  - `ArduinoJson`
  - `BLEDevice` (ESP32 Arduino BLE stack, included in ESP32 board package)
- **Python 3.9+**
- **Node.js 18+**

### 1. Flash the ESP32 Firmware

Open `tremor_spoon.ino` in Arduino IDE, select the correct ESP32 board and COM port, then upload.

On boot the device:
1. Calibrates the gyro bias (keep it still for ~1 second)
2. Starts advertising as `TremorSpoon` over BLE

### 2. Install Dependencies

```bash
# Root (analytics server + concurrently)
npm install

# App server
cd server && npm install && cd ..

# React frontend
cd client && npm install && cd ..

# Python bridge
pip install bleak websockets
```

Seed the database with synthetic 7-day telemetry for both demo profiles:

```bash
npm run seed
```

### 3. Start the Analytics Server (server.js)

```bash
node server.js
```

This starts the WebSocket + HTTP server on **port 3000**. It will:
- Accept the BLE bridge connection
- Store all incoming sensor readings in `tremor_history.db`
- Run a mode analysis every 60 seconds and push the recommended mode to the device

### 4. Run the BLE Bridge

```bash
python ble_bridge.py
```

The bridge will scan for the `TremorSpoon` BLE device, connect, and begin forwarding data. Both the BLE and WebSocket connections auto-reconnect on failure.

### 5. Start the App Server and Frontend

```bash
npm run dev
```

This starts both the Express API on **port 5000** and the Vite dev server on **port 5173** concurrently.

Open [http://localhost:5173](http://localhost:5173) in a browser.

---

## How It Works

### Tremor Cancellation Algorithm

The firmware uses a **complementary filter** to fuse accelerometer angle estimates with gyroscope integration, which gives a stable, low-latency pose estimate:

```
pitch = α × (pitch + gyro_rate_x × dt) + (1 − α) × pitch_acc
roll  = α × (roll  + gyro_rate_y × dt) + (1 − α) × roll_acc
```

The servo counter-correction is then:

```
servo_target = 90° + angle − gyro_rate × gyroGain
servo_pos    = smoothing × prev_pos + (1 − smoothing) × servo_target
```

### Adaptive Mode Selection

Three modes tune the filter parameters to match the user's tremor profile:

| Mode | Alpha (α) | Smoothing | Gyro Gain | Max Rate | Tremor Range |
|------|-----------|-----------|-----------|----------|--------------|
| LOW  | 0.90 | 0.70 | 0.4 | 80°/s  | < 3 Hz (resting) |
| MILD | 0.93 | 0.80 | 0.8 | 120°/s | 3–7 Hz (typical Parkinson's) |
| HIGH | 0.97 | 0.88 | 1.2 | 200°/s | > 7 Hz (severe / action) |

Every 60 seconds, `server.js` analyses the last 7 days of stored readings and maps the **95th-percentile tremor frequency** to a mode recommendation, which is sent to the device as a `set_mode` command.

### BLE Communication Protocol

**ESP32 → Bridge (TX Characteristic, notify, 10 Hz):**
```json
{ "ts": 123456, "p": 2.3, "r": -1.1, "gx": 4.5, "gy": -2.0,
  "ps": 92, "rs": 88, "hz": 4.2, "mode": "MILD" }
```

**Bridge → server.js (WebSocket):**
```json
{ "type": "bridge_hello", "version": "1.0" }
{ "type": "data", "payload": { ...sensor packet... } }
```

**server.js → Bridge → ESP32 (RX Characteristic, write):**
```json
{ "cmd": "set_mode", "mode": "HIGH" }
{ "cmd": "calibrate" }
```

### Tremor Frequency Metric

Since telemetry is stored at coarse intervals, tremor frequency is computed as an **episode rate** — the number of distinct rising-edge crossings above the mean + 1σ threshold, expressed as episodes per hour:

```
threshold  = mean(correction_angle) + σ(correction_angle)
episodes   = count of rising edges crossing the threshold
rate       = episodes / (7 × 24)  →  episodes / hour
```

The firmware independently estimates instantaneous tremor frequency via gyro zero-crossing counting and streams it as the `hz` field.

---

## Web Application

### Pages and Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | ProfileSelect | Landing page with animated spoon, benefit cards, Get Started / Log in |
| `/login` | Login | Email + password form with patient / caregiver / doctor role selection |
| `/patients` | PatientList | Doctor view: list of all patients |
| `/profile/:id` | Dashboard | 7-day waveform chart + clinical metrics table |
| `/profile/:id/exercises` | Exercises | 5 guided hand exercises with completion tracking and confetti |
| `/profile/:id/messages` | Messages | Doctor notes with a reply compose bar |
| `/profile/:id/settings` | ProfileMenu | Device pairing, privacy, preferences, support, log out |

### Dashboard

The main clinical view for each profile:

- **Waveform chart** — Recharts `LineChart` showing `correction_angle` over the past 7 days. Line colour `#0D8ABC`, Y-axis fixed at 5–130°, day-of-week X-axis labels, light gray horizontal grid lines.
- **Metrics table** — Three rows:
  - Avg X-axis deviation (mean correction angle, 1 d.p.)
  - Avg Y-axis deviation (same signal, shown per-axis)
  - Tremor frequency (episode rate, expressed as `N episodes/hr`)
- **PDF Export** — Generate high-fidelity clinical reports using `jsPDF` and `html2canvas`. Reports include high-resolution snapshots of the waveform charts and metrics, automatically populated with patient metadata and generation timestamps. Special rendering logic ensures that CSS filters (like backdrop-blur) and responsive SVG containers are accurately captured in the final document.

The exercise system serves dual purposes based on the logged-in user's role:

- **For Patients:** Five gentle hand exercises designed for tremor management. Completing an exercise triggers a confetti animation and increments the weekly counter. Completed exercises are visually distinguished and their buttons are disabled.
- **For Doctors:** A clinician interface for routine management. Doctors can browse the exercise library and use a dynamic **Assign to Patient** dropdown (populated live from the profile database) to add specific activities to a patient's plan.

**Exercise Library:**
1. Gentle finger stretch
2. Breathing pause
3. Slow grip practice
4. Wrist rotations
5. Thumb touches

### Messages

A read-only message thread of doctor notes linked to the user's shared reports. Includes a compose bar to attach a note to the next weekly report share.

---

## API Reference

### App Server (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profiles` | Returns all profiles `[{ id, name, avatar_url }]` |
| `GET` | `/api/profiles/:id/telemetry` | Returns correction angle readings for the past 7 days `[{ recorded_at, pitch, roll, sp, sr }]` |

### Analytics Server (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/recent` | Last 60 seconds of sensor readings |
| `GET` | `/api/analysis` | 7-day analysis: recommended mode, p95/avg/max tremor Hz, daily summaries |
| `GET` | `/api/history` | `daily_summary` rows for the past 7 days |
| `POST` | `/api/mode` | Override device mode `{ "mode": "LOW" \| "MILD" \| "HIGH" }` |
| `POST` | `/api/calibrate` | Trigger gyro recalibration on the device |

---

## Database Schema

**`tremorix.db`** (App server — profiles and telemetry)

```sql
CREATE TABLE profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  avatar_url TEXT
);

CREATE TABLE telemetry (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profiles(id),
  recorded_at TEXT NOT NULL,
  pitch       REAL NOT NULL,
  roll        REAL NOT NULL,
  sp          REAL NOT NULL,   -- servo pitch position
  sr          REAL NOT NULL    -- servo roll position
);
```

**`tremor_history.db`** (Analytics server — live device readings)

```sql
CREATE TABLE readings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,  -- Unix ms
  pitch     REAL, roll REAL,
  gyro_x    REAL, gyro_y REAL,
  pitch_srv INTEGER, roll_srv INTEGER,
  tremor_hz REAL,
  mode      TEXT
);

CREATE TABLE daily_summary (
  day         TEXT PRIMARY KEY,  -- YYYY-MM-DD
  avg_hz      REAL,
  max_hz      REAL,
  p95_hz      REAL,
  severity    TEXT,              -- low / mild / high
  session_min REAL,
  updated_at  INTEGER
);
```

Readings older than 8 days are automatically pruned hourly.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Hardware firmware | C++ (Arduino / ESP32), ESP32Servo, ArduinoJson, ESP32 BLE stack |
| BLE bridge | Python 3, bleak, websockets |
| Analytics server | Node.js, Express, ws, better-sqlite3, cors |
| App server | Node.js, Express, better-sqlite3, cors |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide React |
| Database | SQLite (two separate files) |
| Dev tooling | concurrently, nodemon |
