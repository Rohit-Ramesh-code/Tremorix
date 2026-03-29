/*
==============================================================================
  TREMOR SPOON — NODE.JS SERVER
==============================================================================
  WebSocket server  → talks to Python BLE bridge
  HTTP server       → serves the dashboard (index.html in same folder)
  SQLite database   → stores 7-day tremor history
  Analytics engine  → computes tremor frequency, severity, mode recommendations

  Install:
    npm init -y
    npm install ws express better-sqlite3 cors

  Run:
    node server.js

  The server listens on:
    ws://localhost:3000   ← BLE bridge connection
    http://localhost:3000 ← Dashboard UI (open in browser)
==============================================================================
*/

const express     = require("express");
const http        = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const Database    = require("better-sqlite3");
const path        = require("path");
const cors        = require("cors");

// ── Config ──────────────────────────────────────────────────────────────────
const PORT          = 3000;
const DB_PATH       = path.join(__dirname, "tremor_history.db");
const ANALYSIS_WINDOW_DAYS = 7;
const SEND_REPORT_EVERY_S  = 60;  // push mode recommendation to device every 60s

// ── Database ─────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        INTEGER NOT NULL,        -- Unix ms
    pitch     REAL    NOT NULL,
    roll      REAL    NOT NULL,
    gyro_x    REAL    NOT NULL,
    gyro_y    REAL    NOT NULL,
    pitch_srv INTEGER NOT NULL,
    roll_srv  INTEGER NOT NULL,
    tremor_hz REAL    NOT NULL,
    mode      TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ts ON readings(ts);

  CREATE TABLE IF NOT EXISTS daily_summary (
    day         TEXT PRIMARY KEY,     -- YYYY-MM-DD
    avg_hz      REAL,
    max_hz      REAL,
    p95_hz      REAL,
    severity    TEXT,                 -- LOW / MILD / HIGH
    session_min REAL,
    updated_at  INTEGER
  );
`);

// Prepared statements
const insertReading = db.prepare(`
  INSERT INTO readings (ts, pitch, roll, gyro_x, gyro_y, pitch_srv, roll_srv, tremor_hz, mode)
  VALUES (@ts, @pitch, @roll, @gyro_x, @gyro_y, @pitch_srv, @roll_srv, @tremor_hz, @mode)
`);

const getRecentReadings = db.prepare(`
  SELECT * FROM readings
  WHERE ts > ?
  ORDER BY ts DESC
  LIMIT 500
`);

const getLast7Days = db.prepare(`
  SELECT * FROM daily_summary
  WHERE day >= date('now', '-7 days')
  ORDER BY day ASC
