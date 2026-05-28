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
var OWN_GAM_REPORT_SUBJECT = 'Report: Päivämyynti Telsu.fi';
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

function parseOwnGamCsv(csvText) {
  var lines = csvText.split('\n');
  var date = null;
  var publisher = '';
  var dataHeaderIdx = -1;
  var hasFullData = false;

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
      // New format includes ad requests, impressions, in-view %
      hasFullData = line.indexOf('Total ad requests') !== -1;
      break;
    }
  }

  if (!date || dataHeaderIdx === -1) return [];

  // Columns (new format): placement, revenue, avail, sold, fill_rate, inViewPct, eCPM
  var rowMap = {};
  for (var j = dataHeaderIdx + 1; j < lines.length; j++) {
    var dataLine = lines[j].replace('\r', '').trim();
    if (!dataLine) continue;
    var cols = dataLine.split(',');
    if (cols.length < 2) continue;

    var rawName = cols[0].trim();
    var revenue = parseFloat(cols[1]) || 0;
    var avail    = hasFullData ? (parseInt(cols[2], 10) || 0) : 0;
    var sold     = hasFullData ? (parseInt(cols[3], 10) || 0) : 0;
    var inViewPct = hasFullData ? (parseFloat(cols[5]) || 0) : 0;
    var viewable = Math.round(sold * inViewPct);

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
                     avail, viewable, sold, revenue, inViewPct];
    }
  }

  var rows = [];
  for (var k in rowMap) {
    var r = rowMap[k];
    r[9] = (r[7] > 0) ? r[6] / r[7] : 0; // recalculate In View % after aggregation
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

  // Rows 3-6: KPI summary — Mindmax first, then IM columns
  tab.getRange('A3:G3').setValues([['', 'Mindmax GAM', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff', 'Diff %']]);
  tab.getRange('A4').setValue('Revenue (€)');
  tab.getRange('B4').setFormula('=SUMIFS(Google!I:I,Google!A:A,$B$1)');
  tab.getRange('C4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('D4').setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1)');
  tab.getRange('E4').setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('F4').setFormula('=B4-C4');
  tab.getRange('G4').setFormula('=IFERROR(F4/C4,"")');
  tab.getRange('A5').setValue('Sold Impressions');
  tab.getRange('B5').setFormula('=SUMIFS(Google!H:H,Google!A:A,$B$1)');
  tab.getRange('C5').setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('D5').setFormula('=SUMIFS(LW!H:H,LW!A:A,$B$1)');
  tab.getRange('E5').setFormula('=SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)');
  tab.getRange('F5').setFormula('=B5-C5');
  tab.getRange('G5').setFormula('=IFERROR(F5/C5,"")');
  tab.getRange('A6').setValue('Avg In View %');
  tab.getRange('B6').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C6').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('D6').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('E6').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('F6').setFormula('=B6-C6');

  // ---- BLOCK 1 (rows 8-17): Available Impr | Sold Impr | Revenue ----
  // T1 = A-E, gap = F (col 6), T2 = G-K (cols 7-11), empty L (col 12), T3 = M-R (cols 13-18)

  tab.getRange('A8:E8').mergeAcross().setValue('Available Impressions');
  tab.getRange('G8:K8').mergeAcross().setValue('Sold Impressions');
  tab.getRange('M8:R8').mergeAcross().setValue('Revenue');

  tab.getRange('A9').setValue('Placement');
  tab.getRange('B9:E9').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('G9').setValue('Placement');
  tab.getRange('H9:K9').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('M9').setValue('Placement');
  tab.getRange('N9:R9').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i = 0; i < placements.length; i++) {
    var row = 10 + i;
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
    tab.getRange(row, 15).setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,M'+r+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,M'+r+')');
    tab.getRange(row, 16).setFormula('=SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,M'+r+')');
    tab.getRange(row, 17).setFormula('=SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,M'+r+')');
    tab.getRange(row, 18).setFormula('=N'+r+'-O'+r);
  }

  tab.getRange('A17').setValue('TOTAL');
  tab.getRange('B17').setFormula('=SUM(B10:B16)');
  tab.getRange('C17').setFormula('=SUM(C10:C16)');
  tab.getRange('D17').setFormula('=SUM(D10:D16)');
  tab.getRange('E17').setFormula('=SUM(E10:E16)');
  tab.getRange('G17').setValue('TOTAL');
  tab.getRange('H17').setFormula('=SUM(H10:H16)');
  tab.getRange('I17').setFormula('=SUM(I10:I16)');
  tab.getRange('J17').setFormula('=SUM(J10:J16)');
  tab.getRange('K17').setFormula('=SUM(K10:K16)');
  tab.getRange('M17').setValue('TOTAL');
  tab.getRange('N17').setFormula('=SUM(N10:N16)');
  tab.getRange('O17').setFormula('=SUM(O10:O16)');
  tab.getRange('P17').setFormula('=SUM(P10:P16)');
  tab.getRange('Q17').setFormula('=SUM(Q10:Q16)');
  tab.getRange('R17').setFormula('=N17-O17');

  // ---- BLOCK 2 (rows 20-29): In View % | RPM  (rows 18-19 = spacer) ----
  // T4 = A-E, gap = F, T5 = G-L (cols 7-12)

  tab.getRange('A20:E20').mergeAcross().setValue('In View %');
  tab.getRange('G20:L20').mergeAcross().setValue('RPM (€ per 1k avail)');

  tab.getRange('A21').setValue('Placement');
  tab.getRange('B21:E21').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM']]);
  tab.getRange('G21').setValue('Placement');
  tab.getRange('H21:L21').setValues([['Mindmax', 'IM HB+GAM', 'IM HB', 'IM GAM', 'Diff']]);

  for (var i2 = 0; i2 < placements.length; i2++) {
    var row2 = 22 + i2;
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
    tab.getRange(row2, 9).setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,G'+r2+')+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+'))/(SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,G'+r2+')+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+'))*1000,0)');
    tab.getRange(row2, 10).setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1,LW!E:E,G'+r2+')/SUMIFS(LW!F:F,LW!A:A,$B$1,LW!E:E,G'+r2+')*1000,0)');
    tab.getRange(row2, 11).setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+')/SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1,\'Own GAM\'!E:E,G'+r2+')*1000,0)');
    tab.getRange(row2, 12).setFormula('=H'+r2+'-I'+r2);
  }

  tab.getRange('A29').setValue('TOTAL');
  tab.getRange('B29').setFormula('=IFERROR(SUMIFS(Google!G:G,Google!A:A,$B$1)/SUMIFS(Google!H:H,Google!A:A,$B$1),0)');
  tab.getRange('C29').setFormula('=IFERROR((SUMIFS(LW!G:G,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!H:H,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1)),0)');
  tab.getRange('D29').setFormula('=IFERROR(SUMIFS(LW!G:G,LW!A:A,$B$1)/SUMIFS(LW!H:H,LW!A:A,$B$1),0)');
  tab.getRange('E29').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!G:G,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!H:H,\'Own GAM\'!A:A,$B$1),0)');
  tab.getRange('G29').setValue('TOTAL');
  tab.getRange('H29').setFormula('=IFERROR(SUMIFS(Google!I:I,Google!A:A,$B$1)/SUMIFS(Google!F:F,Google!A:A,$B$1)*1000,0)');
  tab.getRange('I29').setFormula('=IFERROR((SUMIFS(LW!I:I,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1))/(SUMIFS(LW!F:F,LW!A:A,$B$1)+SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1))*1000,0)');
  tab.getRange('J29').setFormula('=IFERROR(SUMIFS(LW!I:I,LW!A:A,$B$1)/SUMIFS(LW!F:F,LW!A:A,$B$1)*1000,0)');
  tab.getRange('K29').setFormula('=IFERROR(SUMIFS(\'Own GAM\'!I:I,\'Own GAM\'!A:A,$B$1)/SUMIFS(\'Own GAM\'!F:F,\'Own GAM\'!A:A,$B$1)*1000,0)');
  tab.getRange('L29').setFormula('=H29-I29');

  // ---- Number formats ----
  tab.getRange('B1').setNumberFormat('yyyy-mm-dd');
  tab.getRange('B4:F4').setNumberFormat('€#,##0.00');
  tab.getRange('G4').setNumberFormat('0.0%');
  tab.getRange('B5:F5').setNumberFormat('#,##0');
  tab.getRange('G5').setNumberFormat('0.0%');
  tab.getRange('B6:F6').setNumberFormat('0.0%');
  tab.getRange('B10:E17').setNumberFormat('#,##0');
  tab.getRange('H10:K17').setNumberFormat('#,##0');
  tab.getRange('N10:R17').setNumberFormat('€#,##0.00');
  tab.getRange('B22:E29').setNumberFormat('0.0%');
  tab.getRange('H22:L29').setNumberFormat('€#,##0.00');

  // ---- Conditional formatting ----
  // Revenue Diff (R10:R17): red < -5, green > 5
  var revDiffRange = tab.getRange('R10:R17');
  var revRedRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(-5)
    .setBackground('#fce8e6').setFontColor('#d93025')
    .setRanges([revDiffRange]).build();
  var revGreenRule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(5)
    .setBackground('#e6f4ea').setFontColor('#188038')
    .setRanges([revDiffRange]).build();

  // In View %: per-row comparison Mindmax (B) vs IM HB+GAM (C)
  var ivMindmaxRange = tab.getRange('B22:B29');
  var ivImRange = tab.getRange('C22:C29');
  var ivMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B22>$C22').setBackground('#e6f4ea')
    .setRanges([ivMindmaxRange]).build();
  var ivMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B22<$C22').setBackground('#fce8e6')
    .setRanges([ivMindmaxRange]).build();
  var ivImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C22>$B22').setBackground('#e6f4ea')
    .setRanges([ivImRange]).build();
  var ivImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C22<$B22').setBackground('#fce8e6')
    .setRanges([ivImRange]).build();

  // RPM: per-row comparison Mindmax (H) vs IM HB+GAM (I)
  var rpmMindmaxRange = tab.getRange('H22:H29');
  var rpmImRange = tab.getRange('I22:I29');
  var rpmMindmaxGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H22>$I22').setBackground('#e6f4ea')
    .setRanges([rpmMindmaxRange]).build();
  var rpmMindmaxRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$H22<$I22').setBackground('#fce8e6')
    .setRanges([rpmMindmaxRange]).build();
  var rpmImGreen = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I22>$H22').setBackground('#e6f4ea')
    .setRanges([rpmImRange]).build();
  var rpmImRed = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I22<$H22').setBackground('#fce8e6')
    .setRanges([rpmImRange]).build();

  tab.setConditionalFormatRules([
    revRedRule, revGreenRule,
    ivMindmaxGreen, ivMindmaxRed, ivImGreen, ivImRed,
    rpmMindmaxGreen, rpmMindmaxRed, rpmImGreen, rpmImRed
  ]);

  // ---- Styling ----
  // Block 1 group headers
  tab.getRange('A8:E8').setBackground('#d2e3fc').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G8:K8').setBackground('#c8e6c9').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('M8:R8').setBackground('#ffe0b2').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 sub-headers
  tab.getRange('A9:E9').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G9:K9').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('M9:R9').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 1 totals
  tab.getRange('A17:E17').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('G17:K17').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('M17:R17').setBackground('#f1f3f4').setFontWeight('bold');
  // Block 2 group headers
  tab.getRange('A20:E20').setBackground('#f3e5f5').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G20:L20').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 sub-headers
  tab.getRange('A21:E21').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  tab.getRange('G21:L21').setBackground('#f1f3f4').setFontWeight('bold').setHorizontalAlignment('center');
  // Block 2 totals
  tab.getRange('A29:E29').setBackground('#f1f3f4').setFontWeight('bold');
  tab.getRange('G29:L29').setBackground('#f1f3f4').setFontWeight('bold');
  // KPI section
  tab.getRange('A3:G3').setBackground('#e8f0fe').setFontWeight('bold');
  tab.getRange('A4:A6').setFontWeight('bold');
  tab.getRange('A1').setFontWeight('bold');
  tab.getRange('B1').setFontWeight('bold').setFontSize(12);
  // Placement column bold
  tab.getRange('A10:A16').setFontWeight('bold');
  tab.getRange('G10:G16').setFontWeight('bold');
  tab.getRange('M10:M16').setFontWeight('bold');
  tab.getRange('A22:A28').setFontWeight('bold');
  tab.getRange('G22:G28').setFontWeight('bold');

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
