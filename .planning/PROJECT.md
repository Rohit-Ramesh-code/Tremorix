# Tremorix Dashboard

## What This Is

A web-based demo dashboard for a handheld tremor stabilization assistive device. Two demo profiles represent device users; selecting a profile reveals a clinical dashboard displaying a continuous 7-day waveform of device correction angles alongside a summary metrics table. The hardware is already built — this project delivers the software interface layer.

## Core Value

A clinician or observer can select any profile and immediately see a clear, readable picture of that person's tremor stabilization history over the past 7 days.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can view a profile selection screen showing 2 demo profiles
- [ ] User can click a profile and be taken to that profile's dashboard
- [ ] Dashboard displays a continuous waveform of device correction angles over the past 7 days (Y: 5–130°, X: time across 7 days)
- [ ] Dashboard displays a metrics table showing average X-axis deviation and average Y-axis deviation
- [ ] Database is pre-seeded with realistic synthetic telemetry data for both profiles
- [ ] UI follows a medical/clinical aesthetic (clean, white, professional)

### Out of Scope

- Real-time device streaming — hardware is done but live telemetry wiring is deferred
- Machine learning trend analysis — deferred to a future phase
- More than 2 user profiles — demo scope only
- Authentication/login — profiles are selected directly, no auth required
- Mobile app — web dashboard only

## Context

- The physical device uses a microcontroller + IMU + micro-servo in a single-axis gimbal
- Device logs continuously throughout the day; the dashboard represents this as a dense continuous waveform
- Angle range: 5° (minimal tremor) to 130° (maximum correction needed)
- The project is a demo — synthetic data replaces actual device data for now
- Real device streaming and ML analysis are planned future capabilities, so the data model should not block those additions

## Constraints

- **Tech Stack**: React frontend + Node.js/Express backend — already decided
- **Scope**: Demo with 2 profiles; not a production multi-tenant system
- **Data**: Synthetic only for v1; no live hardware connection required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Synthetic data first | Hardware is done but streaming integration is complex; dashboard can be built and validated independently | — Pending |
| 2 profiles only | Demo context; keeps data generation and UI simple | — Pending |
| Defer ML | Dashboard value is demonstrable without trend analysis; ML adds complexity best tackled separately | — Pending |
| React + Node.js | User preference; well-suited for data-heavy dashboard with future real-time capabilities | — Pending |

---
*Last updated: 2026-03-28 after initialization*
