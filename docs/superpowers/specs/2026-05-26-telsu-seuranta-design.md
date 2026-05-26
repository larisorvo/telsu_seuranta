# Telsu Seuranta — Design Spec
**Date:** 2026-05-26

## Overview

A standalone Google Apps Script project that fetches daily ad unit performance data for publisher "Mindmax testi" from the LiveWrapped API and writes it into a Google Sheet on company Drive. The sheet is updated every morning and designed to accommodate a second data source (Google AdX) in phase 2.

## Project Structure

- **Directory:** `C:\Users\laris\claude-code\telsu_seuranta\`
- **Runtime:** Google Apps Script (V8), deployed with clasp
- **Auth:** `LW_API_TOKEN` stored in Script Properties
- **Timezone:** `Europe/Helsinki` in `appsscript.json`

## Google Sheet Structure

New sheet on company Drive. Three tabs:

| Tab | Purpose |
|-----|---------|
| `LW` | LiveWrapped daily data (phase 1) |
| `Google` | Google AdX daily data (phase 2, empty until format is known) |
| `Summary` | Formula-based combined view across both sources |

### Unified Schema (LW and Google tabs)

One row per placement per day. 10 columns:

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| A | Date | `YYYY-MM-DD` string | Daily granularity |
| B | Source | String | `"LiveWrapped"` or `"Google AdX"` |
| C | Publisher | String | e.g. `Mindmax testi` |
| D | Site | String | e.g. `telsu.fi` |
| E | Placement | String | Ad unit name |
| F | Available Impressions | Integer | |
| G | Viewable Impressions | Integer | |
| H | Sold Impressions | Integer | |
| I | Revenue | Decimal (€) | |
| J | In View % | Decimal | e.g. `0.7750` displayed as `77.50%` |

**Upsert key:** Date + Placement. Existing rows are overwritten, new ones appended. Nothing is ever deleted — re-running is always safe.

### Summary Tab

Cell `A1` contains:
```
=QUERY({LW!A2:J; Google!A2:J}, "SELECT * WHERE Col1 IS NOT NULL")
```

This keeps the summary in sync automatically whenever source tabs are updated. No script writes to the Summary tab.

## LiveWrapped API

**Endpoint:** `/Statistics` (same as livewrapped_viewability project)
**Auth:** Bearer token from `LW_API_TOKEN` Script Property

### Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `from` | `YYYY-MM-DD` | Start of single day |
| `to` | `YYYY-MM-DD` | End of single day |
| `aggregateTime` | `false` | Keep per-day rows |
| `aggregateAdUnits` | `false` | Keep per-placement breakdown |
| `aggregateSites` | `false` | Keep site dimension |
| `aggregatePublishers` | `false` | Keep publisher dimension |
| `includeSoldStatistics` | `true` | Required for Sold Impressions and Revenue |

Publisher filtering for "Mindmax testi" is applied client-side if the API does not support a publisher filter parameter.

### Column Mapping (API response → sheet)

| Sheet column | LW API field |
|-------------|--------------|
| Date | `date` |
| Source | hardcoded `"LiveWrapped"` |
| Publisher | `publisher` |
| Site | `site` |
| Placement | `placement` |
| Available Impressions | `availableImpressions` |
| Viewable Impressions | `viewableImpressions` |
| Sold Impressions | `soldImpressions` |
| Revenue | `revenue` |
| In View % | `inViewRate` (decimal 0–1) |

> Exact API field names to be confirmed against API response during implementation.

## Functions

| Function | Purpose |
|----------|---------|
| `refreshData()` | Daily trigger entry point. Fetches last 3 days and upserts into LW tab. |
| `initialLoad()` | Run once manually to seed last 7 days. |
| `fetchDayStats(date)` | Calls LW API for one day. Returns array of row arrays. |
| `upsertRows(sheet, rows)` | Reads existing sheet data, matches by Date+Placement, overwrites or appends. |
| `createDailyTrigger()` | Run once to register the 6 AM time-based trigger. |

## Scheduling

- **Daily trigger:** `refreshData()` at **6:00 AM Helsinki time** every day
- **Fetch window:** Last 3 days on each run (yesterday + 2 prior) to catch late API corrections
- **Initial backfill:** `initialLoad()` fetches last 7 days; run once manually after setup

## Setup Steps (one-time)

1. Create new Google Sheet on company Drive; note the Spreadsheet ID
2. Create `LW`, `Google`, and `Summary` tabs; add headers to LW and Google tabs
3. Add `=QUERY(...)` formula to `Summary!A1`
4. Set `SPREADSHEET_ID` constant in `Code.js`
5. Set `LW_API_TOKEN` in Script Properties
6. Run `initialLoad()` manually to seed 7 days of data
7. Run `createDailyTrigger()` to register the morning trigger

## Phase 2: Google AdX Integration

When the Google AdX daily email report format is confirmed:
- Parse the CSV attachment from Gmail
- Map AdX columns to the unified schema (Source = `"Google AdX"`)
- Write rows into the `Google` tab using the same upsert logic
- The `Summary` tab formula picks up the new data automatically
- Add a `refreshAdxData()` function called from `refreshData()` each morning
