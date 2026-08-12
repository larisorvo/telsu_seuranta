# Custom Date Range Selector Design

**Goal:** Replace the Dashboard's fixed Date+Days selector (single anchor date,
window of 1 or 3 days ending on it) with a fully custom Start/End date range,
so any arbitrary range can be viewed.

## Background

The Dashboard tab currently filters every table by a window computed from two
cells: `B1` (anchor date, `=TODAY()-1` by default, manually overridable) and
`E1` (a "Days" dropdown restricted to `1` or `3`). Every SUMIFS date-filter
criteria pair across the KPI rows, Block 1 (Available/Sold/Revenue), and
Block 2 (In View % / eCPM / Weighted Revenue) currently reads:

```
Sheet!A:A,">="&($B$1-$E$1+1),Sheet!A:A,"<="&$B$1
```

This was introduced in the [multi-day window selector](2026-06-16-multi-day-window-design.md)
feature, which explicitly noted the mechanism "generalizes to any day count."
This design goes further: instead of a day *count* ending on an anchor date,
the user picks the Start and End dates directly.

## UI Changes (row 1)

| Cell | Old | New |
|---|---|---|
| A1 | `"Date"` label | `"Start"` label |
| B1 | `=TODAY()-1` (anchor date) | `=TODAY()-1` (start date) |
| C1 | hint text | `"End"` label |
| D1 | `"Days"` label | `=TODAY()-1` (end date) |
| E1 | Days value, dropdown restricted to `[1, 3]` | hint text: `"← type any YYYY-MM-DD in Start/End for a custom range"` |

Both `B1` and `D1` default to `=TODAY()-1` on every dashboard rebuild
(`setupDashboard()`), reproducing today's default single-day view. Neither is
persisted across rebuilds — this matches `B1`'s existing behavior today (it
is unconditionally reset to the formula default on every `setupDashboard()`
call; only the config row 2 values and the old `E1` Days value were
persisted). The `E1` data-validation dropdown and the `savedDays`
read/restore logic are removed entirely, since there's no longer a
constrained value to persist or validate.

## Formula Change Pattern

Every SUMIFS date-filter criteria pair of the form:

```
Sheet!A:A,">="&($B$1-$E$1+1),Sheet!A:A,"<="&$B$1
```

becomes:

```
Sheet!A:A,">="&$B$1,Sheet!A:A,"<="&$D$1
```

This is a mechanical two-part replacement applied identically everywhere the
pattern appears in `setupDashboard()`:
- KPI rows 3–7 (Revenue actual, Revenue weighted, Sold Impr weighted, Avg In
  View %)
- Block 1 T1 (Available), T2 (Sold), T3 (Revenue) — per-placement rows and
  TOTAL row
- Block 2 T4 (In View %), T5 (eCPM), T6 (Weighted Revenue) — per-placement
  rows and TOTAL row

No formula's structure changes beyond widening/relocating the date-criteria
pair — aggregation logic (sums, divisions by share/cost-factor in row 2)
stays identical, since row 2 config cells (`B2`, `D2`, `G2`) are untouched by
this change.

## Number Formats & Styling

- `D1` gets the same `yyyy-mm-dd` number format currently applied to `B1`.
- `C1` (the new "End" label) gets the same bold styling as `A1`.
- `D1` (the new End date value) gets the same bold + size-12 styling as `B1`.

## Edge Cases

If `End < Start`, every SUMIFS in the affected tables returns `0` (a
`">="` /`"<="` pair with max below min simply matches no rows) — no formula
errors, no extra validation needed. This is the same graceful-empty-result
behavior SUMIFS already has today if someone hand-edits `B1` to a date with
no data.

## Out of Scope

- The 7-day trend chart helper section (rows 33–41) and its 3 line charts in
  `refreshCharts()` are unaffected — they already independently compute a
  fixed daily breakdown for the last 7 calendar days from the `LW` sheet's
  own dates, unrelated to row 1.
- No day-by-day breakdown view within the range — selecting a range still
  shows one summed total per table across all days in `[Start, End]`, not a
  per-day column.
- No relative/preset range shortcuts (e.g. "last 7 days", "this month").
  Only manual Start/End date entry, matching how `B1` already supports
  manual override today.
