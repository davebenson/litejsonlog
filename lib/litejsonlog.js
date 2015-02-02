/*
 * litejsonlog.js: Top-level include
 *
 * (C) 2013-2015 Dave Benson
 * MIT LICENCE
 *
 */


var assert = require('assert');
var fs = require('fs');
var post_handler = require('./post-handler');
var common = require('./common');

var categoryToWriteStream = {};
var rotationTimer = null;

var log_dir = 'logs';

function ensureLogDirExists()
{
  try {
    fs.mkdirSync(log_dir);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      console.log('error making log directory: ' + log_dir);
      throw(e);
    }
  }
}

function ensureRotationTimerExists(now)
{
  if (!rotationTimer) {
    var next = (Math.floor(now / 3600 / 1000) + 1) * 3600 * 1000;
    rotationTimer = setInterval(function() {
      for (var cat in categoryToWriteStream) {
        categoryToWriteStream[cat].end();
      }
      categoryToWriteStream = {};
      clearInterval(rotationTimer);
    }, next - now);
  }
}


function getOrCreateWriteStream(category)
{
  var now = Date.now();
  ensureLogDirExists();
  ensureRotationTimerExists(now);
  var rv = categoryToWriteStream[category];
  if (!rv) {
    var dir = log_dir + '/' + category;
    try {
      var stat = fs.statSync(dir);
    } catch(e) {
      fs.mkdirSync(dir);
    }
    var date = new Date(now);
    var hour_string = common.dateToHourstamp(date);
    var filename = dir + '/' + hour_string;
    rv = fs.createWriteStream(filename, {flags:'a'});
    assert(rv);
    rv.litejsonlog_info = {
      filename: filename,
      hour_string: hour_string,
      now: now,
      timestamp: common.dateToHourDate(date).getTime()
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
log.set_dir = function(dir) {
  log_dir = dir;
};

log.get_dir = function() {
  return log_dir;
};

log.stop_rotation = function() {
  if (rotationTimer) {
    clearTimeout(rotationTimer);
    rotationTimer = null;
  }
};

log.configure = function(configInfo) {
  if (configInfo.postHandler) {
    post_handler.configure(configInfo.postHandler);
  }
}

module.exports = log;
