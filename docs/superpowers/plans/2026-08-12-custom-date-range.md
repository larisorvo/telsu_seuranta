# Custom Date Range Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's Date+Days selector (single anchor date, fixed 1-or-3-day window) with independent Start (`B1`) and End (`D1`) date cells, so every table can show any arbitrary date range instead of a fixed-length window.

**Architecture:** Every SUMIFS date-filter criteria pair in `setupDashboard()` currently reads `Sheet!A:A,">="&($B$1-$E$1+1),Sheet!A:A,"<="&$B$1`. This becomes `Sheet!A:A,">="&$B$1,Sheet!A:A,"<="&$D$1` — `B1` keeps its cell address but changes meaning from "anchor date" to "Start date"; `D1` changes from the "Days" label cell to the End date value. No new tables/rows/columns; purely a formula-text and row-1-layout change inside the existing `setupDashboard()` function in `Code.js`.

**Tech Stack:** Google Apps Script (V8 runtime), single file `Code.js`, deployed via `clasp push`. No automated test framework exists for this project — verification per task is `node --check Code.js` (catches JS syntax errors before deploying), and the final task deploys and verifies against the live spreadsheet via `clasp run`.

## Global Constraints

- Single-file Apps Script project (`Code.js`); all changes live inside `setupDashboard()`.
- No automated test framework — `node --check Code.js` is the only pre-deploy syntax gate.
- Deploy via `clasp push --force` (from `telsu_seuranta_gh/`); the live Apps Script project only reflects committed+pushed changes once this runs.
- `refreshCharts()` and the 7-day trend chart are out of scope — do not modify them.

---

### Task 1: Replace the Date+Days row-1 UI with Start/End date cells

**Files:**
- Modify: `Code.js` (the config-preservation block, the Row 1 block, the Number Formats block, and the Styling block inside `setupDashboard()`)

- [ ] **Step 1: Remove `savedDays` from the config-preservation block**

Find this exact block near the top of `setupDashboard()`:

```javascript
  // Preserve user-edited config values across rebuilds
  var savedImShare = 0.25;
  var savedMmShare = 0.75;
  var savedCorrection = 1.0;
  var savedDays = 1;
  if (tab && tab.getLastRow() >= 2) {
    var cfv;
    cfv = tab.getRange('B2').getValue();
    if (cfv > 0 && cfv <= 1) savedImShare = cfv;
    cfv = tab.getRange('D2').getValue();
    if (cfv > 0 && cfv <= 1) savedMmShare = cfv;
    cfv = tab.getRange('G2').getValue();
    if (cfv > 0) savedCorrection = cfv;
    cfv = Number(tab.getRange('E1').getValue());
    if (cfv === 1 || cfv === 3) savedDays = cfv;
  }
```

Replace it with:

```javascript
  // Preserve user-edited config values across rebuilds
  var savedImShare = 0.25;
  var savedMmShare = 0.75;
  var savedCorrection = 1.0;
  if (tab && tab.getLastRow() >= 2) {
    var cfv;
    cfv = tab.getRange('B2').getValue();
    if (cfv > 0 && cfv <= 1) savedImShare = cfv;
    cfv = tab.getRange('D2').getValue();
    if (cfv > 0 && cfv <= 1) savedMmShare = cfv;
    cfv = tab.getRange('G2').getValue();
    if (cfv > 0) savedCorrection = cfv;
  }
```

- [ ] **Step 2: Replace the Row 1 block**

Find this exact block:

```javascript
  // Row 1: date selector + days window
  tab.getRange('A1').setValue('Date');
  tab.getRange('B1').setFormula('=TODAY()-1');
  tab.getRange('C1').setValue('← type any YYYY-MM-DD to compare another day');
  tab.getRange('D1').setValue('Days');
  tab.getRange('E1').setValue(savedDays);
  var daysRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['1', '3'], true)
    .setAllowInvalid(false)
    .build();
  tab.getRange('E1').setDataValidation(daysRule);
```

Replace it with:

