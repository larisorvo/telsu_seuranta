# Telsu Seuranta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Apps Script project that fetches daily LiveWrapped ad unit performance data for publisher "Mindmax testi" and upserts it into a Google Sheet, running automatically every morning at 6 AM Helsinki time.

**Architecture:** A single `Code.js` Apps Script file with five concerns: date utilities, LW API fetch, upsert logic, daily entry points, and trigger setup. The Google Sheet has three tabs: `LW` (live data), `Google` (phase 2, empty), and `Summary` (formula union). Upsert key is Date + Placement — no rows are ever deleted.

**Tech Stack:** Google Apps Script (V8), clasp CLI for local development and deployment, Google Sheets API (built-in), UrlFetchApp for LW REST API calls.

---

## Prerequisites

- Node.js installed (for clasp)
- clasp installed globally: `npm install -g @google/clasp`
- Logged in to clasp: `clasp login`
- LW API token available (same one used in livewrapped_viewability project — check Script Properties there)

---

### Task 1: Project scaffold

**Files:**
- Create: `Code.js`
- Create: `appsscript.json`
- Create: `.claspignore`

- [ ] **Step 1: Create `appsscript.json`**

```json
{
  "timeZone": "Europe/Helsinki",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

- [ ] **Step 2: Create `.claspignore`**

```
docs/**
*.md
.git/**
```

- [ ] **Step 3: Create `Code.js` with constants skeleton**

```javascript
var SPREADSHEET_ID = ''; // Fill in after Task 2
var LW_API_URL = 'https://api.livewrapped.com/Statistics';
var PUBLISHER_FILTER = 'Mindmax testi';
var LW_SHEET_NAME = 'LW';
var HEADERS = [
  'Date', 'Source', 'Publisher', 'Site', 'Placement',
  'Available Impressions', 'Viewable Impressions',
  'Sold Impressions', 'Revenue', 'In View %'
];
var NUM_COLS = 10;
```

- [ ] **Step 4: Commit**

```bash
git init
git add Code.js appsscript.json .claspignore
git commit -m "feat: scaffold telsu seuranta project"
```

---

### Task 2: Google Sheet manual setup

**This task is done in the browser — no code to write.**

- [ ] **Step 1: Create the Google Sheet**

  Go to Google Drive → New → Google Sheets. Name it **"Telsu seuranta"**.

- [ ] **Step 2: Create three tabs**

  Rename the default tab to `LW`. Add two more tabs: `Google` and `Summary`.

- [ ] **Step 3: Add headers to the LW tab**

  In `LW!A1:J1`, enter these values in order:
  ```
  Date | Source | Publisher | Site | Placement | Available Impressions | Viewable Impressions | Sold Impressions | Revenue | In View %
  ```

- [ ] **Step 4: Add headers to the Google tab**

  In `Google!A1:J1`, enter the same 10 headers as above.

- [ ] **Step 5: Add Summary formula**

  Click on the `Summary` tab, select cell `A1`, and enter:
  ```
  =QUERY({LW!A2:J; Google!A2:J}, "SELECT * WHERE Col1 IS NOT NULL")
  ```

- [ ] **Step 6: Note the Spreadsheet ID**

  Copy the Spreadsheet ID from the URL:
  `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`

  Open `Code.js` and set:
  ```javascript
  var SPREADSHEET_ID = 'SPREADSHEET_ID_HERE';
  ```

- [ ] **Step 7: Commit**

```bash
git add Code.js
git commit -m "feat: add spreadsheet ID"
```

---

### Task 3: Clasp setup — link Apps Script project to the sheet

- [ ] **Step 1: Create a new Apps Script project bound to the sheet**

  In the Google Sheet, go to **Extensions → Apps Script**. This opens the bound script editor. Note the script URL — it contains the Script ID.

  Alternatively, create a standalone project:
  ```bash
  clasp create --type standalone --title "Telsu seuranta"
  ```
  This creates `.clasp.json` with the `scriptId`.

- [ ] **Step 2: Push the initial scaffold**

  ```bash
  clasp push
  ```

  Expected output:
  ```
  └─ Code.js
  └─ appsscript.json
  Pushed 2 files.
  ```

- [ ] **Step 3: Set the LW API token in Script Properties**

  In the Apps Script editor (open with `clasp open`):
  - Go to **Project Settings → Script Properties**
  - Add property: `LW_API_TOKEN` = `<your token>`

  The token is the same one used in the livewrapped_viewability project.

- [ ] **Step 4: Commit `.clasp.json`**

```bash
git add .clasp.json
git commit -m "feat: add clasp project config"
```

---

### Task 4: Date utilities

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add date utility functions to `Code.js`**

  Add after the constants block:

```javascript
function formatDate(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day);
}

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function withRetry(fn) {
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      return fn();
    } catch (e) {
      if (attempt < 2) {
        Utilities.sleep(3000);
      } else {
        throw e;
      }
    }
  }
}
```

- [ ] **Step 2: Add a test function**

```javascript
function testDateUtils() {
  Logger.log('Today: ' + formatDate(new Date()));
  Logger.log('Yesterday: ' + daysAgo(1));
  Logger.log('7 days ago: ' + daysAgo(7));
}
```

- [ ] **Step 3: Push and run the test**

```bash
clasp push
```

In the Apps Script editor, select `testDateUtils` from the function dropdown and click **Run**.

Expected log output (dates will vary):
```
Today: 2026-05-26
Yesterday: 2026-05-25
7 days ago: 2026-05-19
```

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add date utility functions"
```

---

### Task 5: LW API discovery

Before implementing the full fetch, discover the exact field names in the API response.

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add API discovery function**

```javascript
function testApiResponse() {
  var token = PropertiesService.getScriptProperties().getProperty('LW_API_TOKEN');
  var payload = JSON.stringify({
    from: daysAgo(2),
    to: daysAgo(2),
    aggregateTime: false,
    aggregateAdUnits: false,
    aggregateSites: false,
    aggregatePublishers: false,
    includeSoldStatistics: true
  });
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(LW_API_URL, options);
  Logger.log('HTTP status: ' + response.getResponseCode());
  var text = response.getContentText();
  Logger.log('Response (first 3000 chars): ' + text.slice(0, 3000));
}
```

- [ ] **Step 2: Push and run**

```bash
clasp push
```

Run `testApiResponse` in the editor.

- [ ] **Step 3: Inspect the response**

  In the Apps Script logs, you will see the raw JSON. Look for the array of stat objects and note:
  - What is the top-level key holding the array? (e.g. `statistics`, `stats`, `data`, or the response itself is an array)
  - What is the field name for: publisher, site, placement, available impressions, viewable impressions, sold impressions, revenue, in-view rate/percentage

  Example of what you might see:
  ```json
  {
    "statistics": [
      {
        "date": "2026-05-24",
        "publisher": "Mindmax testi",
        "site": "telsu.fi",
        "placement": "Telsu.fi TOP",
        "availableImpressions": 58,
        "viewableImpressions": 56,
        "soldImpressions": 40,
        "revenue": 0.08,
        "inViewRate": 0.775
      }
    ]
  }
  ```

- [ ] **Step 4: Note the actual field names**

  Write down the exact field names here before moving to Task 6. The `fetchDayStats` function in Task 6 uses these names — update them to match what the API actually returns.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "feat: add API discovery test function"
```

---

### Task 6: fetchDayStats(date)

**Files:**
- Modify: `Code.js`

Replace the field names below (`s.availableImpressions`, `s.viewableImpressions`, etc.) with the actual names observed in Task 5.

- [ ] **Step 1: Add `fetchDayStats` to `Code.js`**

```javascript
function fetchDayStats(date) {
  var token = PropertiesService.getScriptProperties().getProperty('LW_API_TOKEN');
  var payload = JSON.stringify({
    from: date,
    to: date,
    aggregateTime: false,
    aggregateAdUnits: false,
    aggregateSites: false,
    aggregatePublishers: false,
    includeSoldStatistics: true
  });
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: payload,
    muteHttpExceptions: true
  };
  var response = withRetry(function() {
    return UrlFetchApp.fetch(LW_API_URL, options);
  });
  if (response.getResponseCode() !== 200) {
    Logger.log('API error for ' + date + ': HTTP ' + response.getResponseCode());
    return [];
  }
  var data = JSON.parse(response.getContentText());
  // Adjust the key below based on Task 5 findings:
  var stats = data.statistics || data.stats || (Array.isArray(data) ? data : []);
  var rows = [];
  for (var i = 0; i < stats.length; i++) {
    var s = stats[i];
    if (s.publisher !== PUBLISHER_FILTER) continue;
    rows.push([
      s.date || date,           // A: Date
      'LiveWrapped',             // B: Source
      s.publisher || '',         // C: Publisher
      s.site || '',              // D: Site
      s.placement || '',         // E: Placement
      s.availableImpressions || 0,  // F: Available Impressions — UPDATE field name if needed
      s.viewableImpressions || 0,   // G: Viewable Impressions — UPDATE field name if needed
      s.soldImpressions || 0,       // H: Sold Impressions — UPDATE field name if needed
      s.revenue || 0,               // I: Revenue — UPDATE field name if needed
      s.inViewRate || 0             // J: In View % — UPDATE field name if needed
    ]);
  }
  return rows;
}
```

- [ ] **Step 2: Add a test function**

```javascript
function testFetchDayStats() {
  var date = daysAgo(2);
  var rows = fetchDayStats(date);
  Logger.log('Date: ' + date);
  Logger.log('Rows returned: ' + rows.length);
  if (rows.length > 0) {
    Logger.log('First row: ' + JSON.stringify(rows[0]));
  }
}
```

- [ ] **Step 3: Push and run the test**

```bash
clasp push
```

Run `testFetchDayStats` in the editor.

Expected log output:
```
Date: 2026-05-24
Rows returned: 11
First row: ["2026-05-24","LiveWrapped","Mindmax testi","telsu.fi","Telsu.fi TOP",58,56,40,0.08,0.775]
```

If rows returned is 0, check:
- Is the API token set correctly in Script Properties?
- Is `PUBLISHER_FILTER` spelled exactly as it appears in the API response? (Check the raw response from Task 5)
- Are the field names correct?

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add fetchDayStats with LW API call"
```

---

### Task 7: upsertRows(sheet, rows)

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add `upsertRows` to `Code.js`**

```javascript
function upsertRows(sheet, newRows) {
  if (newRows.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    withRetry(function() {
      sheet.getRange(2, 1, newRows.length, NUM_COLS).setValues(newRows);
    });
    return;
  }
  var existing = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  var index = {};
  for (var i = 0; i < existing.length; i++) {
    var key = existing[i][0] + '|' + existing[i][4]; // Date + Placement
    index[key] = i + 2; // 1-based sheet row number
  }
  var toAppend = [];
  for (var j = 0; j < newRows.length; j++) {
    var row = newRows[j];
    var key = row[0] + '|' + row[4]; // Date + Placement
    if (key in index) {
      withRetry(function() {
        sheet.getRange(index[key], 1, 1, NUM_COLS).setValues([row]);
      });
    } else {
      toAppend.push(row);
    }
  }
  if (toAppend.length > 0) {
    withRetry(function() {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, NUM_COLS).setValues(toAppend);
    });
  }
}
```

- [ ] **Step 2: Add a test function**

```javascript
function testUpsertRows() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LW_SHEET_NAME);
  var testRows = [
    ['2020-01-01', 'LiveWrapped', 'Mindmax testi', 'telsu.fi', 'TEST PLACEMENT', 100, 80, 50, 1.23, 0.80],
    ['2020-01-01', 'LiveWrapped', 'Mindmax testi', 'telsu.fi', 'TEST PLACEMENT 2', 200, 160, 100, 2.46, 0.80]
  ];
  upsertRows(sheet, testRows);
  Logger.log('Inserted 2 test rows. Sheet last row: ' + sheet.getLastRow());

  // Now update the first row and verify it overwrites
  var updatedRows = [
    ['2020-01-01', 'LiveWrapped', 'Mindmax testi', 'telsu.fi', 'TEST PLACEMENT', 999, 999, 999, 9.99, 0.99]
  ];
  upsertRows(sheet, updatedRows);
  Logger.log('Upserted 1 existing row. Sheet last row should still be: ' + sheet.getLastRow());

  // Clean up test rows
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, NUM_COLS).getValues();
  var keepRows = data.filter(function(r) { return r[4].indexOf('TEST') !== 0; });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  if (keepRows.length > 0) {
    sheet.getRange(2, 1, keepRows.length, NUM_COLS).setValues(keepRows);
  }
  Logger.log('Test rows cleaned up.');
}
```

- [ ] **Step 3: Push and run the test**

```bash
clasp push
```

Run `testUpsertRows` in the editor.

Expected log output:
```
Inserted 2 test rows. Sheet last row: 3
Upserted 1 existing row. Sheet last row should still be: 3
Test rows cleaned up.
```

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add upsertRows with date+placement key"
```

---

### Task 8: refreshData() and initialLoad()

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add `refreshData` and `initialLoad` to `Code.js`**

```javascript
function refreshData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LW_SHEET_NAME);
  for (var i = 1; i <= 3; i++) {
    var date = daysAgo(i);
    var rows = fetchDayStats(date);
    upsertRows(sheet, rows);
    Logger.log(date + ': ' + rows.length + ' rows upserted');
    Utilities.sleep(1000);
  }
}

function initialLoad() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LW_SHEET_NAME);
  for (var i = 1; i <= 7; i++) {
    var date = daysAgo(i);
    var rows = fetchDayStats(date);
    upsertRows(sheet, rows);
    Logger.log(date + ': ' + rows.length + ' rows upserted');
    Utilities.sleep(1000);
  }
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

- [ ] **Step 3: Run `initialLoad` in the editor**

  Select `initialLoad` from the function dropdown and click **Run**.

  Expected log output (11 placements × 7 days = ~77 rows):
  ```
  2026-05-25: 11 rows upserted
  2026-05-24: 11 rows upserted
  2026-05-23: 11 rows upserted
  2026-05-22: 11 rows upserted
  2026-05-21: 11 rows upserted
  2026-05-20: 11 rows upserted
  2026-05-19: 11 rows upserted
  ```

  Open the Google Sheet and verify the `LW` tab has ~77 rows with correct data.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add refreshData and initialLoad entry points"
```

---

### Task 9: Daily trigger

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add `createDailyTrigger` to `Code.js`**

```javascript
function createDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'refreshData') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('refreshData')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone('Europe/Helsinki')
    .create();
  Logger.log('Daily trigger created: refreshData at 6 AM Helsinki time');
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

- [ ] **Step 3: Run `createDailyTrigger` once in the editor**

  Select `createDailyTrigger` and click **Run**. Grant any permissions it asks for.

  Expected log:
  ```
  Daily trigger created: refreshData at 6 AM Helsinki time
  ```

  Verify by going to **Triggers** (clock icon in the left sidebar of the Apps Script editor). You should see one trigger: `refreshData` / Time-driven / Day timer / 6am to 7am.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add daily 6am trigger setup"
```

---

### Task 10: Add `onOpen` menu

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: Add `onOpen` to `Code.js`**

```javascript
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Telsu seuranta')
    .addItem('Refresh (last 3 days)', 'refreshData')
    .addItem('Initial load (last 7 days)', 'initialLoad')
    .addToUi();
}
```

- [ ] **Step 2: Push**

```bash
clasp push
```

- [ ] **Step 3: Reload the Google Sheet**

  Close and reopen the Google Sheet. A **"Telsu seuranta"** menu should appear in the menu bar with both items.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add onOpen menu for manual refresh"
```

---

## Summary: one-time setup checklist

After completing all tasks, verify:

- [ ] `SPREADSHEET_ID` is set in `Code.js`
- [ ] `LW_API_TOKEN` is set in Script Properties
- [ ] `LW` tab has headers in row 1 and data from `initialLoad()`
- [ ] `Google` tab has headers in row 1 (empty data — phase 2)
- [ ] `Summary` tab has the QUERY formula in A1
- [ ] Daily trigger registered at 6 AM Helsinki time
- [ ] "Telsu seuranta" menu visible in the Google Sheet
