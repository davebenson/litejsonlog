/*
 * litejsonlog.js: Top-level include
 *
 * (C) 2013-2015 Dave Benson
 * MIT LICENCE
 *
 */


var assert = require('assert');
var fs = require('fs');
var common = require('./common');
var watch_log_dir = require('./watch-log-dir');

var categoryToWriteStream = {};
var rotationTimer = null;

var logDir = 'logs';
var watcher = null;

function ensureLogDirExists()
{
  try {
    fs.mkdirSync(logDir);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.log('error making log directory: ' + logDir);
      throw(e);
    }
  }
}

function ensureRotationTimerExists(now)
{
  if (!rotationTimer) {
    var period = common.periodLength;
    var next = (Math.floor(now / period / 1000) + 1) * period * 1000;
    rotationTimer = common.setTimeout(function() {
      for (var cat in categoryToWriteStream) {
        categoryToWriteStream[cat].end();
      }
      categoryToWriteStream = {};
      rotationTimer = null;
    }, next - now);
  }
}


function getOrCreateWriteStream(category)
{
  var now = common.currentTime();
  ensureLogDirExists();
  ensureRotationTimerExists(now);
  var rv = categoryToWriteStream[category];
  if (!rv) {
    var dir = logDir + '/' + category;
    try {
      var stat = fs.statSync(dir);
    } catch(e) {
      fs.mkdirSync(dir);
    }
    var date = new Date(now);
    var hour_string = common.dateToPeriodstamp(date);
    var filename = dir + '/' + hour_string;
    rv = fs.createWriteStream(filename, {flags:'a'});
    assert(rv);
    rv.litejsonlog_info = {
      filename: filename,
      hourstamp: hour_string,
      now: now,
      timestamp: common.dateToPeriodDate(date).getTime(),
      category: category,
    };
    categoryToWriteStream[category] = rv;
  }
  return rv;
}

// Main public endpoint.
function log(category, json)
{
  var stream = getOrCreateWriteStream(category);
  stream.write(JSON.stringify(json) + '\n', 'utf8');
}
  
// Configuration endpoints.
log.setDir = function(dir) {
  logDir = dir;
};

log.getDir = function() {
  return logDir;
};

log.stopRotation = function() {
  if (rotationTimer) {
    common.clearTimeout(rotationTimer);
    rotationTimer = null;
  }
};

log.configure = function(configInfo) {
  if (configInfo.minutely) {
    common.minutelyRotation();
  }
  if (configInfo.dir !== undefined) {
    logDir = configInfo.dir;
    try {
      fs.mkdirSync(logDir)
    } catch (err) {
      if (err.code !== 'EEXIST') {
        console.log('error making logging directory: ' + err);
	throw(err);
      }
    }
  } else {
    throw new Error('logging directory must be configured');
  }
  if (configInfo.watcher !== undefined) {
    watcher = new watch_log_dir.LogwatchWatcher(configInfo.watcher, configInfo);
  }
}

module.exports = log;
