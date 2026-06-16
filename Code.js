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
var AD_REQUEST_REPORT_SUBJECT = 'Report: Telsu Ad request report';
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

  // Parse header row dynamically so column additions don't break parsing
  var headerCols = lines[dataHeaderIdx].replace('\r', '').split(',').map(function(h) { return h.trim().replace(/"/g, ''); });
  function colIdx(name) { var i = headerCols.indexOf(name); return i === -1 ? null : i; }
  var iPlacement = colIdx('Ad unit (all levels)');
  var iAvail     = colIdx('Total ad requests');
  var iSold      = colIdx('Total impressions');
  var iRevenue   = colIdx('Total revenue');
  var iInView    = colIdx('Total Active View % viewable impressions');
  var iSvrImpr   = colIdx('Ad server impressions');
  var iSvrRev    = colIdx('Ad server CPM and CPC revenue');
  if (iPlacement === null || iSold === null || iRevenue === null) {
    Logger.log('parseGamCsv: missing expected columns in header: %s', headerCols.join('|'));
    return [];
  }

  var rows = [];
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = dataLine.split(',');
    if (cols.length < 4) continue;
    var placement = cols[iPlacement].trim().replace(/"/g, '');
    if (!placement) continue;
    var site       = placement.split(' ')[0].toLowerCase();
    var avail      = iAvail  !== null ? (parseInt(cols[iAvail], 10)  || 0) : 0;
    var sold       = parseInt(cols[iSold], 10) || 0;
    var revenue    = parseFloat(cols[iRevenue]) || 0;
    var inViewPct  = iInView !== null ? (parseFloat(cols[iInView])   || 0) : 0;
    var svrImpr    = iSvrImpr !== null ? (parseInt(cols[iSvrImpr], 10) || 0) : 0;
    var svrRev     = iSvrRev  !== null ? (parseFloat(cols[iSvrRev])    || 0) : 0;
    var gamImpr    = sold - svrImpr;
    var gamRev     = revenue - svrRev;
    // MM HB row (Ad server portion)
    rows.push([date, 'Google HB', publisher, site, placement,
               svrImpr, Math.round(svrImpr * inViewPct), svrImpr, svrRev, inViewPct]);
    // MM GAM row (Ad Exchange portion = total minus Ad server)
    rows.push([date, 'Google GAM', publisher, site, placement,
               gamImpr, Math.round(gamImpr * inViewPct), gamImpr, gamRev, inViewPct]);
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

function parseOwnGamCsv(csvText, availData) {
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

  // Dynamic column lookup — tolerates any column order or additions
  var headerCols = lines[dataHeaderIdx].replace('\r', '').split(',').map(function(h) { return h.trim().replace(/"/g, ''); });
  function colIdx(name) { var idx = headerCols.indexOf(name); return idx === -1 ? null : idx; }
  var iPlacement = colIdx('Ad unit (all levels)');
  var iRevenue   = colIdx('Total revenue');
  var iSold      = colIdx('Total impressions');
  var iAvail     = colIdx('Total ad requests');
  var iInView    = colIdx('Total Active View % viewable impressions');
  if (iPlacement === null || iRevenue === null) {
    Logger.log('parseOwnGamCsv: missing required columns in header: %s', headerCols.join('|'));
    return [];
  }

  var rowMap = {};
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = parseCsvRow(dataLine);
    if (cols.length < 2) continue;

    var rawName = cols[iPlacement];
    var revenue   = parseFloat(cols[iRevenue]) || 0;
    var sold      = iSold   !== null ? (parseInt(cols[iSold], 10)   || 0) : 0;
    var inViewPct = iInView !== null ? (parseFloat(cols[iInView])   || 0) : 0;
    var viewable  = Math.round(sold * inViewPct);

    // Strip "Telsu.fi » " hierarchy prefix (» = U+00BB)
    var parts = rawName.split('»');
    var rawPlacement = (parts.length > 1) ? parts[parts.length - 1].trim() : rawName;
    var placement = LW_PLACEMENT_MAP[rawPlacement] || rawPlacement;

    // Prefer ad request report for avail; fall back to column in CSV if present
    var avail = (availData && availData[date] && availData[date][placement])
      ? availData[date][placement]
      : (iAvail !== null ? (parseInt(cols[iAvail], 10) || 0) : 0);

    var key = date + '|telsu.fi|' + placement;
    if (rowMap[key]) {
      rowMap[key][5] = Math.max(rowMap[key][5], avail);  // avail is per placement, not additive
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

function parseAdRequestCsv(csvText) {
  var lines = csvText.split('\n');
  var date = null;
  var dataHeaderIdx = -1;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace('\r', '');
    if (line.indexOf('Date range,') === 0) {
      var dateStr = line.slice('Date range,'.length).replace(/"/g, '').trim();
      date = Utilities.formatDate(new Date(dateStr), 'Europe/Helsinki', 'yyyy-MM-dd');
    }
    if (line.indexOf('Ad unit (all levels),') === 0) {
      dataHeaderIdx = i;
      break;
    }
  }

  if (!date || dataHeaderIdx === -1) return null;

  var placements = {};
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = parseCsvRow(dataLine);
    if (cols.length < 2) continue;

    var rawName = cols[0];
    // Handle both correct UTF-8 (») and mis-encoded (Â») variants
    var sep = rawName.indexOf('»') !== -1 ? '»' : 'Â»';
    var parts = rawName.split(sep);
    var rawPlacement = (parts.length > 1) ? parts[parts.length - 1].trim() : rawName;
    var placement = LW_PLACEMENT_MAP[rawPlacement] || rawPlacement;
    placements[placement] = (placements[placement] || 0) + (parseInt(cols[1], 10) || 0);
  }

  return {date: date, placements: placements};
}

function readAdRequestData() {
  // Returns {date: {normalizedPlacement: adRequests}} for last 7 days
  var query = 'from:' + GAM_REPORT_SENDER + ' subject:"' + AD_REQUEST_REPORT_SUBJECT + '" has:attachment newer_than:7d';
  var threads = GmailApp.search(query);
  var result = {};

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var msg = messages[messages.length - 1];
    var attachments = msg.getAttachments();
    for (var j = 0; j < attachments.length; j++) {
      var att = attachments[j];
      if (att.getName().toLowerCase().indexOf('.csv') !== -1) {
        var parsed = parseAdRequestCsv(att.getDataAsString());
        if (parsed && parsed.date) result[parsed.date] = parsed.placements;
        break;
      }
    }
  }
  return result;
}

function refreshOwnGamData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(OWN_GAM_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(OWN_GAM_SHEET_NAME);

  var availData = readAdRequestData();  // {date: {placement: adRequests}}

  var query = 'from:' + GAM_REPORT_SENDER + ' subject:"' + OWN_GAM_REPORT_SUBJECT + '" has:attachment newer_than:7d';
  var threads = GmailApp.search(query);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var msg = messages[messages.length - 1];
    var attachments = msg.getAttachments();
    for (var j = 0; j < attachments.length; j++) {
      var att = attachments[j];
      if (att.getName().toLowerCase().indexOf('.csv') !== -1) {
        var rows = parseOwnGamCsv(att.getDataAsString(), availData);
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
      var key = dateStr + '|' + existing[i][1] + '|' + existing[i][3] + '|' + existing[i][4];
      index[key] = i + 2;
    }
  }

  var toAppend = [];
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var key = r[0] + '|' + r[1] + '|' + r[3] + '|' + r[4];
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
  if (!googleSheet) Logger.log('refreshCharts: Google sheet missing — Mindmax data will be zero');
  if (!ownGamSheet) Logger.log('refreshCharts: Own GAM sheet missing — IM GAM data will be zero');

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

  // 2. Read revenue share/factor from Dashboard row 2 (B2=IM share, D2=Mindmax share, G2=IM cost factor)
  var shareRow   = dashSheet.getRange(2, 1, 1, 7).getValues()[0];
  var imShare    = Number(shareRow[1]) || 0.25;   // B2
  var mmShare    = Number(shareRow[3]) || 0.75;   // D2
  var imCostFactor = Number(shareRow[6]) || 1;    // G2

  // 3. Aggregate totals per date from all three sheets
  var mmData  = getSheetDataByDate(googleSheet);
  var lwData  = getSheetDataByDate(lwSheet);
  var ownData = getSheetDataByDate(ownGamSheet);

  // 4. Write helper range rows 33-41 (below Block 2, rows 21-30)
  var START = 33;
  dashSheet.showRows(START, 9);
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
    var mmRevWeighted = mmShare > 0 ? mm.rev / mmShare : mm.rev;
    var imRevWeighted = imShare > 0 ? (lw.rev + own.rev) / imShare * imCostFactor : (lw.rev + own.rev);
    rows.push([
      dt,
      mmRevWeighted,
      imRevWeighted,
      mm.sold,
      imSold,
      mm.sold > 0 ? mm.view / mm.sold : 0,
      imSold > 0  ? imView  / imSold  : 0
    ]);
  }
  // Clear full 7-row block first, then write actual data
  dashSheet.getRange(START + 2, 1, 7, 7).clearContent();
  dashSheet.getRange(START + 2, 1, dates.length, 7).setValues(rows);

  // 5. Remove all existing charts on Dashboard
  var existing = dashSheet.getCharts();
  for (var k = 0; k < existing.length; k++) {
    dashSheet.removeChart(existing[k]);
  }

  // 6. Build 3 line charts anchored at row 76 (below all data tables)
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

function removeRowsBySource(sheet, source) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var sourceVals = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = sourceVals.length - 1; i >= 0; i--) {
    if (sourceVals[i][0] === source) sheet.deleteRow(i + 2);
  }
}

function refreshGamData() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(GAM_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + GAM_SHEET_NAME + '" not found.');

  // Remove old single-row-per-placement format (Source='Google AdX') — now stored as HB+GAM split
  removeRowsBySource(sheet, 'Google AdX');

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
  refreshCharts();
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
    .atHour(7)
    .create();
  Logger.log('Daily trigger created: refreshData at 07:00 script timezone.');
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

  // Rows 3-7: KPI summary
  // Cols: A=label | B=MM HB+GAM | C=MM HB | D=MM GAM | E=IM HB+GAM | F=IM HB | G=IM GAM | H=Diff | I=Diff%
  tab.getRange('A3:I3').setValues([['', 'MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff', 'Diff %']]);

  tab.getRange('A4').setValue('Revenue (€, actual)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1)');
  tab.getRange('C4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB")');
  tab.getRange('D4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM")');
  tab.getRange('E4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('F4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)');
  tab.getRange('G4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('H4').setFormula('=B4-E4');
  tab.getRange('I4').setFormula('=IFERROR(H4/E4,"")');

  tab.getRange('A5').setValue('Revenue (€, weighted)');
  tab.getRange('B5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D5').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E5').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))*$G$2/$B$2,0)');
  tab.getRange('F5').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('G5').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)*$G$2/$B$2,0)');
  tab.getRange('H5').setFormula('=B5-E5');
  tab.getRange('I5').setFormula('=IFERROR(H5/E5,"")');

  tab.getRange('A6').setValue('Sold Impr (weighted)');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1)/$D$2,0)');
  tab.getRange('C6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB")/$D$2,0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM")/$D$2,0)');
  tab.getRange('E6').setFormula('=IFERROR((SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1))/$B$2,0)');
  tab.getRange('F6').setFormula('=IFERROR(SUMIFS(LW!H:H,LW!A:A,$B$1)/$B$2,0)');
  tab.getRange('G6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)/$B$2,0)');
  tab.getRange('H6').setFormula('=B6-E6');
  tab.getRange('I6').setFormula('=IFERROR(H6/E6,"")');

  tab.getRange('A7').setValue('Avg In View %');
  tab.getRange('B7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google HB")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB"),0)');
  tab.getRange('D7').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google GAM")/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM"),0)');
  tab.getRange('E7').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('F7').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('G7').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('H7').setFormula('=B7-E7');

  // ---- BLOCK 1 (rows 9-18): Avail | Sold | Revenue ----
  // T1: A(1)=label, B(2)=MM+, C(3)=MM HB, D(4)=MM GAM, E(5)=IM+, F(6)=IM HB, G(7)=IM GAM, [H(8)=gap]
  // T2: I(9)=label, J(10)=MM+, K(11)=MM HB, L(12)=MM GAM, M(13)=IM+, N(14)=IM HB, O(15)=IM GAM, [P(16)=gap]
  // T3: Q(17)=label, R(18)=MM+, S(19)=MM HB, T(20)=MM GAM, U(21)=IM+, V(22)=IM HB, W(23)=IM GAM, X(24)=Diff

  tab.getRange('A9:G9').mergeAcross().setValue('Available Impressions');
  tab.getRange('I9:O9').mergeAcross().setValue('Sold Impressions');
  tab.getRange('Q9:X9').mergeAcross().setValue('Revenue');

  tab.getRange('A10').setValue('Placement');
  tab.getRange('B10:G10').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('I10').setValue('Placement');
  tab.getRange('J10:O10').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('Q10').setValue('Placement');
  tab.getRange('R10:X10').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i = 0; i < placements.length; i++) {
    var row = 11 + i;
    var r = String(row);
    // T1: Avail
    tab.getRange(row, 1).setValue(placements[i]);
    tab.getRange(row, 2).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!E:E,A'+r+')');
    tab.getRange(row, 3).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r+')');
    tab.getRange(row, 4).setFormula('=SUMIFS(Google!F:F,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r+')');
    tab.getRange(row, 5).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
    tab.getRange(row, 6).setFormula('=SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,A'+r+')');
    tab.getRange(row, 7).setFormula('=SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r+')');
    // T2: Sold
    tab.getRange(row, 9).setValue(placements[i]);
    tab.getRange(row, 10).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,I'+r+')');
    tab.getRange(row, 11).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r+')');
    tab.getRange(row, 12).setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r+')');
    tab.getRange(row, 13).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r+')');
    tab.getRange(row, 14).setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r+')');
    tab.getRange(row, 15).setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r+')');
    // T3: Revenue
    tab.getRange(row, 17).setValue(placements[i]);
    tab.getRange(row, 18).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,Q'+r+')');
    tab.getRange(row, 19).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r+')');
    tab.getRange(row, 20).setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r+')');
    tab.getRange(row, 21).setFormula('=(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r+'))*$G$2');
    tab.getRange(row, 22).setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 23).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r+')*$G$2');
    tab.getRange(row, 24).setFormula('=R'+r+'-U'+r);
  }

  tab.getRange('A18').setValue('TOTAL');
  tab.getRange('B18').setFormula('=SUM(B11:B17)');
  tab.getRange('C18').setFormula('=SUM(C11:C17)');
  tab.getRange('D18').setFormula('=SUM(D11:D17)');
  tab.getRange('E18').setFormula('=SUM(E11:E17)');
  tab.getRange('F18').setFormula('=SUM(F11:F17)');
  tab.getRange('G18').setFormula('=SUM(G11:G17)');
  tab.getRange('I18').setValue('TOTAL');
  tab.getRange('J18').setFormula('=SUM(J11:J17)');
  tab.getRange('K18').setFormula('=SUM(K11:K17)');
  tab.getRange('L18').setFormula('=SUM(L11:L17)');
  tab.getRange('M18').setFormula('=SUM(M11:M17)');
  tab.getRange('N18').setFormula('=SUM(N11:N17)');
  tab.getRange('O18').setFormula('=SUM(O11:O17)');
  tab.getRange('Q18').setValue('TOTAL');
  tab.getRange('R18').setFormula('=SUM(R11:R17)');
  tab.getRange('S18').setFormula('=SUM(S11:S17)');
  tab.getRange('T18').setFormula('=SUM(T11:T17)');
  tab.getRange('U18').setFormula('=SUM(U11:U17)');
  tab.getRange('V18').setFormula('=SUM(V11:V17)');
  tab.getRange('W18').setFormula('=SUM(W11:W17)');
  tab.getRange('X18').setFormula('=R18-U18');

  // ---- BLOCK 2 (rows 21-30): In View % | RPM ----
  // T4: A(1)=label, B(2)=MM+, C(3)=MM HB, D(4)=MM GAM, E(5)=IM+, F(6)=IM HB, G(7)=IM GAM, [H(8)=gap]
  // T5: I(9)=label, J(10)=MM+, K(11)=MM HB, L(12)=MM GAM, M(13)=IM+, N(14)=IM HB, O(15)=IM GAM, P(16)=Diff

  tab.getRange('A21:G21').mergeAcross().setValue('In View %');
  tab.getRange('I21:P21').mergeAcross().setValue('eCPM (€ per 1k sold)');
  tab.getRange('Q21:X21').mergeAcross().setValue('Weighted Revenue (€)');

  tab.getRange('A22').setValue('Placement');
  tab.getRange('B22:G22').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('I22').setValue('Placement');
  tab.getRange('J22:P22').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);
  tab.getRange('Q22').setValue('Placement');
  tab.getRange('R22:X22').setValues([['MM HB+GAM', 'MM HB', 'MM GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i2 = 0; i2 < placements.length; i2++) {
    var row2 = 23 + i2;
    var r2 = String(row2);
    // T4: In View %
    tab.getRange(row2, 1).setValue(placements[i2]);
    tab.getRange(row2, 2).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 3).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 4).setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,A'+r2+'),0)');
    tab.getRange(row2, 5).setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'))/(SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')),0)');
    tab.getRange(row2, 6).setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1,LW!E:E,A'+r2+')/SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,A'+r2+'),0)');
    tab.getRange(row2, 7).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+')/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,A'+r2+'),0)');
    // T5: eCPM (÷ sold for all — MM already stores sold in F, so F=H there)
    tab.getRange(row2, 9).setValue(placements[i2]);
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')/SUMIFS(Google!H:H,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 13).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+'))*$G$2/(SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r2+')+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+'))*1000,0)');
    tab.getRange(row2, 14).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,I'+r2+')*$G$2/SUMIFS(LW!H:H,LW!A:A,$B$1,LW!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 15).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+')*$G$2/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,I'+r2+')*1000,0)');
    tab.getRange(row2, 16).setFormula('=J'+r2+'-M'+r2);
    // T6: Weighted Revenue at cols Q-X (17-24)
    tab.getRange(row2, 17).setValue(placements[i2]);
    tab.getRange(row2, 18).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 19).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google HB",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 20).setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1,Google!B:B,"Google GAM",Google!E:E,Q'+r2+')/$D$2,0)');
    tab.getRange(row2, 21).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r2+'))*$G$2/$B$2,0)');
    tab.getRange(row2, 22).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 23).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,Q'+r2+')*$G$2/$B$2,0)');
    tab.getRange(row2, 24).setFormula('=R'+r2+'-U'+r2);
  }

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
  tab.getRange('Q30').setValue('TOTAL');
  tab.getRange('R30').setFormula('=SUM(R23:R29)');
  tab.getRange('S30').setFormula('=SUM(S23:S29)');
  tab.getRange('T30').setFormula('=SUM(T23:T29)');
  tab.getRange('U30').setFormula('=SUM(U23:U29)');
  tab.getRange('V30').setFormula('=SUM(V23:V29)');
  tab.getRange('W30').setFormula('=SUM(W23:W29)');
  tab.getRange('X30').setFormula('=R30-U30');

  // ---- Number formats ----
  tab.getRange('B1').setNumberFormat('yyyy-mm-dd');
  tab.getRange('B2').setNumberFormat('0%');
  tab.getRange('D2').setNumberFormat('0%');
  tab.getRange('G2').setNumberFormat('0.00');
  tab.getRange('B4:H4').setNumberFormat('€#,##0.00');
  tab.getRange('I4').setNumberFormat('0.0%');
  tab.getRange('B5:H5').setNumberFormat('€#,##0.00');
  tab.getRange('I5').setNumberFormat('0.0%');
  tab.getRange('B6:H6').setNumberFormat('#,##0');
  tab.getRange('I6').setNumberFormat('0.0%');
  tab.getRange('B7:H7').setNumberFormat('0.0%');
  tab.getRange('B11:G18').setNumberFormat('#,##0');
  tab.getRange('J11:O18').setNumberFormat('#,##0');
  tab.getRange('R11:X18').setNumberFormat('€#,##0.00');
  tab.getRange('B23:G30').setNumberFormat('0.0%');
  tab.getRange('J23:P30').setNumberFormat('€#,##0.00');
  tab.getRange('R23:X30').setNumberFormat('€#,##0.00');

  // ---- Conditional formatting ----
  // Revenue Diff (X11:X18): red < -5, green > 5
  var revDiffRange = tab.getRange('X11:X18');
  var revRedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(-5)
    .setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([revDiffRange]).build();
  var revGreenRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(5)
    .setBackground('#e6f4ea').setFontColor('#188038')
    .setRanges([revDiffRange]).build();

  // In View %: MM HB+GAM (B) vs IM HB+GAM (E)
  var ivMindmaxRange = tab.getRange('B23:B30');
  var ivImRange = tab.getRange('E23:E30');
  var ivMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B23>$E23').setBackground('#e6f4ea')
    .setRanges([ivMindmaxRange]).build();
  var ivMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B23<$E23').setBackground('#fce8e6')
    .setRanges([ivMindmaxRange]).build();
  var ivImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$E23>$B23').setBackground('#e6f4ea')
    .setRanges([ivImRange]).build();
  var ivImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$E23<$B23').setBackground('#fce8e6')
    .setRanges([ivImRange]).build();

  // RPM: MM HB+GAM (J) vs IM HB+GAM (M)
  var rpmMindmaxRange = tab.getRange('J23:J30');
  var rpmImRange = tab.getRange('M23:M30');
  var rpmMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$J23>$M23').setBackground('#e6f4ea')
    .setRanges([rpmMindmaxRange]).build();
  var rpmMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$J23<$M23').setBackground('#fce8e6')
    .setRanges([rpmMindmaxRange]).build();
  var rpmImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M23>$J23').setBackground('#e6f4ea')
    .setRanges([rpmImRange]).build();
  var rpmImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$M23<$J23').setBackground('#fce8e6')
    .setRanges([rpmImRange]).build();

  // Block 2 T6: Weighted Revenue — MM HB+GAM (R) vs IM HB+GAM (U)
  var wRevMmRange = tab.getRange('R23:R30');
  var wRevImRange = tab.getRange('U23:U30');
  var wRevMmGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$R23>$U23').setBackground('#e6f4ea').setRanges([wRevMmRange]).build();
  var wRevMmRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$R23<$U23').setBackground('#fce8e6').setRanges([wRevMmRange]).build();
  var wRevImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$U23>$R23').setBackground('#e6f4ea').setRanges([wRevImRange]).build();
  var wRevImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$U23<$R23').setBackground('#fce8e6').setRanges([wRevImRange]).build();

  tab.setConditionalFormatRules([
    revRedRule, revGreenRule,
    ivMindmaxGreen, ivMindmaxRed, ivImGreen, ivImRed,
    rpmMindmaxGreen, rpmMindmaxRed, rpmImGreen, rpmImRed,
    wRevMmGreen, wRevMmRed, wRevImGreen, wRevImRed
  ]);

  // ---- Styling ----
  // Block 1 group headers
  tab.getRange('A9:G9').setBackground('#d2e3fc').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('I9:O9').setBackground('#c8e6c9').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('Q9:X9').setBackground('#ffe0b2').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 sub-headers
  tab.getRange('A10:G10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('I10:O10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('Q10:X10').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 totals
  tab.getRange('A18:G18').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('I18:O18').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('Q18:X18').setBackground('#f1f3f4').setFontWeight('bold');
  // Block 2 group headers
  tab.getRange('A21:G21').setBackground('#f3e5f5').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('I21:P21').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('Q21:X21').setBackground('#ffe0b2').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 sub-headers
  tab.getRange('A22:G22').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('I22:P22').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('Q22:X22').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 totals
  tab.getRange('A30:G30').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('I30:P30').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('Q30:X30').setBackground('#f1f3f4').setFontWeight('bold');
  // Config row 2
  tab.getRange('A2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('C2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('F2').setFontWeight('bold').setFontColor('#5f6368').setFontSize(9);
  tab.getRange('B2').setBackground('#fff8e1').setFontWeight('bold');
  tab.getRange('D2').setBackground('#fff8e1').setFontWeight('bold');
  tab.getRange('G2').setBackground('#fff8e1').setFontWeight('bold');
  // KPI section
  tab.getRange('A3:I3').setBackground('#e8f0fe').setFontWeight('bold');
  tab.getRange('A4:A7').setFontWeight('bold');
  tab.getRange('A5').setFontStyle('italic');
  tab.getRange('A1').setFontWeight('bold');
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  // Placement column bold
  tab.getRange('A11:A17').setFontWeight('bold');
  tab.getRange('I11:I17').setFontWeight('bold');
  tab.getRange('Q11:Q17').setFontWeight('bold');
  tab.getRange('A23:A29').setFontWeight('bold');
  tab.getRange('I23:I29').setFontWeight('bold');
  tab.getRange('Q23:Q29').setFontWeight('bold');

  // Column widths
  tab.setColumnWidth(1, 160);   // A: Placement
  tab.setColumnWidth(2, 85);    // B: MM HB+GAM
  tab.setColumnWidth(3, 75);    // C: MM HB
  tab.setColumnWidth(4, 75);    // D: MM GAM
  tab.setColumnWidth(5, 85);    // E: IM HB+GAM
  tab.setColumnWidth(6, 75);    // F: IM HB
  tab.setColumnWidth(7, 75);    // G: IM GAM
  tab.setColumnWidth(8, 20);    // H: gap
  tab.setColumnWidth(9, 160);   // I: Placement
  tab.setColumnWidth(10, 85);   // J: MM HB+GAM
  tab.setColumnWidth(11, 75);   // K: MM HB
  tab.setColumnWidth(12, 75);   // L: MM GAM
  tab.setColumnWidth(13, 85);   // M: IM HB+GAM
  tab.setColumnWidth(14, 75);   // N: IM HB
  tab.setColumnWidth(15, 75);   // O: IM GAM
  tab.setColumnWidth(16, 20);   // P: gap / T5 Diff
  tab.setColumnWidth(17, 160);  // Q: T3 Placement
  tab.setColumnWidth(18, 85);   // R: MM HB+GAM
  tab.setColumnWidth(19, 75);   // S: MM HB
  tab.setColumnWidth(20, 75);   // T: MM GAM
  tab.setColumnWidth(21, 85);   // U: IM HB+GAM
  tab.setColumnWidth(22, 75);   // V: IM HB
  tab.setColumnWidth(23, 75);   // W: IM GAM
  tab.setColumnWidth(24, 75);   // X: Revenue Diff

  // Clear stale content below active blocks (old Block 3/4 positions)
  tab.getRange('A31:Z65').clearContent().clearFormat();

  refreshCharts();
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
    .addItem('Refresh charts (7-day trend)', 'refreshCharts')
    .addSeparator()
    .addItem('Create daily trigger (06:00)', 'createDailyTrigger')
    .addToUi();
}
