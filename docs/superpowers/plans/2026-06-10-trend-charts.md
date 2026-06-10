# Trend Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three 7-day trend line charts (Revenue, Sold Impressions, In View %) to the Dashboard tab comparing Mindmax GAM vs IM (LW + Own GAM), with a script-built helper data range and automatic refresh wired into the existing `setupDashboard()` and `refreshData()` functions.

**Architecture:** A new `getSheetDataByDate()` helper aggregates per-date totals from any data sheet in one pass. A new `refreshCharts()` function writes a 9-row helper range (rows 33–41) on the Dashboard tab, hides those rows, removes any existing charts, then builds three `EmbeddedChart` LINE charts anchored at row 43. The helper range is hidden, not deleted, so charts always have a live data source.

**Tech Stack:** Google Apps Script (V8), clasp CLI for push/pull, Google Sheets EmbeddedChartBuilder API.

---

## File changes

- Modify: `Code.js` — add `getSheetDataByDate()`, `refreshCharts()`; wire calls into `setupDashboard()`, `refreshData()`, `onOpen()`
- Modify: `.claspignore` — exclude `.superpowers/` from pushes

---

### Task 1: Add `.superpowers/` to `.claspignore`

**Files:**
- Modify: `.claspignore`

- [ ] **Step 1: Add exclusion**

Open `.claspignore` and append one line so the brainstorm folder is never pushed to Apps Script:

```
.superpowers/**
```

Final `.claspignore` should look like:

```
docs/**
*.md
.git/**
.superpowers/**
```

- [ ] **Step 2: Commit**

```bash
git add .claspignore
git commit -m "chore: exclude .superpowers from clasp push"
```

---

### Task 2: Add `getSheetDataByDate()` helper

**Files:**
- Modify: `Code.js` — insert after the closing brace of `upsertRows()` (around line 398)

- [ ] **Step 1: Add function to `Code.js`**

Insert after `upsertRows()` and before `refreshGamData()`:

```javascript
function getSheetDataByDate(sheet) {
  var result = {};
  if (!sheet) return result;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;
  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  for (var i = 0; i < data.length; i++) {
    var d = data[i][0];
    var ds = (d instanceof Date)
      ? Utilities.formatDate(d, 'Europe/Helsinki', 'yyyy-MM-dd')
      : String(d).slice(0, 10);
    if (!ds || !ds.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
    if (!result[ds]) result[ds] = {rev: 0, sold: 0, view: 0};
    result[ds].rev  += Number(data[i][8]) || 0;  // col I: revenue
    result[ds].sold += Number(data[i][7]) || 0;  // col H: sold impressions
    result[ds].view += Number(data[i][6]) || 0;  // col G: viewable impressions
  }
  return result;
}
```

- [ ] **Step 2: Add a temporary test function**

Add at the end of `Code.js`:

```javascript
function testGetSheetDataByDate() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var lwSheet = ss.getSheetByName(LW_SHEET_NAME);
  var data = getSheetDataByDate(lwSheet);
  var dates = Object.keys(data).sort();
  Logger.log('Dates in LW: %s', dates.length);
  if (dates.length > 0) {
    var latest = dates[dates.length - 1];
    Logger.log('Latest date: %s → %s', latest, JSON.stringify(data[latest]));
  }
}
```

- [ ] **Step 3: Push and run**

```bash
clasp push
```

In the Apps Script editor (`clasp open`), select `testGetSheetDataByDate` from the function dropdown and click **Run**.

Expected log (dates and values will vary):
```
Dates in LW: 7
Latest date: 2026-06-09 → {"rev":142.5,"sold":48200,"view":36150}
```

