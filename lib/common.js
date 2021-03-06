var assert = require('assert');

// These functions are wrapped so that the test code
// can override them with functions not linked to the current time.
exports.currentDate = function () {
  return new Date();
};

exports.currentTime = function () {
  return Date.now();
};

exports.setTimeout = function(fct, millis, arg1, arg2) {
  assert(typeof(fct) === 'function');
  assert(typeof(millis) === 'number');
  return setTimeout(fct, millis, arg1, arg2);
};

exports.clearTimeout = function(timeout) {
  clearTimeout(timeout);
};


// Zero-Pad a small number (like #seconds, #minutes, day-of-month, etc)
// to 2 digits.
function zp2(n)
{
  if (n >= 10)
    return n;
  return "0" + n;
}

exports.periodLength = 3600;

exports.dateToPeriodstamp = function(date)
{
  assert(date instanceof Date);
  return [
    date.getUTCFullYear(),
    zp2(date.getUTCMonth() + 1),
    zp2(date.getUTCDate()),
    '-',
    zp2(date.getUTCHours())
  ].join('');
};

exports.dateToPeriodDate = function(date)
{
  assert(date instanceof Date);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDay(),
    date.getUTCHours()
  );
};

exports.periodstampLength = 11;
exports.periodstampToDate = function(periodstamp) {
  return new Date(parseInt(periodstamp.substr(0,4)),
                  parseInt(periodstamp.substr(4,2)),
                  parseInt(periodstamp.substr(6,2)),
                  parseInt(periodstamp.substr(9,2)));
};

exports.nextPeriodstamp = function(periodstamp) {
  /// Note: tempting to optimize this for the common case when the day doesn't change.
  var periodstampTime = exports.periodstampToDate(periodstamp).getTime();
  var nextDate = new Date(periodstampTime + exports.periodLength * 1000);
  return exports.dateToPeriodstamp(nextDate);
};

exports.minutelyRotation = function() {
  exports.periodLength = 60;
  exports.periodstampLength = 13;
  exports.dateToPeriodstamp = function(date)
  {
    return [
      date.getUTCFullYear(),
      zp2(date.getUTCMonth() + 1),
      zp2(date.getUTCDate()),
      '-',
      zp2(date.getUTCHours()),
      zp2(date.getUTCMinutes())
    ].join('');
  };

  exports.dateToPeriodDate = function(date)
  {
    assert(date instanceof Date);
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDay(),
      date.getUTCHours(),
      date.getUTCMinutes()
    );
  };
  exports.periodstampLength = 13;
  exports.periodstampToDate = function(stamp) {
    return new Date(parseInt(periodstamp.substr(0,4)),
                    parseInt(periodstamp.substr(4,2)),
                    parseInt(periodstamp.substr(6,2)),
                    parseInt(periodstamp.substr(9,2)),
                    parseInt(periodstamp.substr(11,2)));
  };
};

function mkdirRecursiveSync(dir) {
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    if (e.code === 'EEXIST') {
      return;
    } else if (e.code == 'ENOENT') {
      var slash = dir.lastIndexOf('/');
      if (slash < 0)
        return;
      mkdirRecursiveSync(dir.substr(0, slash));
      fs.mkdirSync(dir);
    } else {
      throw(e);
    }
  }
};

function rmRecursiveSync(path) {
  try {
    fs.unlinkSync(path);
  } catch (e) {
    if (e.code === 'EPERM') {
      try {
        fs.rmdirSync(path);
      } catch (e2) {
        if (e2.code === 'ENOTEMPTY') {
          path.readdirSync(path).forEach(function (subpath) {
            rmRecursiveSync(path + '/' + subpath);
          });
          fs.rmdirSync(path);
        } else {
          throw e2;
        }
      }
    }
  }
};

exports.mkdirRecursiveSync = mkdirRecursiveSync;
exports.rmRecursiveSync = rmRecursiveSync;
