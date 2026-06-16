# Multi-Day Window Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Days" dropdown (1 or 3) to the Dashboard tab that widens every date filter from an exact-match on `B1` to a range ending on `B1`, so the whole Dashboard can show either a single day or a summed 3-day total.

**Architecture:** One new cell (`E1`) holds the day count. Every SUMIFS criteria pair that currently filters `Sheet!A:A,$B$1` is widened to `Sheet!A:A,">="&($B$1-$E$1+1),Sheet!A:A,"<="&$B$1`. No new tables/rows/columns; purely a formula-text change inside the existing `setupDashboard()` function in `Code.js`.

**Tech Stack:** Google Apps Script (V8 runtime), single file `Code.js`, deployed via `clasp push`. No automated test framework exists for this project — verification per task is `node --check Code.js` (catches JS syntax errors before deploying), and the final task adds a manual check against the live spreadsheet, consistent with how this project has been verified throughout its history.

---

### Task 1: Add the Days dropdown and persist it across rebuilds

**Files:**
- Modify: `Code.js` (inside `setupDashboard()`, the config-preservation block and the Row 1 block)

- [ ] **Step 1: Add `savedDays` to the config-preservation block**

Find this exact block near the top of `setupDashboard()`:

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

Replace it with:

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

- [ ] **Step 2: Add the `D1`/`E1` cells to the Row 1 block**

Find this exact block:

```javascript
  // Row 1: date selector
  tab.getRange('A1').setValue('Date');
  tab.getRange('B1').setFormula('=TODAY()-1');
  tab.getRange('C1').setValue('← type any YYYY-MM-DD to compare another day');
```

Replace it with:

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

- [ ] **Step 3: Add `D1` bold styling alongside the existing `A1`/`B1` styling**

Find this exact line:

```javascript
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
```

Replace it with:

```javascript
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  tab.getRange('D1').setFontWeight('bold');
```

- [ ] **Step 4: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "Add Days dropdown (1/3) to Dashboard with persistence across rebuilds"
```

---

### Task 2: Widen KPI rows 4–7 date filters to a range

**Files:**
- Modify: `Code.js` (KPI section, rows 4–7 of the Dashboard tab)

- [ ] **Step 1: Replace the Revenue (€, actual) row (row 4)**

Find:

```javascript
  tab.getRange('A4').setValue('Revenue (€, actual)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1)');
  tab.getRange('C4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB")');
  tab.getRange('D4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM")');
  tab.getRange('E4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('F4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)');
  tab.getRange('G4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('H4').setFormula('=B4-E4');
  tab.getRange('I4').setFormula('=IFERROR(H4/E4,"")');
```

Replace with:

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

- [ ] **Step 2: Replace the Revenue (€, weighted) row (row 5)**

Find:

```javascript
  tab.getRange('A5').setValue('Revenue (€, weighted)');
  tab.getRange('B5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E5').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))*$G$2/$B$2,0)');
  tab.getRange('F5').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('G5').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('H5').setFormula('=B5-E5');
  tab.getRange('I5').setFormula('=IFERROR(H5/E5,"")');
```

Replace with:

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

- [ ] **Step 3: Replace the Sold Impr (weighted) row (row 6)**

Find:

```javascript
  tab.getRange('A6').setValue('Sold Impr (weighted)');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E6').setFormula('=IFERROR((SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1))/$B$2,0)');
  tab.getRange('F6').setFormula('=IFERROR(SUMIFS(LW!H:H,LW!A:A,$B$1)/$B$2,0)');
  tab.getRange('G6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)/$B$2,0)');
  tab.getRange('H6').setFormula('=B6-E6');
  tab.getRange('I6').setFormula('=IFERROR(H6/E6,"")');
```

Replace with:

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

- [ ] **Step 4: Replace the Avg In View % row (row 7)**

Find:

```javascript
  tab.getRange('A7').setValue('Avg In View %');
  tab.getRange('B7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E7').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('F7').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('G7').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('H7').setFormula('=B7-E7');
