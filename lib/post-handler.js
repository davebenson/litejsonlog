var fs = require('fs');
var common = require('./common');

var ts_bycat_pairs = [];    // sorted ascending

function getTSPairTimestampIndex(ts)
{
  for (var i = 0; i < ts_bycat_pairs.length; i++) {
    if (ts_bycat_pairs[i][0] === ts)
      return i;
  }
  return -1;
}

function forceByCategoryFromTimestamp(ts)
{
  var tsPairIndex = getTSPairTimestampIndex(ts);
  if (tsIndex >= 0)
    return ts_bycat_pairs[tsIndex][1];

  ts_bycat_pairs.push(ts);
  var rv = {};
  ts_bycat_pairs.push(rv);

  // Sort if necessary (should be unusual, since time occurs in an
  // ascending fashion...)
  if (ts_bycat_pairs.length > 1
   && ts_bycat_pairs[ts_bycat_pairs.length-2][0] > ts) {
    // out-of-order logging???  just do a full array sort.
    ts_bycat_pairs.sort(function(a, b) { return a[0] - b[0]; });
  }

  return rv;
}

var scoreboardFilename;

var writingScoreboard = false;
var changedWhileWriting = false;
function writeScoreboard() {
  if (writingScoreboard) {
    changedWhileWriting = true;
    return;
  }
  writingScoreboard = true;
  fs.writeFile(
    scoreboardFilename,
    JSON.stringify(ts_bycat_pairs),
    function (err) {
      writingScoreboard = false;
      if (err) {
        console.log("error writing log metastatus: " + err);
      } 
      if (changedWhileWriting) {
        changedWhileWriting = false;
        writeScoreboard();
      }
    }
  );
}

exports.configure = function (postHandlerConfig) {
  var phConfig = postHandlerConfig;
  if (typeof(phConfig) === 'function') {
    phConfig = {
      postHandler: phConfig
    };
  }

  scoreboardFilename = phConfig.scoreboardFilename;

  // Load state or create state.
  var statusJson = [];
  if (scoreboardFilename) {
    try {
      var statusString = fs.readFileSync(scoreboardFilename, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') {
        console.log('log scoreboard file did not exist: assuming new instance');
      } else {
        console.log('error reading log-upload scoreboard file ' + scoreboardFilename + ': ' + e);
        throw(e);
      }
    }
    if (statusString) {
      statusJson = JSON.parse(statusString);
      if (!Array.isArray(statusJson)) {
        throw new Error('type mismatch: expected array for log status JSON');
      }
    }
  } else {
    console.log('warning: doing log upload without scoreboard file');
  }
};

var hasTimeout = false;

exports.noteLogFileCreated = function(log_info) {
  var by_category = forceByCategoryFromTimestamp(log_info.timestamp);
  if (by_category === undefined) {
    by_category = {};
    pending_logs_by_timestamp[log_info.hour_time] = by_category;
  }
  var cat_info = by_category[log_info.category];
  if (cat_info === undefined) {
    cat_info = {};
    by_category[log_info.category] = cat_info;
  }
  writeScoreboard();

  if (!hasTimeout) {
    var scanTimeoutFunc = function() {
      hasTimeout = false;
      exports.scanForUploads();
      if (ts_bycat_pairs.length > 0) {
        var readyTime = ts_bycat_pairs[0][0] + DELAY_MILLIS;
        var delta = readyTime - Date.now();
        if (delta > 0) {
          setTimeout(delta, scanTimeoutFunc);
        }
      }
    };
    hasTimeout = true;
    setTimeout(DELAY_MILLIS, scanTimeoutFunc);
  }
}

function getUploadable(max, filter) {
  var cutoff = Date.now() - DELAY_MINUTES*60*1000;
  var rv = [];
  for (var i = 0; i < ts_bycat_pairs.length && ts_bycat_pairs[i][0] < cutoff; i++) {
    var ts = ts_bycat_pairs[i][0];
    var by_cat = ts_bycat_pairs[i][1];
    for (var cat in by_cat) {
      var info = by_cat[cat];
      if (filter(ts, cat, info)) {
        rv.push({timestamp: ts, category: cat, info: info});
        if (rv.length >= max)
          return rv;
      }
    }
  }
  return rv;
}

function scanForUploads_nonreentrant()
{
  var m = maxConcurrent - nRunning;
  if (m <= 0)
    return false;
  var lfis = getLogFileInfos(m, function(ts, cat, info) {
    if (info.status === 'running')
      return false;
    if (info.status === 'failed') {
      // probably need retry policy etc
      return false;
    }
    return true;
  });
  if (lfis.length === 0)
    return false;
  lfis.forEach(function(logFileInfo) {
    logFileInfo.info.status = 'running';
    uploadHandler(logFileInfo, function (err) {
      if (err) {
        var info = logFileInfo.info;
        info.status = 'failed';
        info.lastError = err.toString();
        info.lastErrorTime = Date.now();
      } else {
        var tsPairIndex = getTSPairTimestampIndex(logFileInfo.timestamp);
        var byCat = ts_bycat_pairs[tsPairIndex][1];
        delete byCat[logFileInfo.category];
        if (isObjectEmpty(byCat)) {
          ts_bycat_pairs.splice(tsPairIndex, 1);
        }
      }
      nRunning--;
      exports.scanForUploads();
      writeScoreboard();
    });
  });
  return true;
}

var scanningForUploads = false;

exports.scanForUploads = function() {
  if (scanForUploads)
    return;
  scanForUploads = true;

  // Loop, until done (looping is required since we block the callbacks
  // which occur while scanForUploads is set).
  while (scanForUploads_nonreentrant()) { }

  scanForUploads = true;
}
