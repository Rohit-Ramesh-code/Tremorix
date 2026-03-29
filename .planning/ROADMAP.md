# Roadmap: Tremorix Dashboard

## Overview

Build a web-based demo dashboard for a handheld tremor stabilization device. Phase 1 delivers the data foundation and profile selection screen — seeded synthetic telemetry and the ability to pick a profile. Phase 2 delivers the clinical dashboard itself — the 7-day waveform, metrics table, and professional medical UI. After Phase 2, a clinician or observer can select any profile and immediately see a clear picture of that person's tremor stabilization history.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Seeded synthetic data and profile selection screen
- [ ] **Phase 2: Dashboard** - Clinical waveform display, metrics table, and medical UI

## Phase Details

### Phase 1: Foundation
**Goal**: Users can select a profile from a list and data exists to power the dashboard
**Depends on**: Nothing (first phase)
**Requirements**: PROF-01, PROF-02, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. User sees a screen listing two demo profiles, each with a name and avatar/icon
  2. User can click a profile and be navigated to that profile's route/page
  3. Database contains 7 days of continuous synthetic telemetry for both profiles with angle values in the 5-130 degree range
  4. Synthetic data looks like genuine tremor correction patterns (not flat or random noise)
**Plans**: TBD

### Phase 2: Dashboard
**Goal**: Users can view a complete clinical dashboard for any selected profile
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, UI-01
**Success Criteria** (what must be TRUE):
  1. Dashboard displays a continuous waveform chart spanning 7 days with Y-axis from 5 to 130 degrees
  2. Dashboard displays a metrics table showing average X-axis deviation and average Y-axis deviation for the past 7 days
  3. The selected profile's name is clearly visible on the dashboard
  4. The interface looks clinical and professional — white background, clean typography, no consumer-app styling
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Dashboard | 0/TBD | Not started | - |