```

Replace with:

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

- [ ] **Step 5: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add Code.js
git commit -m "Widen KPI row date filters (rows 4-7) to use the Days range"
```

---

### Task 3: Widen Block 1 per-placement loop (Available / Sold / Revenue) to a range

**Files:**
- Modify: `Code.js` (the `for (var i = 0; i < placements.length; i++)` loop inside Block 1, rows 11–17 of the Dashboard tab)

This loop is parameterized by `r` (the row number as a string), so each edit below applies to all 7 placements automatically — there is no need to repeat per placement.

- [ ] **Step 1: Replace the T1 (Available) lines inside the loop**

Find:

```javascript
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 6).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')');
    tab.getRange(row, 7).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
```

Replace with:

```javascript
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(Google!F:F,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 6).setFormula('=SUMIFS(LW!F:F,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r+')');
    tab.getRange(row, 7).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r+')');
```

- [ ] **Step 2: Replace the T2 (Sold) lines inside the loop**

Find:

```javascript
    tab.getRange(row, 10).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,I'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r+')');
    tab.getRange(row, 12).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r+')');
    tab.getRange(row, 13).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r+')');
    tab.getRange(row, 14).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r+')');
    tab.getRange(row, 15).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r+')');
```

Replace with:

```javascript
    tab.getRange(row, 10).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r+')');
    tab.getRange(row, 12).setFormula('=SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r+')');
    tab.getRange(row, 13).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r+')');
    tab.getRange(row, 14).setFormula('=SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r+')');
    tab.getRange(row, 15).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r+')');
```

- [ ] **Step 3: Replace the T3 (Revenue) lines inside the loop**

Find:

```javascript
    tab.getRange(row, 18).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,Q'+r+')');
    tab.getRange(row, 19).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r+')');
    tab.getRange(row, 20).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r+')');
    tab.getRange(row, 21).setFormula('=(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r+'))*$G$2');
    tab.getRange(row, 22).setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 23).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r+')*$G$2');
```

Replace with:

```javascript
    tab.getRange(row, 18).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,Q'+r+')');
    tab.getRange(row, 19).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r+')');
    tab.getRange(row, 20).setFormula('=SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r+')');
    tab.getRange(row, 21).setFormula('=(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r+'))*$G$2');
    tab.getRange(row, 22).setFormula('=SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 23).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r+')*$G$2');
```

**Note:** Block 1's TOTAL row (row 18) uses `=SUM(B11:B17)` style formulas that sum the already-filtered per-row cells above — it requires no changes, since summing correctly-filtered values is correct regardless of the date range width.

- [ ] **Step 4: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "Widen Block 1 (Available/Sold/Revenue) date filters to use the Days range"
```

---

### Task 4: Widen Block 2 per-placement loop (In View % / eCPM / Weighted Revenue) to a range

**Files:**
- Modify: `Code.js` (the `for (var i2 = 0; i2 < placements.length; i2++)` loop inside Block 2, rows 23–29 of the Dashboard tab)

- [ ] **Step 1: Replace the T4 (In View %) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 6).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 7).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'),0)');
```

Replace with:

```javascript
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 6).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 7).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,A'+r2+'),0)');
```

- [ ] **Step 2: Replace the T5 (eCPM) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 13).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+'))*$G$2/(SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+'))*1000,0)');
    tab.getRange(row2, 14).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,I'+r2+')*$G$2/SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 15).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+')*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+')*1000,0)');
```

Replace with:

```javascript
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 13).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+'))*$G$2/(SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+'))*1000,0)');
    tab.getRange(row2, 14).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')*$G$2/SUMIFS(LW!H:H,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 15).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+')*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,I'+r2+')*1000,0)');
```

- [ ] **Step 3: Replace the T6 (Weighted Revenue) lines inside the loop**

Find:

```javascript
    tab.getRange(row2, 18).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 19).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 20).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 21).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r2+'))*$G$2/$B$2,0)');
    tab.getRange(row2, 22).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 23).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r2+')*$G$2/$B$2,0)');
