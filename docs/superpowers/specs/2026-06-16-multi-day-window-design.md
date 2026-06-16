# Multi-Day Window Selector Design

**Goal:** Let the Dashboard show either a single day (current behavior) or a summed
3-day total, switchable with one dropdown, without changing any table layout.

## Background

The Dashboard tab currently filters every table by a single exact date held in
`B1` (`=TODAY()-1` by default, manually overridable to any `YYYY-MM-DD`). Every
SUMIFS formula across the KPI rows, Block 1 (Available/Sold/Revenue), and
Block 2 (In View % / eCPM / Weighted Revenue) filters on `Sheet!A:A,$B$1`.

## UI Changes (row 1)

- `B1` is unchanged: the anchor date, defaults to yesterday, still manually
  overridable.
- `C1` hint text is unchanged.
- New `D1` = label `"Days"`.
- New `E1` = a dropdown cell with data validation restricted to the list
  `[1, 3]` (plain numbers, not text). Defaults to `1`.

## Formula Change Pattern

Every SUMIFS date-filter criteria pair currently of the form:

```
Sheet!A:A,$B$1
```

becomes a range match:

```
Sheet!A:A,">="&($B$1-$E$1+1),Sheet!A:A,"<="&$B$1
```

With `E1=1` this reduces to filtering on exactly `B1` (today's behavior,
unchanged result). With `E1=3` it sums the 3 days ending on `B1`.

This pattern is applied identically everywhere a date-filter criteria pair
currently appears in `setupDashboard()`:
- KPI rows 3–7 (Revenue actual, Revenue weighted, Sold Impr weighted, Avg In
  View %)
- Block 1 T1 (Available), T2 (Sold), T3 (Revenue) — per-placement rows and
  TOTAL row
- Block 2 T4 (In View %), T5 (eCPM), T6 (Weighted Revenue) — per-placement
  rows and TOTAL row

No new tables, rows, or columns are introduced. No formula's *structure*
changes beyond widening the date-criteria pair — aggregation logic (sums,
divisions by share/cost-factor) stays identical.

## Persistence

`setupDashboard()` already reads and restores `B2`/`D2`/`G2` (IM share, MM
share, cost factor) across rebuilds so user edits aren't lost when the sheet
is regenerated. `E1` (Days) gets the same treatment: read before
`clearContents()`, restored after, defaulting to `1` if absent or invalid.

## Out of Scope

- The 7-day trend chart helper section (rows 33–41) and the 3 line charts are
  unaffected — they already independently compute a fixed daily breakdown
  for the last 7 calendar days, unrelated to this selector.
- No day-by-day breakdown view. Selecting `3` shows one summed 3-day total
  per table, not three side-by-side columns.
- No values besides `1` and `3` in the dropdown for now. The mechanism
  (a single `Days` cell driving a range filter) generalizes to any day count,
  so adding e.g. `7` later is a one-line change to the data-validation list,
  not a redesign.
