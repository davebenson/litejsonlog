var common = require('./common');
var EventEmitter = require('events').EventEmitter;

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
    var f = config.logDir + '/' + dirName + '/' + periodstamp;
    if (fs.exist(f + '.gz'))
      comp.push(dirName);
    else if (fs.exist(f))
      uncomp.push(dirName);
  });
}
util.inherit(ScanInfo, EventEmitter);

ScanInfo.prototype._maybeDone = function () {
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
ScanInfo.prototype._startNextCompression = function() {
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

ScanInfo.prototype._startNextUpload = function() {
  this.nUploadRunning += 1;
  var category = this.comp[this.compAt++];
  var filename = this.logDir + '/' + category + '/' + this.periodstamp + '.gz';
  this.uploadFunction({
    category: category,
    periodstamp: this.periodstamp,
    filename: filename,
    extension: '.gz'
  }, function (err) {
    scan.nUploadRunning -= 1;
    if (err) {
      ...
    } else {
      ...
    }
    while (scan.nUploadRunning < scan.maxUpload && scan.compAt < scan.comp.length) {
      scan._startNextUpload();
    }
    if (scan.compAt === scan.comp.length && scan.uncompAt === scan.uncomp.length) {
      scan.markDone();
    }
  });
};

ScanInfo.prototype.start = function () {
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

var LogwatchWatcher = function (options) {
  this.logDir = options.logDir;
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

LogwatchWatcher.prototype._start = function () {
  var lw = this;
  var fname = this.logDir + this.lastScanFilename;
  fs.readFileSync(
    fname,
    {encoding: 'utf8'},
    function (err, contents) {
      var periodstamp;
      if (err) {
        if (err.code === 'ENOENT') {
          periodstamp = scanForEarliestPeriodstamp(lw.logDir);
          if (periodstamp === undefined) {
            periodstamp = common.dateToPeriodstamp(new Date());
          }
        } else {
          console.log('reading ' + fname + ' failed: ' + err);
          throw err;
        }
      } else {
        periodstamp = contents.trim();
      }
    }
  );
};

exports.LogwatchWatcher = LogwatchWatcher;
