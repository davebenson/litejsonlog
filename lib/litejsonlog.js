/*
 * litejsonlog.js: Top-level include
 *
 * (C) 2013-2015 Dave Benson
 * MIT LICENCE
 *
 */


var assert = require('assert');
var fs = require('fs');

var category_to_write_stream = {};
var rotate_timer = null;

function zp2(n)
{
  if (n >= 10)
    return n;
  return "0" + n;
}

function date_to_hour_resolution_string(date)
{
  return [
    date.getUTCFullYear(),
    zp2(date.getUTCMonth() + 1),
    zp2(date.getUTCDate()),
    '-',
    zp2(date.getUTCHours())
  ].join('');
}

var log_dir = "logs";

function ensure_logdir_exists()
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
function ensure_rotation_timer_exists(now)
{
  if (!rotate_timer) {
    var next = (Math.floor(now / 3600 / 1000) + 1) * 3600 * 1000;
    rotate_timer = setInterval(function() {
      for (var cat in category_to_write_stream) {
        category_to_write_stream[cat].end();
      }
      category_to_write_stream = {};
      clearInterval(rotate_timer);
    }, next - now);
  }
}

function get_or_create_write_stream(category)
{
  var now = Date.now();
  ensure_logdir_exists();
  ensure_rotation_timer_exists(now);
  var rv = category_to_write_stream[category];
  if (!rv) {
    var dir = log_dir + "/" + category;
    try {
      var stat = fs.statSync(dir);
    } catch(e) {
      fs.mkdirSync(dir);
    }
    var date = new Date(now);
    var filename = dir + "/" + date_to_hour_resolution_string(date);
    rv = fs.createWriteStream(filename, {flags:"a"});
    assert(rv);
    category_to_write_stream[category] = rv;
  }
  return rv;
}

// Main public endpoint.
function log(category, json)
{
  var stream = get_or_create_write_stream(category);
  stream.write(JSON.stringify(json) + "\n", "utf8");
}
  
// Configuration endpoints.
log.set_dir = function(dir) {
  log_dir = dir;
};

log.get_dir = function() {
  return log_dir;
};

log.stop_rotation = function() {
  if (rotate_timer) {
    clearTimeout(rotate_timer);
    rotate_timer = null;
  }
};

module.exports = log;
