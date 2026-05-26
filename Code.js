var SPREADSHEET_ID = '1YqwtZsGymSMcp2wJrW_yNJZW1xdnSFwzzB1TtMqC1vI';
var LW_API_URL = 'https://api.livewrapped.com/Statistics';
var PUBLISHER_FILTER = 'Mindmax testi';
var LW_SHEET_NAME = 'LW';
var HEADERS = [
  'Date', 'Source', 'Publisher', 'Site', 'Placement',
  'Available Impressions', 'Viewable Impressions',
  'Sold Impressions', 'Revenue', 'In View %'
];
var NUM_COLS = 10;

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

function testDateUtils() {
  Logger.log('Today: ' + formatDate(new Date()));
  Logger.log('Yesterday: ' + daysAgo(1));
  Logger.log('7 days ago: ' + daysAgo(7));
}

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