If `Dates in LW: 0` — check that the LW sheet has data and that the date in col A is a Date object or `yyyy-MM-dd` string.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add getSheetDataByDate helper"
```

---

### Task 3: Add `refreshCharts()` function

**Files:**
- Modify: `Code.js` — insert after `getSheetDataByDate()`, before `refreshGamData()`

- [ ] **Step 1: Add `refreshCharts()` to `Code.js`**

```javascript
function refreshCharts() {
  var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  var lwSheet    = ss.getSheetByName(LW_SHEET_NAME);
  var googleSheet = ss.getSheetByName(GAM_SHEET_NAME);
  var ownGamSheet = ss.getSheetByName(OWN_GAM_SHEET_NAME);
  var dashSheet  = ss.getSheetByName('Dashboard');

  if (!dashSheet || !lwSheet) {
    Logger.log('refreshCharts: missing Dashboard or LW sheet');
    return;
  }

  // 1. Collect last 7 unique dates from LW sheet
  var lastRow = lwSheet.getLastRow();
  if (lastRow < 2) { Logger.log('refreshCharts: LW sheet empty'); return; }

  var rawDates = lwSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var dateSet = {};
  for (var i = 0; i < rawDates.length; i++) {
    var d = rawDates[i][0];
    var ds = (d instanceof Date)
      ? Utilities.formatDate(d, 'Europe/Helsinki', 'yyyy-MM-dd')
      : String(d).slice(0, 10);
    if (ds && ds.match(/^\d{4}-\d{2}-\d{2}$/)) dateSet[ds] = true;
  }
  var dates = Object.keys(dateSet).sort().reverse().slice(0, 7).reverse();
  if (dates.length === 0) { Logger.log('refreshCharts: no valid dates'); return; }

  // 2. Aggregate totals per date from all three sheets
  var mmData  = getSheetDataByDate(googleSheet);
  var lwData  = getSheetDataByDate(lwSheet);
  var ownData = getSheetDataByDate(ownGamSheet);

  // 3. Write helper range rows 33-41
  var START = 33;
  dashSheet.getRange(START, 1, 1, 7).setValues([['7-day trend', '', '', '', '', '', '']]);
  dashSheet.getRange(START + 1, 1, 1, 7).setValues([[
    'Date', 'Mindmax Rev', 'IM Rev', 'Mindmax Sold', 'IM Sold', 'Mindmax InView%', 'IM InView%'
  ]]);

  var rows = [];
  for (var j = 0; j < dates.length; j++) {
    var dt  = dates[j];
    var mm  = mmData[dt]  || {rev: 0, sold: 0, view: 0};
    var lw  = lwData[dt]  || {rev: 0, sold: 0, view: 0};
    var own = ownData[dt] || {rev: 0, sold: 0, view: 0};
    var imSold = lw.sold + own.sold;
    var imView = lw.view + own.view;
    rows.push([
      dt,
      mm.rev,
      lw.rev + own.rev,
      mm.sold,
      imSold,
      mm.sold > 0 ? mm.view / mm.sold : 0,
      imSold > 0  ? imView  / imSold  : 0
    ]);
  }
  dashSheet.getRange(START + 2, 1, 7, 7).clearContent();
  dashSheet.getRange(START + 2, 1, dates.length, 7).setValues(rows);

  // 4. Hide helper rows 33-41
  dashSheet.hideRows(START, 9);

  // 5. Remove all existing charts on Dashboard
  var existing = dashSheet.getCharts();
  for (var k = 0; k < existing.length; k++) {
    dashSheet.removeChart(existing[k]);
  }

  // 6. Build 3 line charts anchored at row 43
  var numRows = dates.length + 1;  // 1 header row + data rows
  var ANCHOR  = 43;

  // Revenue (€) — cols A-C
  dashSheet.insertChart(
    dashSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(dashSheet.getRange(START + 1, 1, numRows, 3))
      .setNumHeaders(1)
      .setOption('title', '7-day Revenue (€)')
      .setOption('colors', ['#4285f4', '#ea8600'])
      .setOption('legend', {position: 'bottom'})
      .setOption('hAxis', {format: 'MM/dd', slantedText: true})
      .setOption('vAxis', {format: '€#,##0.00'})
      .setPosition(ANCHOR, 1, 0, 0)
      .build()
  );

  // Sold Impressions — date col A + cols D-E
  dashSheet.insertChart(
    dashSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(dashSheet.getRange(START + 1, 1, numRows, 1))
      .addRange(dashSheet.getRange(START + 1, 4, numRows, 2))
      .setNumHeaders(1)
      .setOption('title', '7-day Sold Impressions')
      .setOption('colors', ['#4285f4', '#ea8600'])
      .setOption('legend', {position: 'bottom'})
      .setOption('hAxis', {format: 'MM/dd', slantedText: true})
      .setOption('vAxis', {format: '#,##0'})
      .setPosition(ANCHOR, 7, 0, 0)
      .build()
  );

  // In View % — date col A + cols F-G
  dashSheet.insertChart(
    dashSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(dashSheet.getRange(START + 1, 1, numRows, 1))
      .addRange(dashSheet.getRange(START + 1, 6, numRows, 2))
      .setNumHeaders(1)
      .setOption('title', '7-day In View %')
      .setOption('colors', ['#4285f4', '#ea8600'])
      .setOption('legend', {position: 'bottom'})
      .setOption('hAxis', {format: 'MM/dd', slantedText: true})
      .setOption('vAxis', {format: '0%'})
      .setPosition(ANCHOR, 13, 0, 0)
      .build()
  );

  Logger.log('refreshCharts: done, %s days plotted', dates.length);
}
```

- [ ] **Step 2: Push and run**

```bash
clasp push
```

In the Apps Script editor, select `refreshCharts` and click **Run**. Grant any permissions requested.

Expected log:
```
refreshCharts: done, 7 days plotted
```

Open the Google Sheet. Scroll down past the placement tables on the Dashboard tab. You should see three line charts side by side starting around row 43. Rows 33–41 should be hidden (not visible).

If charts don't appear:
- Check that the Dashboard tab exists (run `setupDashboard()` first if needed)
- Check that the LW sheet has data (at least 1 row below header)

- [ ] **Step 3: Remove the test function from Task 2**

Delete `testGetSheetDataByDate()` from the bottom of `Code.js`.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add refreshCharts with 7-day trend line charts"
```