`);

// Auto-delete readings older than 8 days to keep DB small
setInterval(() => {
  const cutoff = Date.now() - 8 * 24 * 3600 * 1000;
  const deleted = db.prepare("DELETE FROM readings WHERE ts < ?").run(cutoff);
  if (deleted.changes > 0) {
    console.log(`[DB] Pruned ${deleted.changes} old readings`);
  }
}, 3600 * 1000);

// ── Analytics Engine ─────────────────────────────────────────────────────────

/**
 * Analyse the last 7 days of readings and return:
 *   - daily summary array
 *   - recommended mode (LOW / MILD / HIGH)
 *   - summary statistics
 */
function analyseHistory() {
  const cutoff7d = Date.now() - ANALYSIS_WINDOW_DAYS * 24 * 3600 * 1000;
  const rows     = db.prepare("SELECT tremor_hz, ts FROM readings WHERE ts > ? AND tremor_hz > 0").all(cutoff7d);

  if (rows.length === 0) {
    return { mode: "MILD", confidence: "low", stats: {}, daily: [] };
  }

  // Collect all Hz values
  const hzValues = rows.map(r => r.tremor_hz).filter(h => h > 0);
  hzValues.sort((a, b) => a - b);

  const avg  = hzValues.reduce((s, v) => s + v, 0) / hzValues.length;
  const max  = hzValues[hzValues.length - 1];
  const p95  = hzValues[Math.floor(hzValues.length * 0.95)];
  const p50  = hzValues[Math.floor(hzValues.length * 0.50)];

  // Mode recommendation based on 95th-percentile tremor frequency
  //   LOW  : p95 < 3 Hz  (resting tremor, slow)
  //   MILD : p95 3–7 Hz  (typical Parkinson's range)
  //   HIGH : p95 > 7 Hz  (severe / action tremor)
  let recommendedMode, severity;
  if (p95 < 3.0) {
    recommendedMode = "LOW";
    severity = "low";
  } else if (p95 <= 7.0) {
    recommendedMode = "MILD";
    severity = "mild";
  } else {
    recommendedMode = "HIGH";
    severity = "high";
  }

  // Confidence: based on sample count
  const confidence = rows.length > 500 ? "high" : rows.length > 100 ? "medium" : "low";

  // Build / update daily summaries
  const dailyMap = {};
  rows.forEach(({ tremor_hz, ts }) => {
    const day = new Date(ts).toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = [];
    dailyMap[day].push(tremor_hz);
  });

  const upsertDay = db.prepare(`
    INSERT INTO daily_summary (day, avg_hz, max_hz, p95_hz, severity, session_min, updated_at)
    VALUES (@day, @avg_hz, @max_hz, @p95_hz, @severity, @session_min, @updated_at)
    ON CONFLICT(day) DO UPDATE SET
      avg_hz=excluded.avg_hz, max_hz=excluded.max_hz,
      p95_hz=excluded.p95_hz, severity=excluded.severity,
      session_min=excluded.session_min, updated_at=excluded.updated_at
  `);

  const dailyResults = [];
  Object.entries(dailyMap).forEach(([day, vals]) => {
    vals.sort((a, b) => a - b);
    const dayAvg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const dayMax = vals[vals.length - 1];
    const dayP95 = vals[Math.floor(vals.length * 0.95)];
    const sessionMin = (vals.length * (SEND_REPORT_EVERY_S / 60)) / 60; // approx minutes

    let daySeverity = dayP95 < 3 ? "low" : dayP95 <= 7 ? "mild" : "high";

    upsertDay.run({
      day,
      avg_hz:      Math.round(dayAvg * 100) / 100,
      max_hz:      Math.round(dayMax * 100) / 100,
      p95_hz:      Math.round(dayP95 * 100) / 100,
      severity:    daySeverity,
      session_min: Math.round(sessionMin * 10) / 10,
      updated_at:  Date.now()
    });

    dailyResults.push({ day, avg_hz: dayAvg, max_hz: dayMax, p95_hz: dayP95, severity: daySeverity });
  });

  return {
    mode:       recommendedMode,
    confidence,
    stats: {
      avg_hz:  Math.round(avg  * 100) / 100,
      max_hz:  Math.round(max  * 100) / 100,
      p95_hz:  Math.round(p95  * 100) / 100,
      p50_hz:  Math.round(p50  * 100) / 100,
      samples: rows.length,
      severity
    },
    daily: dailyResults.sort((a, b) => a.day.localeCompare(b.day))
  };
}

// ── Express HTTP server ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));  // serves index.html dashboard

// REST endpoints for dashboard
app.get("/api/recent", (req, res) => {
  const since = Date.now() - 60 * 1000; // last 60s
  res.json(getRecentReadings.all(since));
});

app.get("/api/analysis", (req, res) => {
  res.json(analyseHistory());
});

app.get("/api/history", (req, res) => {
  res.json(getLast7Days.all());
});

app.post("/api/mode", (req, res) => {
  const { mode } = req.body;
  if (!["LOW", "MILD", "HIGH"].includes(mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }
  sendToBridge({ type: "command", data: { cmd: "set_mode", mode } });
  res.json({ ok: true, mode });
});

app.post("/api/calibrate", (req, res) => {
  sendToBridge({ type: "command", data: { cmd: "calibrate" } });
  res.json({ ok: true });
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

let bridgeSocket   = null;  // the Python bridge connection
let dashboardSockets = new Set();  // browser dashboards

wss.on("connection", (ws, req) => {
  console.log(`[WS] New connection from ${req.socket.remoteAddress}`);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); }
    catch { return; }

    const type = msg.type;

    // ── Bridge identification ──────────────────────────────────────
    if (type === "bridge_hello") {
      bridgeSocket = ws;
      console.log(`[WS] Bridge connected (v${msg.version})`);
      ws.isBridge = true;

      // Send initial mode report to device
      const report = analyseHistory();
      sendToBridge({
        type: "command",
        data: { cmd: "set_mode", mode: report.mode }
      });
      return;
    }

    // ── Dashboard identification ───────────────────────────────────
    if (type === "dashboard_hello") {
      dashboardSockets.add(ws);
      ws.isDashboard = true;
      console.log(`[WS] Dashboard connected`);
      // Send current analysis immediately
      ws.send(JSON.stringify({ type: "analysis", data: analyseHistory() }));
      return;
    }

    // ── Sensor data from bridge ────────────────────────────────────
    if (type === "data" && msg.payload) {
      const d = msg.payload;

      // Persist to DB
      try {
        insertReading.run({
          ts:        d.ts || Date.now(),
          pitch:     d.p  || 0,
          roll:      d.r  || 0,
          gyro_x:    d.gx || 0,
          gyro_y:    d.gy || 0,
          pitch_srv: d.ps || 90,
          roll_srv:  d.rs || 90,
          tremor_hz: d.hz || 0,
          mode:      d.mode || "MILD"
        });
      } catch (e) {
        console.error("[DB] Insert error:", e.message);
      }

      // Fan out to all dashboard clients
      broadcast(dashboardSockets, { type: "live", data: d });
      return;
    }

    // ── BLE status update ──────────────────────────────────────────
    if (type === "ble_status") {
      broadcast(dashboardSockets, { type: "ble_status", data: msg });
      return;
    }

    // ── Pong ──────────────────────────────────────────────────────
    if (type === "pong") return;
  });

  ws.on("close", () => {
    if (ws.isBridge)     { bridgeSocket = null; console.log("[WS] Bridge disconnected"); }
    if (ws.isDashboard)  { dashboardSockets.delete(ws); }
  });

  ws.on("error", (e) => console.error("[WS] Error:", e.message));
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendToBridge(obj) {
  if (bridgeSocket && bridgeSocket.readyState === WebSocket.OPEN) {
    bridgeSocket.send(JSON.stringify(obj));
  }
}

function broadcast(sockets, obj) {
  const raw = JSON.stringify(obj);
  sockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  });
}

// ── Periodic mode analysis and push ──────────────────────────────────────────
setInterval(() => {
  const report = analyseHistory();
  console.log(`[ANALYSIS] Mode=${report.mode} p95=${report.stats.p95_hz}Hz samples=${report.stats.samples}`);

  // Push to device via bridge
  sendToBridge({
    type: "command",
    data: { cmd: "set_mode", mode: report.mode }
  });

  // Push analysis to all dashboards
  broadcast(dashboardSockets, { type: "analysis", data: report });

}, SEND_REPORT_EVERY_S * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log("================================================");
  console.log(`  Tremor Spoon Server v2.0 — Port ${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log("================================================");
});
