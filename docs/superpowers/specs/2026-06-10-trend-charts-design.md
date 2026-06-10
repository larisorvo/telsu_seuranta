# Trend Charts — Design Spec
**Date:** 2026-06-10

## Overview

Add three 7-day trend line charts to the Dashboard tab comparing Mindmax GAM vs IM (LiveWrapped + Own GAM) for Revenue, Sold Impressions, and In View %. Charts are script-built and positioned below the existing placement tables.

---

## Decisions

| Question | Decision |
|---|---|
| Location | Below existing tables, same Dashboard tab (rows 32+) |
| Chart type | Line chart — two lines per chart (Mindmax solid blue, IM dashed orange) |
| Date window | Always last 7 days of actual data in the sheets (not tied to B1 selector) |
| Implementation | Script-built data range + EmbeddedChartBuilder |

---

## Data Model

### Helper range (Dashboard rows 33–41)

The script writes a 9-row block starting at row 33:

| Row | Content |
|---|---|
| 33 | Section header label: "7-day trend" |
| 34 | Column headers: Date, Mindmax Rev, IM Rev, Mindmax Sold, IM Sold, Mindmax InView%, IM InView% |
| 35–41 | 7 data rows — one per day, oldest first |

Columns A–G (7 columns total).

The row group (33–41) is collapsed by default so it doesn't clutter the view.

### How "last 7 days" is determined

The script reads column A of the LW sheet, collects all unique date strings, sorts them descending, and takes the 7 most recent. This means the window reflects what's actually in the sheets — not necessarily the last 7 calendar days if a refresh was missed. If fewer than 7 dates exist, the chart uses however many are available (minimum 1).

### Aggregation per date

For each of the 7 dates, the script sums across sheets:

| Column | Formula |
|---|---|
| Mindmax Rev | `SUMIFS(Google!I:I, Google!A:A, date)` |
| IM Rev | `SUMIFS(LW!I:I, LW!A:A, date)` + `SUMIFS(OwnGAM!I:I, OwnGAM!A:A, date)` |
| Mindmax Sold | `SUMIFS(Google!H:H, Google!A:A, date)` |
| IM Sold | `SUMIFS(LW!H:H, LW!A:A, date)` + `SUMIFS(OwnGAM!H:H, OwnGAM!A:A, date)` |
| Mindmax InView% | `SUMIFS(Google!G:G, …) / SUMIFS(Google!H:H, …)` — weighted |
| IM InView% | `(SUMIFS(LW!G:G,…) + SUMIFS(OwnGAM!G:G,…)) / (SUMIFS(LW!H:H,…) + SUMIFS(OwnGAM!H:H,…))` — weighted |

In View % uses viewable/sold ratio (same definition as the rest of the Dashboard). Rows where sold = 0 get 0 for In View %.

---

## Charts

Three `EmbeddedChart` objects anchored below row 42, positioned side by side.

| Chart | Data columns | Header color |
|---|---|---|
| Revenue (€) | A (dates), B (Mindmax), C (IM) | Orange `#ffe0b2` |
| Sold Impressions | A (dates), D (Mindmax), E (IM) | Green `#c8e6c9` |
| In View % | A (dates), F (Mindmax), G (IM) | Purple `#f3e5f5` |

**Per chart:**
- Type: `Charts.ChartType.LINE`
- Series 0 (Mindmax): solid blue `#4285f4`
- Series 1 (IM HB+GAM): dashed orange `#ea8600`
- X-axis: dates formatted `dd.MM` (short Finnish-style)
- Y-axis: auto-scaled; Revenue formatted as `€#,##0.00`, Sold as `#,##0`, In View % as `0%`
- Legend: bottom
- Size: ~300 × 220px each; all three fit within columns A–R

---

## Script Changes

### New function: `refreshCharts()`

```
1. Get LW sheet, read col A → collect unique date strings
2. Sort descending, take top 7, reverse (oldest first)
3. Get/create Dashboard tab
4. Write helper range header (row 33 label, row 34 column headers)
5. For each of the 7 dates: calculate aggregated values, write row 35–41
6. Collapse row group 33–41
7. Remove any existing charts whose title contains "7-day"
8. Build and insert 3 new EmbeddedCharts pointing to the helper range columns
```

### Changes to existing functions

- `setupDashboard()` — call `refreshCharts()` at the end
- `refreshData()` — call `refreshCharts()` after refreshing all data sources
- `onOpen()` menu — add item "Refresh charts (7-day trend)"

---

## Out of Scope

- Charts tied to the B1 date selector
- More than 7 days
- Per-placement breakdown in charts (totals only)
- Sparklines or mini-charts inside the placement tables
