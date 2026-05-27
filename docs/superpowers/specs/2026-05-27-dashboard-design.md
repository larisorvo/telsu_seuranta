# Dashboard Tab — Design Spec
**Date:** 2026-05-27

## Overview

A new **Dashboard** tab in the Telsu seuranta Google Sheet that compares LiveWrapped and Google AdX data for a selected date. Driven entirely by SUMIF formulas — no script changes required.

## Goal

Let users spot revenue discrepancies between LW and GAM, compare sold impressions, and compare viewability per placement for any given day.

---

## Sheet Structure

### Date Cell

- **Cell B1** contains `=TODAY()-1` (yesterday) as the default formula
- The user can overwrite B1 with any date string (`YYYY-MM-DD`) to view a different day
- All formulas in the tab reference B1 as the date filter

### KPI Summary (row 3)

Three summary boxes built from cells, one per metric group:

| Label | LW value | GAM value | Diff |
|---|---|---|---|
| Total Revenue | `SUMIF(LW!A:A,B1,LW!I:I)` | `SUMIF(Google!A:A,B1,Google!I:I)` | GAM−LW (€ and %) |
| Total Sold Impressions | `SUMIF(LW!A:A,B1,LW!H:H)` | `SUMIF(Google!A:A,B1,Google!H:H)` | GAM−LW |
| Avg In View % | weighted avg from LW sold×inview | weighted avg from GAM sold×inview | diff in pp |

### Comparison Table (rows 6+)

**Header row (row 6):** grouped column headers with color bands  
**Sub-header row (row 7):** LW / GAM sub-labels per group  
**Data rows (rows 8–14):** one row per placement (7 placements)  
**Total row (row 15):** SUM of each column

Placements (fixed list, rows 8–14):
1. Telsu.fi Bottom
2. Telsu.fi Cont
3. Telsu.fi Cont 1
4. Telsu.fi Cont 2
5. Telsu.fi Dets
6. Telsu.fi Top
7. Telsu.fi Search

**Columns per row:**

| Group | Column | Formula source |
|---|---|---|
| Available Impr | LW | `SUMIFS(LW!F:F, LW!A:A, $B$1, LW!E:E, A8)` |
| Available Impr | GAM | `SUMIFS(Google!F:F, Google!A:A, $B$1, Google!E:E, A8)` |
| Sold Impr | LW | `SUMIFS(LW!H:H, ...)` |
| Sold Impr | GAM | `SUMIFS(Google!H:H, ...)` |
| Revenue | LW | `SUMIFS(LW!I:I, ...)` |
| Revenue | GAM | `SUMIFS(Google!I:I, ...)` |
| Revenue | Diff (€) | GAM − LW |
| In View % | LW | `SUMIFS(LW!G:G,...) / SUMIFS(LW!F:F,...)` (viewable/avail) |
| In View % | GAM | `SUMIFS(Google!G:G,...) / SUMIFS(Google!F:F,...)` |

Column letters: A=Placement, B=LW Avail, C=GAM Avail, D=LW Sold, E=GAM Sold, F=LW Rev, G=GAM Rev, H=Rev Diff, I=LW InView%, J=GAM InView%

### Formatting

- **Revenue Diff (col H):** conditional formatting — red background when value < −€5, green when > €5
- **In View % columns:** formatted as percentage (1 decimal place)
- **Revenue columns:** formatted as €#,##0.00
- **Impression columns:** formatted as integer with thousands separator
- **Column group headers:** color-banded (blue = Available, green = Sold, orange = Revenue, purple = In View %)
- **Total row:** bold, light grey background

---

## Implementation Notes

- Pure Google Sheets formulas — the Apps Script does not write to the Dashboard tab
- The Dashboard tab reads from LW and Google tabs which the script populates daily
- If no data exists for B1's date in a source, all cells for that source show 0
- In View % uses viewable/available ratio rather than raw percentageInView to give a consistent weighted average when placements are aggregated
- The placement list in column A is hardcoded (not formula-driven) since the canonical names are fixed

---

## Out of Scope

- Charts or sparklines (can be added later)
- Multi-day range view (Option C from brainstorming — future enhancement)
- Automatic conditional formatting thresholds (user can adjust after setup)