```javascript
  // Row 1: custom date range selector
  tab.getRange('A1').setValue('Start');
  tab.getRange('B1').setFormula('=TODAY()-1');
  tab.getRange('C1').setValue('End');
  tab.getRange('D1').setFormula('=TODAY()-1');
  tab.getRange('E1').setValue('← type any YYYY-MM-DD in Start/End for a custom range');
```

- [ ] **Step 3: Add `D1` number format alongside `B1`'s**

Find this exact line (under the `---- Number formats ----` comment):

```javascript
  tab.getRange('B1').setNumberFormat('yyyy-mm-dd');
```

Replace it with:

```javascript
  tab.getRange('B1').setNumberFormat('yyyy-mm-dd');
  tab.getRange('D1').setNumberFormat('yyyy-mm-dd');
```

- [ ] **Step 4: Update row-1 styling for the new End label/value**

Find this exact block (under the `---- Styling ----` comment, in the KPI section):

```javascript
  tab.getRange('A1').setFontWeight('bold');
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  tab.getRange('D1').setFontWeight('bold');
```

Replace it with:

```javascript
  tab.getRange('A1').setFontWeight('bold');
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  tab.getRange('C1').setFontWeight('bold');
  tab.getRange('D1').setFontWeight('bold').setFontSize(12);
```

- [ ] **Step 5: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add Code.js
git commit -m "Replace Date+Days selector with Start/End date range on Dashboard"
```

---

### Task 2: Widen KPI rows 4–7 date filters to the Start/End range

**Files:**
- Modify: `Code.js` (KPI section, rows 4–7 of the Dashboard tab)

- [ ] **Step 1: Replace the Revenue (€, actual) row (row 4)**

Find:

```javascript
  tab.getRange('A4').setValue('Revenue (€, actual)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)');
  tab.getRange('C4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")');
  tab.getRange('D4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")');
  tab.getRange('E4').setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)');
  tab.getRange('F4').setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)');
  tab.getRange('G4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)');
  tab.getRange('H4').setFormula('=B4-E4');
  tab.getRange('I4').setFormula('=IFERROR(H4/E4,"")');
```

Replace with:

```javascript
  tab.getRange('A4').setValue('Revenue (€, actual)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)');
  tab.getRange('C4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")');
  tab.getRange('D4').setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")');
  tab.getRange('E4').setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)');
  tab.getRange('F4').setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)');
  tab.getRange('G4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)');
  tab.getRange('H4').setFormula('=B4-E4');
  tab.getRange('I4').setFormula('=IFERROR(H4/E4,"")');
```

- [ ] **Step 2: Replace the Revenue (€, weighted) row (row 5)**

Find:

```javascript
  tab.getRange('A5').setValue('Revenue (€, weighted)');
  tab.getRange('B5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)/$D$2,0)');
  tab.getRange('C5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E5').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))*$G$2/$B$2,0)');
  tab.getRange('F5').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)*$G$2/$B$2,0)');
  tab.getRange('G5').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)*$G$2/$B$2,0)');
  tab.getRange('H5').setFormula('=B5-E5');
  tab.getRange('I5').setFormula('=IFERROR(H5/E5,"")');
```

Replace with:

```javascript
  tab.getRange('A5').setValue('Revenue (€, weighted)');
  tab.getRange('B5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)/$D$2,0)');
  tab.getRange('C5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E5').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))*$G$2/$B$2,0)');
  tab.getRange('F5').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)*$G$2/$B$2,0)');
  tab.getRange('G5').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)*$G$2/$B$2,0)');
  tab.getRange('H5').setFormula('=B5-E5');
  tab.getRange('I5').setFormula('=IFERROR(H5/E5,"")');
```

- [ ] **Step 3: Replace the Sold Impr (weighted) row (row 6)**

Find:

```javascript
  tab.getRange('A6').setValue('Sold Impr (weighted)');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)/$D$2,0)');
  tab.getRange('C6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E6').setFormula('=IFERROR((SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))/$B$2,0)');
  tab.getRange('F6').setFormula('=IFERROR(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)/$B$2,0)');
  tab.getRange('G6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)/$B$2,0)');
  tab.getRange('H6').setFormula('=B6-E6');
  tab.getRange('I6').setFormula('=IFERROR(H6/E6,"")');