```

Replace with:

```javascript
    tab.getRange(row2, 18).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 19).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 20).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,">="&($B$1-$E$1+1),Google!A:A,"<="&$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 21).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r2+'))*$G$2/$B$2,0)');
    tab.getRange(row2, 22).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,">="&($B$1-$E$1+1),LW!A:A,"<="&$B$1,LW!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 23).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,">="&($B$1-$E$1+1),\'Own GAM\'!A:A,"<="&$B$1,\'Own GAM\'!E:E,Q'+r2+')*$G$2/$B$2,0)');
```

- [ ] **Step 4: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "Widen Block 2 (In View %/eCPM/Weighted Revenue) date filters to use the Days range"
```

---

### Task 5: Widen Block 2 TOTAL row (T4 and T5 only) to a range

**Files:**
- Modify: `Code.js` (Block 2 TOTAL row, row 30 of the Dashboard tab)

T4's TOTAL (cols B–G) and T5's TOTAL (cols J–O) recompute fresh SUMIFS against `$B$1` rather than summing per-row cells (because percentages/eCPM can't simply be summed), so these need the same range widening. T6's TOTAL (cols R–X) and Block 1's TOTAL already sum per-row cells and need no change.

- [ ] **Step 1: Replace the T4 and T5 TOTAL formulas**

Find:

```javascript
  tab.getRange('A30').setValue('TOTAL');
  tab.getRange('B30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E30').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('F30').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('G30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('I30').setValue('TOTAL');
  tab.getRange('J30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1)*1000,0)');
  tab.getRange('K30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB")*1000,0)');
  tab.getRange('L30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM")*1000,0)');
  tab.getRange('M30').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))*$G$2/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1))*1000,0)');
  tab.getRange('N30').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)*$G$2/SUMIFS(LW!H:H,LW!A:A,$B$1)*1000,0)');
  tab.getRange('O30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)*1000,0)');
  tab.getRange('P30').setFormula('=J30-M30');
```

Replace with:

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

- [ ] **Step 2: Verify syntax**

Run: `node --check Code.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add Code.js
git commit -m "Widen Block 2 TOTAL row (In View %/eCPM) date filters to use the Days range"
```

---

### Task 6: Deploy and verify against the live spreadsheet

**Files:** none (deployment + manual verification only)

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Deploy to Apps Script**

```bash
clasp push --force
```

Expected output: `Pushed 2 files at <time>.` listing `appsscript.json` and `Code.js`.

- [ ] **Step 3: Run Setup Dashboard tab and verify Days=1 matches prior behavior**

In the spreadsheet, run **Telsu seuranta → Setup Dashboard tab**. Confirm:
- `D1` shows "Days" and `E1` shows `1` with a dropdown arrow.
- All table totals (Available, Sold, Revenue, In View %, eCPM, Weighted Revenue) match the values you'd get from the single date in `B1` — i.e. identical to before this change, since `E1=1` reduces the range filter to the same single day.

- [ ] **Step 4: Verify Days=3 sums correctly**

Change `E1` to `3` via the dropdown. Confirm:
- No formula errors (no `#ERROR!` or blank cells where numbers were expected).
- Revenue/Sold/Available totals roughly triple compared to the Days=1 view (exact ratio depends on day-to-day variance, but should be clearly larger, not identical).
- Pick one placement (e.g. "Telsu.fi Cont") and manually cross-check: sum that placement's MM HB+GAM revenue from the `Google` sheet for the 3 dates ending on `B1`, and confirm it matches the Block 1 Revenue T3 cell for that placement.

- [ ] **Step 5: Confirm persistence**

Run **Setup Dashboard tab** again from the menu. Confirm `E1` still shows `3` (not reset to `1`), proving the `savedDays` persistence logic works.

- [ ] **Step 6: Set E1 back to 1 (or leave as preferred) and finish**

No code change — this is just leaving the sheet in the state the user wants after verification.
