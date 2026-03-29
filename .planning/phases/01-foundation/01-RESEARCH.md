# Phase 1: Foundation - Research

**Researched:** 2026-03-28
**Domain:** React/Express project scaffolding + SQLite seed data generation (synthetic tremor telemetry)
**Confidence:** MEDIUM-HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | User can view a profile selection screen listing 2 demo profiles with name and avatar/icon | React Router + profile list component; profiles table in SQLite |
| PROF-02 | User can click a profile to navigate to that profile's dashboard | React Router `<Link>` or `useNavigate` to `/profile/:id` route |
| DATA-01 | Database is seeded with synthetic continuous telemetry data for both profiles covering 7 days | `better-sqlite3` + seed script; ~20,160 rows per profile at 30-second intervals |
| DATA-02 | Synthetic data produces realistic angle values (5-130°) that look like genuine tremor correction patterns | Sum-of-sinusoids at tremor frequencies (4-12 Hz envelope) + circadian amplitude modulation + temporal smoothing + Gaussian noise |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield scaffolding + seed-data phase. The two profile requirements (PROF-01, PROF-02) are straightforward React Router navigation with a profiles table. The data requirements (DATA-01, DATA-02) are the interesting technical challenge: generating synthetic telemetry that convincingly resembles continuous tremor stabilization logs.

The stack is decided: React frontend + Node.js/Express backend. The database choice is SQLite — appropriate for a 2-profile demo with static synthetic data. `better-sqlite3` (synchronous SQLite driver) is the right choice for the seed script because it eliminates async ceremony in a one-shot script context.

For synthetic data realism, published literature confirms essential tremor presents at 4-12 Hz dominant frequency with amplitude that varies by time of day (circadian pattern) and day-to-day variability. The correction angle (5-130°) represents the stabilization device's response magnitude. Critically, consecutive samples must be temporally correlated — independent random draws per sample produce visual scatter (random noise) rather than waveform-like structure. Use an exponential moving average (EMA) filter: each sample = 0.85 * previous + 0.15 * new_target, producing smooth wave-like transitions between consecutive readings.

**Primary recommendation:** Scaffold with Vite (not Create React App, which is abandoned), use `better-sqlite3` for the seed script, generate ~20,160 rows per profile at 30-second intervals covering 7 days, using a circadian amplitude envelope with EMA temporal smoothing to produce waveform-like data that passes visual inspection.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Frontend UI framework | Decided by project; industry standard |
| Vite | 5.x | Frontend build tool / dev server | CRA is abandoned; Vite is the current standard |
| React Router | 6.x | Client-side routing (profile nav) | Standard React routing library |
| Express | 4.x | Backend HTTP server | Decided by project |
| better-sqlite3 | 9.x | SQLite driver for Node.js | Synchronous API; ideal for seed scripts; actively maintained |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | 2.x | CORS middleware for Express | Required when Vite dev server (5173) calls Express (5000) |
| concurrently | 8.x | Run client + server together | Dev convenience for monorepo without Docker |
| nodemon | 3.x | Auto-restart server on file change | Dev only; server-side hot reload |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite + better-sqlite3 | PostgreSQL | PostgreSQL requires a running server process; overkill for 2-profile demo with static data |
| Vite | Create React App | CRA is unmaintained (last release 2022); Vite is faster and actively maintained |
| better-sqlite3 | sqlite3 (async) | sqlite3 forces async/await throughout the seed script; better-sqlite3 synchronous API is simpler for one-shot seeding |

**Installation (server):**
```bash
npm install express cors better-sqlite3
npm install --save-dev nodemon
```

**Installation (client):**
```bash
npm create vite@latest client -- --template react
cd client && npm install react-router-dom
```

**Installation (root dev tooling):**
```bash
npm install --save-dev concurrently
```

---

## Architecture Patterns

### Recommended Project Structure