```

Replace with:

```javascript
  tab.getRange('A6').setValue('Sold Impr (weighted)');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)/$D$2,0)');
  tab.getRange('C6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E6').setFormula('=IFERROR((SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))/$B$2,0)');
  tab.getRange('F6').setFormula('=IFERROR(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)/$B$2,0)');
  tab.getRange('G6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)/$B$2,0)');
  tab.getRange('H6').setFormula('=B6-E6');
  tab.getRange('I6').setFormula('=IFERROR(H6/E6,"")');
```

- [ ] **Step 4: Replace the Avg In View % row (row 7)**

Find:

```javascript
  tab.getRange('A7').setValue('Avg In View %');
  tab.getRange('B7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1),0)');
  tab.getRange('C7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E7').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)),0)');
  tab.getRange('F7').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1),0)');
  tab.getRange('G7').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1),0)');
  tab.getRange('H7').setFormula('=B7-E7');
```

Replace with:

```javascript
  tab.getRange('A7').setValue('Avg In View %');
  tab.getRange('B7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1),0)');
  tab.getRange('C7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E7').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))/(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)),0)');
  tab.getRange('F7').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)/SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1),0)');
  tab.getRange('G7').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1),0)');
  tab.getRange('H7').setFormula('=B7-E7');
```

- [ ] **Step 5: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add Code.js
git commit -m "Widen KPI row date filters (rows 4-7) to use the Start/End range"
```

---

### Task 3: Widen Block 1 per-placement loop (Available / Sold / Revenue) to the range

**Files:**
- Modify: `Code.js` (the `for (var i = 0; i < placements.length; i++)` loop inside Block 1, rows 11–17 of the Dashboard tab)

This loop is parameterized by `r` (the row number as a string), so this edit applies to all 7 placements automatically.

- [ ] **Step 1: Replace the entire T1/T2/T3 formula block inside the loop**

Find:

```javascript
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 6).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r+')');
    tab.getRange(row, 7).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r+')');
    // T2: Sold
    tab.getRange(row, 9).setValue(placements[i]);
    tab.getRange(row, 10).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r+')');
    tab.getRange(row, 12).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r+')');
    tab.getRange(row, 13).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r+')');
    tab.getRange(row, 14).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r+')');
    tab.getRange(row, 15).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r+')');
    // T3: Revenue
    tab.getRange(row, 17).setValue(placements[i]);
    tab.getRange(row, 18).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,Q'+r+')');
    tab.getRange(row, 19).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r+')');
    tab.getRange(row, 20).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r+')');
    tab.getRange(row, 21).setFormula('=(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r+'))*$G$2');
    tab.getRange(row, 22).setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 23).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r+')*$G$2');
```

Replace with:

```javascript
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 6).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r+')');
    tab.getRange(row, 7).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r+')');
    // T2: Sold
    tab.getRange(row, 9).setValue(placements[i]);
    tab.getRange(row, 10).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,I'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,I'+r+')');
    tab.getRange(row, 12).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,I'+r+')');
    tab.getRange(row, 13).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r+')');
    tab.getRange(row, 14).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r+')');
    tab.getRange(row, 15).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r+')');
    // T3: Revenue
    tab.getRange(row, 17).setValue(placements[i]);
    tab.getRange(row, 18).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,Q'+r+')');
    tab.getRange(row, 19).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,Q'+r+')');
    tab.getRange(row, 20).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,Q'+r+')');
    tab.getRange(row, 21).setFormula('=(SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,Q'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,Q'+r+'))*$G$2');
    tab.getRange(row, 22).setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 23).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,Q'+r+')*$G$2');
```

**Note:** Block 1's TOTAL row (row 18) uses `=SUM(B11:B17)`-style formulas that sum the already-filtered per-row cells above — it requires no changes.

- [ ] **Step 2: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add Code.js
git commit -m "Widen Block 1 (Available/Sold/Revenue) date filters to use the Start/End range"
```

---

### Task 4: Widen Block 2 per-placement loop (In View % / eCPM / Weighted Revenue) to the range

**Files:**
- Modify: `Code.js` (the `for (var i2 = 0; i2 < placements.length; i2++)` loop inside Block 2, rows 23–29 of the Dashboard tab)

- [ ] **Step 1: Replace the T4 (In View %) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 6).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 7).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+'),0)');
```

