var common = require('../lib/common.js');
var assert = require('assert');


exports.initialize = function(now) {
  var currentTime = now;

  common.currentTime = function () {
    return currentTime;
  };

  common.currentDate = function () {
    return new Date(currentTime);
  }

  var sortedTimeouts = [];
  var runningTimeouts = false;


  common.setTimeout = function(fct, millis, arg1, arg2) {
    var rv = {
      fct: fct, expire: currentTime + millis, arg1: arg1, arg2:arg2
    };
    var insertIndex;
    for (insertIndex = 0;
      insertIndex < sortedTimeouts.length && sortedTimeouts[insertIndex].expire < rv.expire;
      insertIndex++) {
    }
    sortedTimeouts.splice(insertIndex, 0, rv);
    return rv;
  };

  common.clearTimeout = function(timeout) {
    var idx = sortedTimeouts.indexOf(timeout);
    if (idx < 0) {
      console.log('clearTimeout: timeout ' + timeout + ' not found');
      return;
    } else {
      if (runningTimeouts) {
        sortedTimeouts[idx] = null;
      } else {
        sortedTimeouts.splice(idx, 1);
      }
    }
  };


  exports.setTime = function (time) {
    assert(!runningTimeouts);
    currentTime = time;
    runningTimeouts = true;

    // run expired timeouts
    for (var i = 0; i < sortedTimeouts.length; i++) {
      if (sortedTimeouts[i].expire > time)
        break;
      var t = sortedTimeouts[i];
      t.fct(t.arg1, t.arg2);
      sortedTimeouts[i] = null;
    }

    // cleanup sortedTimeouts
    var st = [];
    for (var i = 0; i < sortedTimeouts.length; i++) {
      if (sortedTimeouts[i])
        st.push(sortedTimeouts[i]);
    }
    sortedTimeouts = st;

    runningTimeouts = false;
  };
};