```
tremorix/
├── client/                  # Vite React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ProfileSelect.jsx   # PROF-01: profile list screen
│   │   │   └── Dashboard.jsx       # Phase 2: dashboard per profile
│   │   ├── components/
│   │   │   └── ProfileCard.jsx     # Avatar + name card
│   │   ├── App.jsx                 # Router setup
│   │   └── main.jsx
│   └── package.json
├── server/
│   ├── db/
│   │   └── schema.sql              # Table definitions
│   ├── scripts/
│   │   └── seed.js                 # Synthetic data generator
│   ├── routes/
│   │   └── profiles.js             # GET /api/profiles
│   ├── index.js                    # Express entry point
│   └── package.json
└── package.json                    # Root: concurrently scripts
```

### Pattern 1: React Router v6 — Profile Navigation

**What:** Define routes at the app level; navigate from profile list to dashboard by profile ID.
**When to use:** Any multi-screen React app with URL-addressable pages.

```jsx
// Source: https://reactrouter.com/en/main/start/tutorial
// client/src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProfileSelect from './pages/ProfileSelect';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProfileSelect />} />
        <Route path="/profile/:profileId" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```jsx
// client/src/pages/ProfileSelect.jsx — navigate on profile click
import { useNavigate } from 'react-router-dom';

function ProfileCard({ profile }) {
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate(`/profile/${profile.id}`)}>
      <img src={profile.avatar_url} alt={profile.name} />
      <span>{profile.name}</span>
    </div>
  );
}
```

### Pattern 2: SQLite Schema — Future-Proof Telemetry Table

**What:** Flat telemetry table with profile_id FK and ISO timestamp. Designed so real-time streaming and ML analysis can be added without schema changes.
**When to use:** Any time telemetry data must support future time-series queries.

```sql
-- server/db/schema.sql
CREATE TABLE IF NOT EXISTS profiles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  avatar_url TEXT
);

CREATE TABLE IF NOT EXISTS telemetry (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id       INTEGER NOT NULL REFERENCES profiles(id),
  recorded_at      TEXT NOT NULL,   -- ISO 8601: "2026-03-21T08:00:00Z"
  correction_angle REAL NOT NULL    -- degrees, 5.0–130.0
);

CREATE INDEX IF NOT EXISTS idx_telemetry_profile_time
  ON telemetry(profile_id, recorded_at);
```

### Pattern 3: Synthetic Tremor Data Generation

**What:** Generate correction angles that look like genuine tremor stabilization data using a circadian amplitude envelope with temporal smoothing.
**When to use:** Any time demo data must pass visual inspection as realistic waveforms.

The approach:
- Tremor frequency: 4-12 Hz (published range for essential tremor)
- Correction angle represents device response amplitude (5-130°)
- Data is sampled at 30-second intervals (~20,160 rows per profile over 7 days)
- Each sample is the mean correction angle over that 30-second window — realistic because devices report averaged readings
- Amplitude modulated by time-of-day envelope: sleep hours (midnight-6am) → lower amplitude (5-25°); active hours (9am-8pm) → higher amplitude (30-130°)
- Day-to-day variation: multiply by a "good day / bad day" factor drawn once per day
- **Temporal smoothing via EMA (CRITICAL for visual realism):** Each sample = 0.85 * previous + 0.15 * new_target. Without this, independent random draws per sample produce scatter that looks like noise rather than a waveform.
- Gaussian noise added after smoothing to prevent mechanical regularity

```javascript
// server/scripts/seed.js
// Source: clinical research on essential tremor characteristics
// (PMC8380769, PMC11568799 — tremor amplitude and circadian patterns)
// EMA smoothing ensures temporal correlation between consecutive samples
// producing waveform-like structure (DATA-02 "not random noise" requirement)

function getTargetAngle(hourOfDay, dayFactor) {
  // Circadian envelope: waking hours have more tremor activity
  const isAsleep = hourOfDay < 6 || hourOfDay >= 23;
  const isMorning = hourOfDay >= 6 && hourOfDay < 9;

  let baseAmplitude;
  if (isAsleep) {
    baseAmplitude = 5 + Math.random() * 10;   // 5-15°: minimal, device barely active
  } else if (isMorning) {
    baseAmplitude = 15 + Math.random() * 30;  // 15-45°: warming up
  } else {
    baseAmplitude = 30 + Math.random() * 80;  // 30-110°: active period
  }

  // Day factor: 0.6 (good day) to 1.2 (bad day)
  return baseAmplitude * dayFactor;
}