Replace with:

```javascript
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 6).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 7).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,A'+r2+'),0)');
```

- [ ] **Step 2: Replace the T5 (eCPM) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 13).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+'))*$G$2/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+'))*1000,0)');
    tab.getRange(row2, 14).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')*$G$2/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 15).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+')*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+')*1000,0)');
```

Replace with:

```javascript
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 13).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r2+'))*$G$2/(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r2+'))*1000,0)');
    tab.getRange(row2, 14).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r2+')*$G$2/SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 15).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r2+')*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,I'+r2+')*1000,0)');
```

- [ ] **Step 3: Replace the T6 (Weighted Revenue) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 18).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 19).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 20).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 21).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r2+'))*$G$2/$B$2,0)');
    tab.getRange(row2, 22).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 23).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r2+')*$G$2/$B$2,0)');
```

Replace with:

```javascript
    tab.getRange(row2, 18).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 19).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 20).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 21).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,Q'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,Q'+r2+'))*$G$2/$B$2,0)');
    tab.getRange(row2, 22).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1,LW!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 23).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1,\'Own GAM\'!E:E,Q'+r2+')*$G$2/$B$2,0)');
```

- [ ] **Step 4: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "Widen Block 2 (In View %/eCPM/Weighted Revenue) date filters to use the Start/End range"
```

---

### Task 5: Widen Block 2 TOTAL row (T4 and T5 only) to the range

**Files:**
- Modify: `Code.js` (Block 2 TOTAL row, row 30 of the Dashboard tab)

T4's TOTAL (cols B–G) and T5's TOTAL (cols J–O) recompute fresh SUMIFS against the date bounds rather than summing per-row cells (percentages/eCPM can't simply be summed), so these need the same widening. T6's TOTAL (cols R–X) and Block 1's TOTAL already sum per-row cells and need no change.

- [ ] **Step 1: Replace the T4 and T5 TOTAL formulas**

Find:

```javascript
  tab.getRange('A30').setValue('TOTAL');
  tab.getRange('B30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1),0)');
  tab.getRange('C30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E30').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)),0)');
  tab.getRange('F30').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1),0)');
  tab.getRange('G30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1),0)');
  tab.getRange('I30').setValue('TOTAL');
  tab.getRange('J30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1)*1000,0)');
  tab.getRange('K30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB")*1000,0)');
  tab.getRange('L30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM")*1000,0)');
  tab.getRange('M30').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))*$G$2/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1))*1000,0)');
  tab.getRange('N30').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)*$G$2/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1)*1000,0)');
  tab.getRange('O30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1)*1000,0)');
  tab.getRange('P30').setFormula('=J30-M30');
```

Replace with:

```javascript
  tab.getRange('A30').setValue('TOTAL');
  tab.getRange('B30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1),0)');
  tab.getRange('C30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E30').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))/(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)),0)');
  tab.getRange('F30').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)/SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1),0)');
  tab.getRange('G30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1),0)');
  tab.getRange('I30').setValue('TOTAL');
  tab.getRange('J30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1)*1000,0)');
  tab.getRange('K30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google HB")*1000,0)');
  tab.getRange('L30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,">="&$B$1,Google!A:A,"<="&$D$1,Google!B:B,"Google GAM")*1000,0)');
  tab.getRange('M30').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))*$G$2/(SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1))*1000,0)');
  tab.getRange('N30').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)*$G$2/SUMIFS(LW!H:H,LW!A:A,">="&$B$1,LW!A:A,"<="&$D$1)*1000,0)');
  tab.getRange('O30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&$B$1,\'Own GAM\'!A:A,"<="&$D$1)*1000,0)');
  tab.getRange('P30').setFormula('=J30-M30');
```

- [ ] **Step 2: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify no `($B$1-$E$1+1)` or `E1`-referencing text remains in `setupDashboard()`**

Run: `grep -n '\$E\$1\|savedDays\|daysRule' Code.js`
Expected: no output (all four tasks together removed every reference).

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "Widen Block 2 TOTAL row (In View %/eCPM) date filters to use the Start/End range"
```

