var SPREADSHEET_ID = '1YqwtZsGymSMcp2wJrW_yNJZW1xdnSFwzzB1TtMqC1vI';
var LW_API_URL = 'https://api.livewrapped.com/Statistics';
var LW_INVENTORY_URL = 'https://api.livewrapped.com/StatsInventory';
var LW_PUBLISHER_ID = 'ac8a0bef-d0d0-459f-a991-a21630b91dee';
var PUBLISHER_NAME = 'Mindmax testi';
var LW_SHEET_NAME = 'LW';
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
    return UrlFetchApp.fetch(LW_INVENTORY_URL + '/publisher/' + LW_PUBLISHER_ID + '/site', {
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

function fetchDayStats(date, siteNames, adUnitNames) {
  var payload = JSON.stringify({
    from: date,
    to: date,
    aggregationLevel: 2,
    publisherIds: [LW_PUBLISHER_ID],
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
  var rows = [];

  for (var i = 0; i < stats.length; i++) {
    var s = stats[i];
    var dateStr = Utilities.formatDate(new Date(s.from), 'Europe/Helsinki', 'yyyy-MM-dd');
    var siteName = (siteNames[s.siteId]) ? siteNames[s.siteId] : s.siteId;
    var placement = (adUnitNames[s.adUnitId]) ? adUnitNames[s.adUnitId] : s.adUnitId;
    var avail = (s.request && s.request.adUnitRequests) ? Number(s.request.adUnitRequests) : 0;
    var viewable = (s.request && s.request.adUnitViewableRequests) ? Number(s.request.adUnitViewableRequests) : 0;
    var sold = (s.response && s.response.soldImpressions) ? Number(s.response.soldImpressions) : 0;
    var revenue = (s.response && s.response.netRevenue && s.response.netRevenue.amountInPublisherCurrency != null)
      ? Number(s.response.netRevenue.amountInPublisherCurrency) : 0;
    var inViewPct = (s.response && s.response.percentageInView != null)
      ? Number(s.response.percentageInView) / 100 : 0;

    rows.push([dateStr, 'LiveWrapped', PUBLISHER_NAME, siteName, placement,
               avail, viewable, sold, revenue, inViewPct]);
  }

  return rows;
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

function refreshData() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LW_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + LW_SHEET_NAME + '" not found.');
  var siteNames = lwGetSiteNameMap();
  var adUnitNames = lwGetAdUnitNameMap(Object.keys(siteNames));
  for (var i = 1; i <= 3; i++) {
    var rows = fetchDayStats(daysAgo(i), siteNames, adUnitNames);
    upsertRows(sheet, rows);
  }
}

function initialLoad() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(LW_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + LW_SHEET_NAME + '" not found.');
  var siteNames = lwGetSiteNameMap();
  var adUnitNames = lwGetAdUnitNameMap(Object.keys(siteNames));
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Telsu seuranta')
    .addItem('Refresh last 3 days', 'refreshData')
    .addItem('Initial load (7 days)', 'initialLoad')
    .addSeparator()
    .addItem('Create daily trigger (06:00)', 'createDailyTrigger')
    .addToUi();
}

function testFetchDayStats() {
  var date = daysAgo(2);
  Logger.log('Fetching for: ' + date);
  var siteNames = lwGetSiteNameMap();
  var adUnitNames = lwGetAdUnitNameMap(Object.keys(siteNames));
  var rows = fetchDayStats(date, siteNames, adUnitNames);
  Logger.log('Rows returned: ' + rows.length);
  if (rows.length > 0) {
    Logger.log('First row: ' + JSON.stringify(rows[0]));
    Logger.log('Last row: ' + JSON.stringify(rows[rows.length - 1]));
  }
}
