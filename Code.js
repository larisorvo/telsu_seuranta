var SPREADSHEET_ID = '1YqwtZsGymSMcp2wJrW_yNJZW1xdnSFwzzB1TtMqC1vI';
var LW_API_URL = 'https://api.livewrapped.com/Statistics';
var LW_INVENTORY_URL = 'https://api.livewrapped.com/StatsInventory';
var LW_SITE_ID = '3874b663-6c91-4c50-8dc6-b8b1063511b6'; // telsu.fi site ID
var PUBLISHER_NAME = 'Mindmax testi';
var LW_SHEET_NAME = 'LW';
var GAM_SHEET_NAME = 'Google';
var GAM_REPORT_SENDER = 'admanager-noreply@google.com';
var GAM_REPORT_SUBJECT = 'Report: im report';
var OWN_GAM_SHEET_NAME = 'Own GAM';
var OWN_GAM_REPORT_SUBJECT = 'Report: New Päivämyynti Telsu.fi';
var HEADERS = [
  'Date', 'Source', 'Publisher', 'Site', 'Placement',
  'Available Impressions', 'Viewable Impressions',
  'Sold Impressions', 'Revenue', 'In View %'
];
var NUM_COLS = 10;

function daysAgo(n) {
  var d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, 'Europe/Helsinki', 'yyyy-MM-dd');
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

function lwAuthHeaders() {
  var token = PropertiesService.getScriptProperties().getProperty('LW_API_TOKEN');
  if (!token) throw new Error('LW_API_TOKEN not set in Script Properties.');
  return {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json-patch+json',
    'accept': 'application/json'
  };
}