function seedProfile(db, profileId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const insert = db.prepare(
    'INSERT INTO telemetry (profile_id, recorded_at, correction_angle) VALUES (?, ?, ?)'
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  // Generate day factors once per day (profile-specific variation)
  const dayFactors = Array.from({ length: 7 }, () => 0.6 + Math.random() * 0.6);

  const rows = [];
  let current = new Date(sevenDaysAgo);
  let smoothedAngle = 20; // EMA state: initial value

  while (current <= now) {
    const hour = current.getHours();
    const daysSinceStart = Math.floor((current - sevenDaysAgo) / (24 * 60 * 60 * 1000));
    const dayFactor = dayFactors[Math.min(daysSinceStart, 6)];

    // EMA: new value moves 15% toward target, retains 85% of previous
    // This produces temporal correlation — waveform shape rather than scatter
    const target = getTargetAngle(hour, dayFactor);
    smoothedAngle = 0.85 * smoothedAngle + 0.15 * target;

    // Add small Gaussian noise after smoothing (±4°)
    const noise = (Math.random() + Math.random() - 1) * 4;
    const angle = Math.max(5, Math.min(130, smoothedAngle + noise));

    rows.push([profileId, current.toISOString(), angle]);
    current = new Date(current.getTime() + 30 * 1000); // +30 seconds
  }

  insertMany(rows);
}
```

### Anti-Patterns to Avoid

- **Using Create React App:** CRA is abandoned. Last meaningful release was 2022. Vite is the replacement.
- **PostgreSQL for this demo:** Requires a running database server. SQLite is a file — zero infrastructure, still supports indexes and joins.
- **Async SQLite for seed scripts:** `sqlite3` (npm) is callback/promise based. `better-sqlite3` synchronous API is cleaner for a one-shot script.
- **Flat random data for DATA-02:** `Math.random()` uniformly distributed across 5-130° looks obviously artificial. Must use circadian envelope.
- **Independent random draws without temporal smoothing:** Even with a correct circadian envelope, if each sample is drawn independently it looks like scatter/noise on the chart. The EMA smoothing step is required.
- **1-second sampling intervals:** 7 days × 2 profiles × 86,400 rows/day = ~1.2M rows. Unnecessary. 30-second intervals give 40,320 total rows — visually identical on a 7-day chart.
- **Storing timestamps as Unix integers only:** Store ISO 8601 strings or proper SQLite TEXT for readability and timezone-safe queries. Add an index on `(profile_id, recorded_at)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Routing | Custom history/hash navigation | React Router v6 | Browser history management, nested routes, params are non-trivial |
| SQLite transactions for bulk insert | Manual loop with individual inserts | `better-sqlite3` transaction API | Individual inserts for 20k rows is 100x slower; transactions batch them |
| CORS handling | Manual header middleware | `cors` npm package | Header permutation rules are subtle (preflight OPTIONS, credentials, etc.) |
| Frontend dev proxy | Hardcode API URLs | Vite `server.proxy` config | Avoids CORS issues during development; single config change |

**Key insight:** The seed script is the most custom thing in this phase. Everything else (routing, CORS, DB driver) has mature solutions. Don't invent what's already solved.

---

## Common Pitfalls

### Pitfall 1: DATA-02 Fails Visual Inspection — Flat or Noisy Data

**What goes wrong:** Synthetic data looks like random noise or a flat line, failing the "genuine tremor correction pattern" requirement.
**Why it happens:** Using `Math.random()` directly produces uniform distribution; no circadian pattern means no day/night contrast; no day-to-day variation makes profiles look identical.
**How to avoid:** Use circadian amplitude envelope (sleep/morning/active zones). Add per-day variability factor. Use sum of Gaussian noise terms for bell-curve distribution around the envelope.
**Warning signs:** Chart looks like static; no visible peaks during daytime hours; both profiles look identical.

### Pitfall 2: DATA-02 Fails Visual Inspection — Scatter Instead of Waveform

**What goes wrong:** Even with correct circadian envelope, the chart looks like random scatter (dots that jump between extremes each sample) rather than smooth waveform-like curves.
**Why it happens:** Each 30-second sample is drawn independently. Consecutive samples have no temporal correlation, so the chart renders as noisy scatter regardless of the envelope.
**How to avoid:** Apply EMA smoothing between samples: `smoothed = 0.85 * previous + 0.15 * newTarget`. This creates the gradual rises and falls that make waveform data look continuous and realistic.
**Warning signs:** Chart resembles a dense dot cloud instead of flowing curves; zooming in shows zig-zag pattern between adjacent samples.

### Pitfall 3: CORS Errors Between Vite Dev Server and Express

**What goes wrong:** Browser blocks API calls from `localhost:5173` (Vite) to `localhost:5000` (Express) with CORS error.
**Why it happens:** Different ports = different origins.
**How to avoid:** Add `cors` middleware to Express (`app.use(cors())`). Alternatively configure Vite `server.proxy` to forward `/api` requests to Express — this approach also works in production-like setups.
**Warning signs:** `Access-Control-Allow-Origin` errors in browser console on first API call.

### Pitfall 4: SQLite Seed Runs Multiple Times

**What goes wrong:** Running `node seed.js` twice doubles the data; timestamps overlap.
**Why it happens:** No idempotency guard in seed script.
**How to avoid:** Add `DELETE FROM telemetry WHERE profile_id = ?` before seeding each profile. Or use `DROP TABLE IF EXISTS` + recreate. Make seed idempotent.
**Warning signs:** Row count doubles on re-seed; chart shows double-density data.

### Pitfall 5: React Router v6 Breaking Change from v5

**What goes wrong:** Using `<Switch>`, `component={}`, or `useHistory()` from React Router v5 patterns in a v6 project.
**Why it happens:** Many tutorials and AI-generated code still use v5 patterns.
**How to avoid:** Use `<Routes>` (not `<Switch>`), `element={<Component />}` (not `component={}`), `useNavigate()` (not `useHistory()`).
**Warning signs:** Console errors about unknown props; `useHistory is not a function`.

### Pitfall 6: Profile Avatar as Broken Image

**What goes wrong:** Avatar URLs in seed data 404 or show broken image icons.
**Why it happens:** Using placeholder URLs that require internet or don't exist.
**How to avoid:** Use UI Avatars API (`https://ui-avatars.com/api/?name=...`) which generates initials-based avatars on demand, or use inline SVG/emoji as avatar fallback in the component.
**Warning signs:** Broken image icon in profile list screen.

---

## Code Examples

### Express API: Profiles Endpoint

```javascript
// Source: https://expressjs.com/en/guide/routing.html
// server/routes/profiles.js
const express = require('express');
const router = express.Router();

module.exports = (db) => {
  router.get('/', (req, res) => {
    const profiles = db.prepare('SELECT id, name, avatar_url FROM profiles').all();
    res.json(profiles);
  });
  return router;
};
```

```javascript
// server/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const db = new Database('./db/tremorix.db');

app.use(cors());
app.use(express.json());
app.use('/api/profiles', require('./routes/profiles')(db));

app.listen(5000, () => console.log('Server running on port 5000'));
```

### Root package.json: Dev Script

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "seed": "node server/scripts/seed.js"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### Vite Proxy Config (avoids CORS in development)

```javascript
// Source: https://vitejs.dev/config/server-options.html#server-proxy
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
```

### better-sqlite3: Bulk Insert with Transaction

```javascript
// Source: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
const Database = require('better-sqlite3');
const db = new Database('./db/tremorix.db');

// Run schema
db.exec(require('fs').readFileSync('./db/schema.sql', 'utf8'));

// Bulk insert using transaction (orders of magnitude faster than individual inserts)
const insert = db.prepare(
  'INSERT INTO telemetry (profile_id, recorded_at, correction_angle) VALUES (?, ?, ?)'
);
const insertMany = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

insertMany(rowsArray); // rowsArray: [[profileId, isoString, angle], ...]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create React App | Vite | ~2022-2023 | CRA abandoned; Vite is 10-20x faster dev startup |
| React Router `<Switch>` | React Router `<Routes>` | v6 (2021) | Breaking change; v5 patterns still common in tutorials |
| `sqlite3` (async callbacks) | `better-sqlite3` (sync) | ~2018 onwards | Synchronous API eliminates async ceremony for scripts |
| `useHistory()` | `useNavigate()` | React Router v6 | API rename; v5 hook no longer exists |

**Deprecated/outdated:**
- `create-react-app`: Officially unmaintained. Do not use. `npm create vite@latest` is the replacement.
- React Router v5 patterns (`<Switch>`, `component={}`, `useHistory`): v6 is a breaking change. All new projects use v6 API.

---

## Open Questions

1. **Avatar source for demo profiles**
   - What we know: Two profiles need name + avatar/icon (PROF-01)
   - What's unclear: Whether to use real images, generated avatars, or SVG icons
   - Recommendation: Use `https://ui-avatars.com/api/?name=Alice+Chen&background=0D8ABC&color=fff` for Profile 1 and similar for Profile 2 — no assets to manage, always renders

2. **Profile names for demo data**
   - What we know: 2 profiles, no auth, demo context
   - What's unclear: Names are not specified in requirements
   - Recommendation: Use "Alice Chen" and "Marcus Webb" — clinically neutral, diverse, memorable for demo context

3. **Sampling rate confirmation**
   - What we know: 30-second intervals = ~20,160 rows/profile = ~40,320 total; looks continuous at 7-day scale
   - What's unclear: Whether Phase 2 charting library (unknown yet) has performance concerns at this density
   - Recommendation: Proceed with 30-second intervals. If Phase 2 chart performance degrades, add a query-level downsampling endpoint. Do not change the underlying data.

4. **EMA smoothing factor tuning**
   - What we know: 0.85/0.15 split produces gradual transitions; too high a retain factor makes changes too slow (flat line appearance); too low makes it jerky
   - What's unclear: The exact value that looks "best" depends on chart zoom level and rendering style
   - Recommendation: Use 0.85 as the starting value. Adjust if the chart in Phase 2 shows the data as too smooth (increase 0.15) or too noisy (increase 0.85).

---

## Sources

### Primary (HIGH confidence)
- `better-sqlite3` official docs: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md — transaction API, synchronous usage
- React Router v6 official docs: https://reactrouter.com/en/main/start/tutorial — Routes, Link, useNavigate patterns
- Vite official docs: https://vitejs.dev/config/server-options.html — proxy configuration
- Express official docs: https://expressjs.com/en/guide/routing.html — router setup

### Secondary (MEDIUM confidence)
- PMC8380769 (Frontiers in Neurology, 2021): [Wearable Technologies for Tremor Suppression](https://pmc.ncbi.nlm.nih.gov/articles/PMC8380769/) — confirms 4-12 Hz essential tremor frequency range
- PMC11568799 (Tremor and Other Hyperkinetic Movements, 2024): [Peripheral Devices for Essential Tremor](https://pmc.ncbi.nlm.nih.gov/articles/PMC11568799/) — confirms correction device response amplitude range and circadian activity patterns
- [Frequency-Selective Suppression of Essential Tremor](https://movementdisorders.onlinelibrary.wiley.com/doi/10.1002/mds.29966) (2024) — confirms 4-12 Hz tremor range

### Tertiary (LOW confidence — training data)
- CRA deprecation status: Based on training data (last CRA release circa 2022); verify at https://create-react-app.dev if needed
- `concurrently` package usage for monorepo dev: Common community pattern, not from official docs
- EMA smoothing factor (0.85): Reasoned from signal processing principles; not validated against real device log aesthetics

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — React/Express/SQLite versions from training data; patterns verified via official docs URLs
- Architecture: HIGH — standard monorepo layout, React Router v6 patterns from official docs
- Synthetic data algorithm: MEDIUM — tremor frequency range verified via published clinical literature; EMA smoothing and envelope values are reasoned from domain knowledge, not validated against real device logs
- Pitfalls: HIGH — CORS, seed idempotency, CRA deprecation, temporal correlation are well-documented real issues

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack; 30-day window)