---

### Task 4: Wire `refreshCharts()` into existing functions

**Files:**
- Modify: `Code.js` — three small edits to `setupDashboard()`, `refreshData()`, `onOpen()`

- [ ] **Step 1: Call `refreshCharts()` at end of `setupDashboard()`**

Find this line near the end of `setupDashboard()`:

```javascript
  Logger.log('Dashboard tab created successfully.');
```

Insert `refreshCharts();` immediately before it:

```javascript
  refreshCharts();
  Logger.log('Dashboard tab created successfully.');
```

- [ ] **Step 2: Call `refreshCharts()` at end of `refreshData()`**

Find `refreshData()` which currently ends with:

```javascript
  refreshGamData();
  refreshOwnGamData();
}
```

Add the call:

```javascript
  refreshGamData();
  refreshOwnGamData();
  refreshCharts();
}
```

- [ ] **Step 3: Add menu item to `onOpen()`**

Find the `onOpen()` menu. Add after the `'Setup Dashboard tab'` item:

```javascript
  SpreadsheetApp.getUi()
    .createMenu('Telsu seuranta')
    .addItem('Refresh yesterday (LW + GAM)', 'refreshData')
    .addItem('Initial load LW (7 days)', 'initialLoad')
    .addItem('Refresh GAM from Gmail', 'refreshGamData')
    .addItem('Refresh Own GAM from Gmail', 'refreshOwnGamData')
    .addSeparator()
    .addItem('Setup Dashboard tab', 'setupDashboard')
    .addItem('Refresh charts (7-day trend)', 'refreshCharts')
    .addSeparator()
    .addItem('Create daily trigger (06:00)', 'createDailyTrigger')
    .addToUi();
```

- [ ] **Step 4: Push and verify end-to-end**

```bash
clasp push
```

In the Apps Script editor, run `setupDashboard()`. Expected log ends with:
```
refreshCharts: done, 7 days plotted
Dashboard tab created successfully.
```

Reload the Google Sheet. Verify:
- "Telsu seuranta" menu contains "Refresh charts (7-day trend)"
- Dashboard tab shows the 3 charts below the placement tables
- Helper rows 33–41 are hidden

- [ ] **Step 5: Push to GitHub**

```bash
git add Code.js
git commit -m "feat: wire refreshCharts into setupDashboard, refreshData, onOpen menu"
git push
```