function lwGetSiteNameMap() {
  var resp = withRetry(function() {
    return UrlFetchApp.fetch(LW_INVENTORY_URL + '/publisher/site', {
      method: 'get',
      headers: lwAuthHeaders(),
      muteHttpExceptions: true
    });
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Site inventory fetch failed: ' + resp.getResponseCode());
  }
  var sites = JSON.parse(resp.getContentText());
  var map = {};
  for (var i = 0; i < sites.length; i++) {
    map[sites[i].id] = sites[i].name;
  }
  return map;
}

function lwFetchAdUnitsForSite(siteId) {
  var resp = withRetry(function() {
    return UrlFetchApp.fetch(LW_INVENTORY_URL + '/site/' + siteId + '/adunit', {
      method: 'get',
      headers: lwAuthHeaders(),
      muteHttpExceptions: true
    });
  });
  if (resp.getResponseCode() !== 200) return [];
  return JSON.parse(resp.getContentText());
}

function lwGetAdUnitNameMap(siteIds) {
  var map = {};
  for (var i = 0; i < siteIds.length; i++) {
    var units = lwFetchAdUnitsForSite(siteIds[i]);
    for (var j = 0; j < units.length; j++) {
      map[units[j].id] = units[j].name;
    }
  }
  return map;
}

var LW_PLACEMENT_MAP = {
  'Telsu.fi MOBILE BOTTOM':    'Telsu.fi Bottom',
  'Telsu.fi BOTTOM':           'Telsu.fi Bottom',
  'Telsu.fi CONTENT':          'Telsu.fi Cont',
  'Telsu.fi MOBILE CONTENT':   'Telsu.fi Cont',
  'Telsu.fi MOBILE 1 CONTENT': 'Telsu.fi Cont 1',
  'Telsu.fi MOBILE 2 CONTENT': 'Telsu.fi Cont 2',
  'Telsu.fi DETAILS':          'Telsu.fi Dets',
  'Telsu.fi MOBILE DETAILS':   'Telsu.fi Dets',
  'Telsu.fi TOP':              'Telsu.fi Top',
  'Telsu.fi MOBILE TOP':       'Telsu.fi Top',
  'Telsu.fi SIDEBAR':          'Telsu.fi Search'
};

function fetchDayStats(date, siteNames, adUnitNames) {
  var payload = JSON.stringify({
    from: date,
    to: date,
    aggregationLevel: 2,
    siteIds: [LW_SITE_ID],
    aggregateTime: false,
    aggregateAdUnits: false,
    aggregateSites: false,
    aggregatePublishers: false,
    aggregateBuyers: true,
    aggregateAdvertiserNames: true,
    aggregateAdvertiserDomains: true,
    aggregateDeals: true,
    aggregateResellers: true,
    aggregateLivewrappedDeals: true,
    aggregateAgencies: true,
    aggregateSeats: true,
    aggregateBrowser: true,
    aggregateCookieSupport: true,
    includeSubSetPublishers: true,
    avoidClientAggregation: true,
    includeBidLevels: false,
    includeNoBidResponses: false,
    includeErrors: false,
    includeResponseTimes: false,
    includeFormats: false,
    includeUserStatistics: 0,
    includeSoldStatistics: false,
    includeDealStatistics: false,
    includeAvails: true
  });

  var resp = withRetry(function() {
    return UrlFetchApp.fetch(LW_API_URL, {
      method: 'post',
      headers: lwAuthHeaders(),
      payload: payload,
      muteHttpExceptions: true
    });
  });

  if (resp.getResponseCode() !== 200) {
    throw new Error('LW Statistics API error ' + resp.getResponseCode() + ': ' + resp.getContentText());
  }

  var data = JSON.parse(resp.getContentText());
  var stats = (data && data.stats) ? data.stats : [];
  var rowMap = {};

  for (var i = 0; i < stats.length; i++) {
    var s = stats[i];
    var dateStr = Utilities.formatDate(new Date(s.from), 'Europe/Helsinki', 'yyyy-MM-dd');
    var siteName = (siteNames[s.siteId]) ? siteNames[s.siteId] : s.siteId;
    var rawPlacement = (adUnitNames[s.adUnitId]) ? adUnitNames[s.adUnitId] : s.adUnitId;
    var placement = LW_PLACEMENT_MAP[rawPlacement] || rawPlacement;
    var avail = (s.request && s.request.adUnitRequests) ? Number(s.request.adUnitRequests) : 0;
    var viewable = (s.response && s.response.views) ? Number(s.response.views) : 0;
    var sold = (s.response && s.response.soldImpressions) ? Number(s.response.soldImpressions) : 0;
    var revenue = (s.response && s.response.netRevenue && s.response.netRevenue.amountInPublisherCurrency != null)
      ? Number(s.response.netRevenue.amountInPublisherCurrency) : 0;

    var key = dateStr + '|' + siteName + '|' + placement;
    if (rowMap[key]) {
      rowMap[key][5] += avail;
      rowMap[key][6] += viewable;
      rowMap[key][7] += sold;
      rowMap[key][8] += revenue;
    } else {
      rowMap[key] = [dateStr, 'LiveWrapped', PUBLISHER_NAME, siteName, placement,
                     avail, viewable, sold, revenue, 0];
    }
  }

  var rows = [];
  for (var key in rowMap) {
    var r = rowMap[key];
    r[9] = (r[7] > 0) ? r[6] / r[7] : 0; // In View % = viewable / sold
    rows.push(r);
  }
  return rows;
}

function parseGamCsv(csvText) {
  var lines = csvText.split('\n');
  var date = null;
  var publisher = '';
  var dataHeaderIdx = -1;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace('\r', '');
    if (line.indexOf('Date range,') === 0) {
      var dateStr = line.slice('Date range,'.length).replace(/"/g, '').trim();
      date = Utilities.formatDate(new Date(dateStr), 'Europe/Helsinki', 'yyyy-MM-dd');
    }
    if (line.indexOf('Publisher network,') === 0) {
      publisher = line.slice('Publisher network,'.length).replace(/"/g, '').trim();
    }
    if (line.indexOf('Ad unit (all levels),') === 0) {
      dataHeaderIdx = i;
      break;
    }
  }

  if (!date || dataHeaderIdx === -1) return [];

  var rows = [];
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = dataLine.split(',');
    if (cols.length < 6) continue;
    var placement = cols[0].trim();
    if (!placement) continue;
    var site = placement.split(' ')[0].toLowerCase();
    var avail = parseInt(cols[1], 10) || 0;
    var sold = parseInt(cols[2], 10) || 0;
    var revenue = parseFloat(cols[3]) || 0;
    var inViewPct = parseFloat(cols[5]) || 0;
    var viewable = Math.round(sold * inViewPct);
    rows.push([date, 'Google AdX', publisher, site, placement,
               avail, viewable, sold, revenue, inViewPct]);
  }
  return rows;
}

function parseCsvRow(line) {
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseOwnGamCsv(csvText) {
  var lines = csvText.split('\n');
  var date = null;
  var publisher = '';
  var dataHeaderIdx = -1;
  var hasOrderCol = false;
  var hasAvailCol = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace('\r', '');
    if (line.indexOf('Date range,') === 0) {
      var dateStr = line.slice('Date range,'.length).replace(/"/g, '').trim();
      date = Utilities.formatDate(new Date(dateStr), 'Europe/Helsinki', 'yyyy-MM-dd');
    }
    if (line.indexOf('Publisher network,') === 0) {
      publisher = line.slice('Publisher network,'.length).replace(/"/g, '').trim();
    }
    if (line.indexOf('Ad unit (all levels),') === 0) {
      dataHeaderIdx = i;
      // New format: placement, Order, revenue, impressions, inViewPct, eCPM
      hasOrderCol = line.indexOf(',Order,') !== -1;
      // Old full format: placement, revenue, avail, sold, fillRate, inViewPct, eCPM
      hasAvailCol = !hasOrderCol && line.indexOf('Total ad requests') !== -1;
      break;
    }
  }

  if (!date || dataHeaderIdx === -1) return [];

  var rowMap = {};
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = parseCsvRow(dataLine);
    if (cols.length < 2) continue;

    var rawName = cols[0];
    var revenue, avail, sold, inViewPct, viewable;

    if (hasOrderCol) {
      // New format: cols[0]=placement, cols[1]=order, cols[2]=revenue,
      //             cols[3]=impressions, cols[4]=inViewPct, cols[5]=eCPM
      if (cols.length < 4) continue;
      revenue  = parseFloat(cols[2]) || 0;
      avail    = 0;
      sold     = parseInt(cols[3], 10) || 0;
      inViewPct = parseFloat(cols[4]) || 0;
      viewable = Math.round(sold * inViewPct);
    } else if (hasAvailCol) {
      // Old full format: placement, revenue, avail, sold, fillRate, inViewPct, eCPM
      revenue  = parseFloat(cols[1]) || 0;
      avail    = parseInt(cols[2], 10) || 0;
      sold     = parseInt(cols[3], 10) || 0;
      inViewPct = parseFloat(cols[5]) || 0;
      viewable = Math.round(sold * inViewPct);
    } else {
      // Old minimal format: placement, revenue only
      revenue = parseFloat(cols[1]) || 0;
      avail = 0; sold = 0; viewable = 0;
    }

    // Strip "Telsu.fi » " hierarchy prefix (» = U+00BB)
    var parts = rawName.split('»');
    var rawPlacement = (parts.length > 1) ? parts[parts.length - 1].trim() : rawName;
    var placement = LW_PLACEMENT_MAP[rawPlacement] || rawPlacement;

    var key = date + '|telsu.fi|' + placement;
    if (rowMap[key]) {
      rowMap[key][5] += avail;
      rowMap[key][6] += viewable;
      rowMap[key][7] += sold;
      rowMap[key][8] += revenue;
    } else {
      rowMap[key] = [date, 'Own GAM', publisher, 'telsu.fi', placement,
                     avail, viewable, sold, revenue, 0];
    }
  }

  var rows = [];
  for (var k in rowMap) {
    var r = rowMap[k];
    r[9] = (r[7] > 0) ? r[6] / r[7] : 0;
    rows.push(r);
  }
  return rows;
}

function refreshOwnGamData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(OWN_GAM_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(OWN_GAM_SHEET_NAME);

  var query = 'from:' + GAM_REPORT_SENDER + ' subject:"' + OWN_GAM_REPORT_SUBJECT + '" has:attachment newer_than:7d';
  var threads = GmailApp.search(query);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var msg = messages[messages.length - 1];
    var attachments = msg.getAttachments();
    for (var j = 0; j < attachments.length; j++) {
      var att = attachments[j];
      if (att.getName().toLowerCase().indexOf('.csv') !== -1) {
        var rows = parseOwnGamCsv(att.getDataAsString());
        upsertRows(sheet, rows);
        break;
      }
    }
  }
  Logger.log('refreshOwnGamData done: %s threads processed.', threads.length);
}

function upsertRows(sheet, rows) {
  if (!rows || rows.length === 0) return;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, NUM_COLS).setValues([HEADERS]);
  }

  var lastRow = sheet.getLastRow();
  var dataRows = Math.max(0, lastRow - 1);
  var index = {};

  if (dataRows > 0) {
    var existing = sheet.getRange(2, 1, dataRows, NUM_COLS).getValues();
    for (var i = 0; i < existing.length; i++) {
      var dateVal = existing[i][0];
      var dateStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, 'Europe/Helsinki', 'yyyy-MM-dd')
        : String(dateVal).slice(0, 10);
      var key = dateStr + '|' + existing[i][3] + '|' + existing[i][4];
      index[key] = i + 2;
    }
  }

  var toAppend = [];
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var key = r[0] + '|' + r[3] + '|' + r[4];
    if (index[key]) {
      sheet.getRange(index[key], 1, 1, NUM_COLS).setValues([r]);
    } else {
      toAppend.push(r);
    }
  }

  if (toAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, NUM_COLS).setValues(toAppend);
  }
}

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
  // Clear full 7-row block first, then write actual data
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
  var numRows = dates.length + 1;  // header row + data rows
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

