var common = require('./common');
var util = require('util');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var assert = require('assert');

var scanTimeout = null;                         // returned from setTimeout()
var nextTimeToScan = undefined;                 // unixtime, in seconds

var nodeProgramName = 'node';
var config_uploadScriptName = null;
var config_uploadScriptArgs = [];
var config_logSuffix = null;

var ignoreCategories = {
  LAST_SCANNED: true
};

function LogwatchScan(watcher, scanTime) {
  var dirs = fs.readdirSync(watcher.logDir);
  var periodstamp = common.dateToPeriodstamp(new Date(scanTime));

  this.periodstamp = periodstamp;

  // Find compressed logs and uncompressed logs.
  this.uncomp = [];
  this.uncompAt = 0;
  this.comp = [];
  this.compAt = 0;
  this.maxComp = 1;
  this.nCompRunning = 0;
  this.maxUpload = 1;
  this.nUploadRunning = 0;
  this.done = false;
  this.uploadFunction = watcher.uploadFunction;
  dirs.forEach(function (dirName) {
    if (dirName === watcher.lastScanFilename)
      return;
    var f = watcher.logDir + '/' + dirName + '/' + periodstamp;
    if (fs.existsSync(f + '.gz'))
      comp.push(dirName);
    else if (fs.existsSync(f))
      uncomp.push(dirName);
  });
}
util.inherits(LogwatchScan, EventEmitter);

LogwatchScan.prototype._maybeDone = function () {
  var scan = this;
  assert(!this.done);
  if (this.compAt === this.comp.length &&
      this.uncompAt === this.uncomp.length &&
      this.nCompRunning === 0 &&
      this.nUploadRunning === 0) {
    fs.writeFile(this.logDir + '/LAST_SCANNED', this.periodstamp, function (err) {
      if (err) {
        console.log('writing LAST_SCANNED file: ' + err);
        throw err;
      }
      scan.emit('done');
    });
  }
};
LogwatchScan.prototype._startNextCompression = function() {
  var scan = this;
  this.compRunning += 1;
  var category = this.uncomp[this.uncompAt++];
  var filename = this.logDir + '/' + category + '/' + this.periodstamp;
  var args = [ '-7', filename ];
  var execOptions = { };

  child_process.execFile('gzip', args, execOptions,
    function (error, stdout, stderr) {
      scan.compRunning -= 1;
      if (error) {
        scan.emit('error', new Error('error compressing ' + filename + ': ' + error));
      } else {
        scan.comp.push(category);
        if (scan.uploadRunning < scan.maxUpload) {
          scan._startNextUpload();
        }
        while (scan.nUploadRunning < scan.maxUpload && scan.compAt < scan.comp.length) {
          scan._startNextUpload();
        }
        scan._maybeDone();
      }
    }
  );
};

function doUpload(lwScan, category)
{
  var filename = lwScan.logDir + '/' + category + '/' + lwScan.periodstamp + '.gz';
  lwScan.uploadFunction({
    category: category,
    periodstamp: lwScan.periodstamp,
    filename: filename,
    extension: '.gz'
  }, function (err) {
    scan.nUploadRunning -= 1;
    if (err) {
      if (err.retryable) {
        var retryTimeout = 5000;
        common.setTimeout(doUpload, retryTimeout, lwScan, category);
      } else {
        console.log('failed uploading: category=' + category + '; err=' + err);
      }
    } else {
      // TODO: keep stats
    }
    while (scan.nUploadRunning < scan.maxUpload && scan.compAt < scan.comp.length) {
      scan._startNextUpload();
    }
    if (scan.compAt === scan.comp.length && scan.uncompAt === scan.uncomp.length) {
      scan._markDone();
    }
  });
}

LogwatchScan.prototype._startNextUpload = function() {
  this.nUploadRunning += 1;
  var category = this.comp[this.compAt++];
  doUpload(this, category);
};

LogwatchScan.prototype.start = function () {
  if (this.uncomp.length === 0 && this.comp.length === 0) {
    this._markDone();
    return;
  }

  while (this.nCompRunning < this.maxComp && this.uncompAt < this.uncomp.length) {
    this._startNextCompression();
  }

  while (this.nUploadRunning < this.maxUpload && this.compAt < this.comp.length) {
    this._startNextUpload();
  }
};

LogwatchScan.prototype._markDone = function () {
  this.emit('done');
};

function LogwatchWatcher(options, logOptions) {
  this.logDir = logOptions.dir;
  assert(typeof(this.logDir) === 'string');
  this.lastScanFilename = options.lastScanFilename || 'LAST_SCAN';

  if (options.uploadScript) {
    var uploadScript = options.uploadScript;
    this.uploadFunction = function (uploadInfo, callback) {
      var execArgs = [ ];
      var execOptions = {
        env: {
          LOGWATCH_INPUT_FILENAME: uploadInfo.filename,
          LOGWATCH_CATEGORY: uploadInfo.category,
          LOGWATCH_PERIODSTAMP: uploadInfo.periodstamp,
        }
      };
      child_process.execFile(options.uploadScript, execArgs, execOptions,
        function (error, stdout, stderr) {
          if (stderr !== '') {
            console.log('upload script printed: ' + stderr);
          }
          callback(error);
        }
      );
    };
  } else if (options.uploadFunction) {
    this.uploadFunction = options.uploadFunction;
  } else {
    throw new Error('no upload mechanism');
  }

  this._start();
};

function scanForEarliestPeriodstamp(logDir) {
  var categories = fs.readdirSync(logDir);
  var earliest = undefined;
  categories.forEach(function (category) {
    var files = [];
    try {
      files = fs.readdirSync(logDir + '/' + category);
    } catch (e) {
    }
    files.forEach(function (file) {
      if (file.length > 3) {
        var g = file.substr(file.length - 3);
        if (g === '.gz')
          file = file = substr(0, file.length - 3);
      }
      if (file.length === common.periodstampLength && common.isPeriodstamp(file)) {
        if (earliest === undefined || earliest > file)
          earliest = file;
      }
    });
  });
  return earliest;
}

LogwatchWatcher.prototype._start = function (optionalPeriodstamp) {
  var lw = this;
  var fname = this.logDir + '/' + this.lastScanFilename;
  var periodstamp = optionalPeriodstamp;
  if (periodstamp === undefined) {
    try {
      var contents = fs.readFileSync(
        fname,
        {encoding: 'utf8'}
      );
      periodstamp = contents.trim();
      periodstamp = common.nextPeriodstamp(periodstamp);
    } catch (err) {
      if (err.code === 'ENOENT') {
        periodstamp = scanForEarliestPeriodstamp(lw.logDir);
        if (periodstamp === undefined) {
          periodstamp = common.dateToPeriodstamp(common.currentDate());
        }
      } else {
        console.log('reading ' + fname + ' failed: ' + err);
        throw err;
      }
    }
  }

  var periodstampTime = common.periodstampToDate(periodstamp).getTime();
  var extraSecs = common.periodLength + (this.fudgeSeconds || 120);
  var collectTime = periodstampTime + extraSecs * 1000;
  var delta = collectTime - common.currentTime();
  if (delta < 0)
    delta = 0;
  common.setTimeout(function () {
    var scan = new LogwatchScan(lw, periodstampTime);
    scan.on('done', function () {
      fs.writeFileSync(fname, periodstamp);
      lw._handleScanDone(scan);
    }).start();
  }, delta);
};

LogwatchWatcher.prototype._handleScanDone = function (scan) {
  var nextP = common.nextPeriodstamp(scan.periodstamp);
  this._start(nextP);
};

exports.LogwatchWatcher = LogwatchWatcher;