---

### Task 6: Deploy and verify against the live spreadsheet

**Files:** none (deployment + verification only)

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Deploy to Apps Script**

```bash
clasp push --force
```

Expected output: `Pushed 2 files at <time>.` listing `appsscript.json` and `Code.js`.

- [ ] **Step 3: Rebuild the Dashboard tab**

```bash
clasp run setupDashboard
```

Expected: no exception thrown. This rebuilds row 1 with the new Start/End cells and rewrites every formula in the Dashboard tab.

- [ ] **Step 4: Add a temporary diagnostic function and verify the default (Start=End=yesterday) view has no errors**

Append this function to the end of `Code.js`:

```javascript
function _diagRangeCheck() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var tab = ss.getSheetByName('Dashboard');
  var out = {};
  out.A1 = tab.getRange('A1').getValue();
  out.B1 = Utilities.formatDate(tab.getRange('B1').getValue(), 'Europe/Helsinki', 'yyyy-MM-dd');
  out.C1 = tab.getRange('C1').getValue();
  out.D1 = Utilities.formatDate(tab.getRange('D1').getValue(), 'Europe/Helsinki', 'yyyy-MM-dd');
  out.revenueActualTotal = tab.getRange('B4').getValue();
  out.block1RevenueTotal = tab.getRange('R18').getValue();
  out.block2InViewTotal = tab.getRange('B30').getValue();
  var json = JSON.stringify(out);
  Logger.log(json);
  return json;
}
```

Run:

```bash
clasp push --force
clasp run _diagRangeCheck
```

Expected: `A1` is `"Start"`, `C1` is `"End"`, `B1` and `D1` are both the same date (yesterday), and `revenueActualTotal`, `block1RevenueTotal`, `block2InViewTotal` are non-zero plausible numbers (not `0`, not an error string) — confirming the default single-day view still works with `B1 === D1`.

- [ ] **Step 5: Widen the range and verify totals scale up**

Extend `_diagRangeCheck` temporarily isn't necessary — instead run a second diagnostic that sets `D1` three days later than `B1` and re-reads the same cells:

```javascript
function _diagRangeWiden() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var tab = ss.getSheetByName('Dashboard');
  var startDate = tab.getRange('B1').getValue();
  var wideEnd = new Date(startDate.getTime());
  wideEnd.setDate(wideEnd.getDate() + 2); // 3-day range: start, start+1, start+2
  tab.getRange('D1').setValue(wideEnd);
  SpreadsheetApp.flush();
  var out = {
    start: Utilities.formatDate(tab.getRange('B1').getValue(), 'Europe/Helsinki', 'yyyy-MM-dd'),
    end: Utilities.formatDate(tab.getRange('D1').getValue(), 'Europe/Helsinki', 'yyyy-MM-dd'),
    revenueActualTotal: tab.getRange('B4').getValue(),
    block1RevenueTotal: tab.getRange('R18').getValue()
  };
  var json = JSON.stringify(out);
  Logger.log(json);
  return json;
}
```

Run:

```bash
clasp push --force
clasp run _diagRangeWiden
```

Expected: `revenueActualTotal` and `block1RevenueTotal` are noticeably larger (roughly 2-3x, depending on day-to-day variance) than the single-day values from Step 4 — confirming the range widens correctly instead of erroring or staying flat.

- [ ] **Step 6: Reset D1 back to match B1 and remove the temporary diagnostic functions**

Remove `_diagRangeCheck` and `_diagRangeWiden` from `Code.js` (added in Steps 4–5), and re-run `setupDashboard` to reset row 1 to its default state:

```bash
clasp run setupDashboard
clasp push --force
```

Verify `Code.js` has no diff against the last commit from Task 5:

```bash
git diff --stat
```

Expected: no output (clean working tree — the diagnostic functions were never committed).

- [ ] **Step 7: Final confirmation**

Report to the user: Dashboard rebuilt, Start/End range verified against the live spreadsheet with both a single-day and a 3-day range, and the live Apps Script project + GitHub are both up to date.