function refreshGamData() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GAM_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + GAM_SHEET_NAME + '" not found.');

  var query = 'from:' + GAM_REPORT_SENDER + ' subject:"' + GAM_REPORT_SUBJECT + '" has:attachment newer_than:7d';
  var threads = GmailApp.search(query);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var msg = messages[messages.length - 1];
    var attachments = msg.getAttachments();
    for (var j = 0; j < attachments.length; j++) {
      var att = attachments[j];
      if (att.getName().toLowerCase().indexOf('.csv') !== -1) {
        var rows = parseGamCsv(att.getDataAsString());
        upsertRows(sheet, rows);
        break;
      }
    }
  }
}

function refreshData() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LW_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + LW_SHEET_NAME + '" not found.');
  var siteNames = lwGetSiteNameMap();
  var adUnitNames = lwGetAdUnitNameMap([LW_SITE_ID]);
  var rows = fetchDayStats(daysAgo(1), siteNames, adUnitNames);
  upsertRows(sheet, rows);
  refreshGamData();
  refreshOwnGamData();
}

function initialLoad() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LW_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + LW_SHEET_NAME + '" not found.');
  var siteNames = lwGetSiteNameMap();
  var adUnitNames = lwGetAdUnitNameMap([LW_SITE_ID]);
  for (var i = 1; i <= 7; i++) {
    var rows = fetchDayStats(daysAgo(i), siteNames, adUnitNames);
    upsertRows(sheet, rows);
  }
}

function createDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'refreshData') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('refreshData')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log('Daily trigger created: refreshData at 06:00 script timezone.');
}

function setupDashboard() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var tab = ss.getSheetByName('Dashboard');

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

  if (!tab) {
    tab = ss.insertSheet('Dashboard');
  } else {
    tab.clearContents();
    tab.clearFormats();
    tab.setConditionalFormatRules([]);
  }

  var placements = [
    'Telsu.fi Bottom', 'Telsu.fi Cont', 'Telsu.fi Cont 1',
    'Telsu.fi Cont 2', 'Telsu.fi Dets', 'Telsu.fi Search', 'Telsu.fi Top'
  ];

  // Row 1: date selector
  tab.getRange('A1').setValue('Date');
  tab.getRange('B1').setFormula('=TODAY()-1');
  tab.getRange('C1').setValue('← type any YYYY-MM-DD to compare another day');

  // Row 2: config — editable cells, persisted across setups
  tab.getRange('A2').setValue('IM HB+GAM share');
  tab.getRange('B2').setValue(savedImShare);
  tab.getRange('C2').setValue('Mindmax GAM share');
  tab.getRange('D2').setValue(savedMmShare);
  tab.getRange('F2').setValue('IM HB+GAM cost factor');
  tab.getRange('G2').setValue(savedCorrection);

  // Rows 3-7: KPI summary — Mindmax first, then IM columns
  tab.getRange('A3:G3').setValues([['', 'Mindmax GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff', 'Diff %']]);
  // Row 4: Revenue actual (raw numbers)
  tab.getRange('A4').setValue('Revenue (€, actual)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1)');
  tab.getRange('C4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('D4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)');
  tab.getRange('E4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('F4').setFormula('=B4-C4');
  tab.getRange('G4').setFormula('=IFERROR(F4/C4,"")');
  // Row 5: Revenue weighted (normalized by share + cost factor)
  tab.getRange('A5').setValue('Revenue (€, weighted)');
  tab.getRange('B5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C5').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))*$G$2/$B$2,0)');
  tab.getRange('D5').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('E5').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('F5').setFormula('=B5-C5');
  tab.getRange('G5').setFormula('=IFERROR(F5/C5,"")');
  // Row 6: Sold Impressions weighted
  tab.getRange('A6').setValue('Sold Impr (weighted)');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C6').setFormula('=IFERROR((SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1))/$B$2,0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(LW!H:H,LW!A:A,$B$1)/$B$2,0)');
  tab.getRange('E6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)/$B$2,0)');
  tab.getRange('F6').setFormula('=B6-C6');
  tab.getRange('G6').setFormula('=IFERROR(F6/C6,"")');
  // Row 7: Avg In View %
  tab.getRange('A7').setValue('Avg In View %');
  tab.getRange('B7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C7').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('D7').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('E7').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('F7').setFormula('=B7-C7');

  // ---- BLOCK 1 (rows 9-18): Available Impr | Sold Impr | Revenue ----
  // T1 = A-E, gap = F (col 6), T2 = G-K (cols 7-11), empty L (col 12), T3 = M-R (cols 13-18)

  tab.getRange('A9:E9').mergeAcross().setValue('Available Impressions');
  tab.getRange('G9:K9').mergeAcross().setValue('Sold Impressions');
  tab.getRange('M9:R9').mergeAcross().setValue('Revenue');

  tab.getRange('A10').setValue('Placement');
  tab.getRange('B10:E10').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('G10').setValue('Placement');
  tab.getRange('H10:K10').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('M10').setValue('Placement');
  tab.getRange('N10:R10').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i = 0; i < placements.length; i++) {
    var row = 11 + i;
    var r = String(row);
    // T1: Avail — B=Mindmax, C=IM HB+GAM, D=IM HB, E=IM GAM
    tab.getRange(row, 1).setValue(placements[i]);
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
    // T2: Sold — H=Mindmax, I=IM HB+GAM, J=IM HB, K=IM GAM
    tab.getRange(row, 7).setValue(placements[i]);
    tab.getRange(row, 8).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,G'+r+')');
    tab.getRange(row, 9).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,G'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r+')');
    tab.getRange(row, 10).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,G'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r+')');
    // T3: Revenue — N=Mindmax, O=IM HB+GAM, P=IM HB, Q=IM GAM, R=Diff
    tab.getRange(row, 13).setValue(placements[i]);
    tab.getRange(row, 14).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,M'+r+')');
    tab.getRange(row, 15).setFormula('=(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,M'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,M'+r+'))*$G$2');
    tab.getRange(row, 16).setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,M'+r+')*$G$2');
    tab.getRange(row, 17).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,M'+r+')*$G$2');
    tab.getRange(row, 18).setFormula('=N'+r+'-O'+r);
  }

  tab.getRange('A18').setValue('TOTAL');
  tab.getRange('B18').setFormula('=SUM(B11:B17)');
  tab.getRange('C18').setFormula('=SUM(C11:C17)');
  tab.getRange('D18').setFormula('=SUM(D11:D17)');
  tab.getRange('E18').setFormula('=SUM(E11:E17)');
  tab.getRange('G18').setValue('TOTAL');
  tab.getRange('H18').setFormula('=SUM(H11:H17)');
  tab.getRange('I18').setFormula('=SUM(I11:I17)');
  tab.getRange('J18').setFormula('=SUM(J11:J17)');
  tab.getRange('K18').setFormula('=SUM(K11:K17)');
  tab.getRange('M18').setValue('TOTAL');
  tab.getRange('N18').setFormula('=SUM(N11:N17)');
  tab.getRange('O18').setFormula('=SUM(O11:O17)');
  tab.getRange('P18').setFormula('=SUM(P11:P17)');
  tab.getRange('Q18').setFormula('=SUM(Q11:Q17)');
  tab.getRange('R18').setFormula('=N18-O18');

  // ---- BLOCK 2 (rows 21-30): In View % | RPM  (rows 19-20 = spacer) ----
  // T4 = A-E, gap = F, T5 = G-L (cols 7-12)

  tab.getRange('A21:E21').mergeAcross().setValue('In View %');
  tab.getRange('G21:L21').mergeAcross().setValue('RPM (€ per 1k avail)');

  tab.getRange('A22').setValue('Placement');
  tab.getRange('B22:E22').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('G22').setValue('Placement');
  tab.getRange('H22:L22').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i2 = 0; i2 < placements.length; i2++) {
    var row2 = 23 + i2;
    var r2 = String(row2);
    // T4: In View % — B=Mindmax, C=IM HB+GAM, D=IM HB, E=IM GAM
    tab.getRange(row2, 1).setValue(placements[i2]);
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'),0)');
    // T5: RPM — H=Mindmax, I=IM HB+GAM, J=IM HB, K=IM GAM, L=Diff
    tab.getRange(row2, 7).setValue(placements[i2]);
    tab.getRange(row2, 8).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,G'+r2+')/SUMIFS(Google!F:F,Google!A:A,$B$1,Google!E:E,G'+r2+')*1000,0)');
    tab.getRange(row2, 9).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,G'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+'))*$G$2/(SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,G'+r2+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+'))*1000,0)');
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,G'+r2+')*$G$2/SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,G'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+')*$G$2/SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=H'+r2+'-I'+r2);
  }

  tab.getRange('A30').setValue('TOTAL');
  tab.getRange('B30').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C30').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('D30').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('E30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('G30').setValue('TOTAL');
  tab.getRange('H30').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/SUMIFS(Google!F:F,Google!A:A,$B$1)*1000,0)');
  tab.getRange('I30').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))*$G$2/(SUMIFS(LW!F:F,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1))*1000,0)');
  tab.getRange('J30').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)*$G$2/SUMIFS(LW!F:F,LW!A:A,$B$1)*1000,0)');
  tab.getRange('K30').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)*$G$2/SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1)*1000,0)');
  tab.getRange('L30').setFormula('=H30-I30');

  // ---- Number formats ----
  tab.getRange('B1').setNumberFormat('yyyy-mm-dd');
  tab.getRange('B2').setNumberFormat('0%');
  tab.getRange('D2').setNumberFormat('0%');
  tab.getRange('G2').setNumberFormat('0.00');
  tab.getRange('B4:F4').setNumberFormat('€#,##0.00');
  tab.getRange('G4').setNumberFormat('0.0%');
  tab.getRange('B5:F5').setNumberFormat('€#,##0.00');
  tab.getRange('G5').setNumberFormat('0.0%');
  tab.getRange('B6:F6').setNumberFormat('#,##0');
  tab.getRange('G6').setNumberFormat('0.0%');
  tab.getRange('B7:F7').setNumberFormat('0.0%');
  tab.getRange('B11:E18').setNumberFormat('#,##0');
  tab.getRange('H11:K18').setNumberFormat('#,##0');
  tab.getRange('N11:R18').setNumberFormat('€#,##0.00');
  tab.getRange('B23:E30').setNumberFormat('0.0%');
  tab.getRange('H23:L30').setNumberFormat('€#,##0.00');

  // ---- Conditional formatting ----
  // Revenue Diff (R11:R18): red < -5, green > 5
  var revDiffRange = tab.getRange('R11:R18');
  var revRedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(-5)
    .setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([revDiffRange]).build();
  var revGreenRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(5)
    .setBackground('#e6f4ea').setFontColor('#188038')
    .setRanges([revDiffRange]).build();

  // In View %: per-row comparison Mindmax (B) vs IM HB+GAM (C)
  var ivMindmaxRange = tab.getRange('B23:B30');
  var ivImRange = tab.getRange('C23:C30');
  var ivMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B23>$C23').setBackground('#e6f4ea')
    .setRanges([ivMindmaxRange]).build();
  var ivMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B23<$C23').setBackground('#fce8e6')
    .setRanges([ivMindmaxRange]).build();
  var ivImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C23>$B23').setBackground('#e6f4ea')
    .setRanges([ivImRange]).build();
  var ivImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C23<$B23').setBackground('#fce8e6')
    .setRanges([ivImRange]).build();

  // RPM: per-row comparison Mindmax (H) vs IM HB+GAM (I)
  var rpmMindmaxRange = tab.getRange('H23:H30');
  var rpmImRange = tab.getRange('I23:I30');
  var rpmMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H23>$I23').setBackground('#e6f4ea')
    .setRanges([rpmMindmaxRange]).build();
  var rpmMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H23<$I23').setBackground('#fce8e6')
    .setRanges([rpmMindmaxRange]).build();
  var rpmImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I23>$H23').setBackground('#e6f4ea')
    .setRanges([rpmImRange]).build();
  var rpmImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I23<$H23').setBackground('#fce8e6')
    .setRanges([rpmImRange]).build();

  tab.setConditionalFormatRules([
    revRedRule, revGreenRule,
    ivMindmaxGreen, ivMindmaxRed, ivImGreen, ivImRed,
    rpmMindmaxGreen, rpmMindmaxRed, rpmImGreen, rpmImRed
  ]);

  // ---- Styling ----
  // Block 1 group headers
  tab.getRange('A9:E9').setBackground('#d2e3fc').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G9:K9').setBackground('#c8e6c9').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('M9:R9').setBackground('#ffe0b2').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 sub-headers
  tab.getRange('A10:E10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G10:K10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('M10:R10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 totals
  tab.getRange('A18:E18').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('G18:K18').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('M18:R18').setBackground('#f1f3f4').setFontWeight('bold');
  // Block 2 group headers
  tab.getRange('A21:E21').setBackground('#f3e5f5').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G21:L21').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 sub-headers
  tab.getRange('A22:E22').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G22:L22').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 totals
  tab.getRange('A30:E30').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('G30:L30').setBackground('#f1f3f4').setFontWeight('bold');
  // Config row 2: labels grey, editable cells yellow
  tab.getRange('A2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('C2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('F2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('B2').setBackground('#fff8e1').setFontWeight('bold');
  tab.getRange('D2').setBackground('#fff8e1').setFontWeight('bold');
  tab.getRange('G2').setBackground('#fff8e1').setFontWeight('bold');
  // KPI section
  tab.getRange('A3:G3').setBackground('#e8f0fe').setFontWeight('bold');
  tab.getRange('A4:A7').setFontWeight('bold');
  tab.getRange('A5').setFontStyle('italic');
  tab.getRange('A1').setFontWeight('bold');
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  // Placement column bold
  tab.getRange('A11:A17').setFontWeight('bold');
  tab.getRange('G11:G17').setFontWeight('bold');
  tab.getRange('M11:M17').setFontWeight('bold');
  tab.getRange('A23:A29').setFontWeight('bold');
  tab.getRange('G23:G29').setFontWeight('bold');

  // Column widths
  tab.setColumnWidth(1, 160);   // A: Placement
  tab.setColumnWidth(2, 90);    // B
  tab.setColumnWidth(3, 80);    // C
  tab.setColumnWidth(4, 80);    // D
  tab.setColumnWidth(5, 90);    // E
  tab.setColumnWidth(6, 20);    // F: gap
  tab.setColumnWidth(7, 160);   // G: Placement
  tab.setColumnWidth(8, 90);    // H
  tab.setColumnWidth(9, 80);    // I
  tab.setColumnWidth(10, 80);   // J
  tab.setColumnWidth(11, 90);   // K (also T5 RPM Mindmax)
  tab.setColumnWidth(12, 75);   // L: T5 RPM Diff / empty in block 1
  tab.setColumnWidth(13, 160);  // M: T3 Placement / empty in block 2
  tab.setColumnWidth(14, 90);   // N
  tab.setColumnWidth(15, 80);   // O
  tab.setColumnWidth(16, 80);   // P
  tab.setColumnWidth(17, 85);   // Q
  tab.setColumnWidth(18, 75);   // R: Revenue Diff

  Logger.log('Dashboard tab created successfully.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Telsu seuranta')
    .addItem('Refresh yesterday (LW + GAM)', 'refreshData')
    .addItem('Initial load LW (7 days)', 'initialLoad')
    .addItem('Refresh GAM from Gmail', 'refreshGamData')
    .addItem('Refresh Own GAM from Gmail', 'refreshOwnGamData')
    .addSeparator()
    .addItem('Setup Dashboard tab', 'setupDashboard')
    .addSeparator()
    .addItem('Create daily trigger (06:00)', 'createDailyTrigger')
    .addToUi();
}
