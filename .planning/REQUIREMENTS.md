# Requirements: Tremorix Dashboard

**Defined:** 2026-03-28
**Core Value:** A clinician or observer can select any profile and immediately see a clear, readable picture of that person's tremor stabilization history over the past 7 days.

## v1 Requirements

### Profiles

- [x] **PROF-01**: User can view a profile selection screen listing 2 demo profiles with name and avatar/icon
- [x] **PROF-02**: User can click a profile to navigate to that profile's dashboard

### Dashboard

- [x] **DASH-01**: Dashboard displays a continuous waveform chart (X: time across past 7 days, Y: correction angle 5–130°)
- [x] **DASH-02**: Dashboard displays a metrics table showing average X-axis deviation and average Y-axis deviation for the past 7 days
- [ ] **DASH-03**: Dashboard shows the profile name/identity clearly

### Data

- [x] **DATA-01**: Database is seeded with synthetic continuous telemetry data for both profiles covering 7 days
- [x] **DATA-02**: Synthetic data produces realistic angle values (5–130°) that look like genuine tremor correction patterns

### UI/UX

- [ ] **UI-01**: Interface follows a medical/clinical aesthetic — clean, white, professional typography

## v2 Requirements

### Real-time Streaming

- **RT-01**: Dashboard receives live telemetry from physical device via WebSocket
- **RT-02**: Waveform updates in real time as device sends readings

### Machine Learning

- **ML-01**: System identifies long-term tremor frequency trends across sessions
- **ML-02**: System detects session-based fatigue patterns
- **ML-03**: Dashboard surfaces ML-derived trend summaries per profile

### Extended Profiles

- **PROF-03**: System supports more than 2 user profiles
- **PROF-04**: Profile data includes device pairing/connection status

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication / login | Demo context; profiles accessed directly |
| Mobile app | Web-first; mobile deferred |
| Real-time streaming (v1) | Hardware done but integration deferred |
| ML trend analysis (v1) | Adds complexity; deferred to v2 |
| More than 2 profiles (v1) | Demo scope only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 1 | Complete |
| PROF-02 | Phase 1 | Complete |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 2 | Complete |
| DASH-03 | Phase 2 | Pending |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| UI-01 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after initial definition*
