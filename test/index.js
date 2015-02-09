var log = require('../lib/litejsonlog.js');
var fake_time = require('../lib/fake-time');
log.configure({
  dir: 'test-litejsonlog',
  watcher: {
    uploadFunction: function (uploadInfo, cb) {
      console.log("uploadFunction run: " + uploadInfo);
      cb(null);
    }
  }
});
var t = 404567890 * 3600 * 1000;                // some random hour boundary
fake_time.initialize(t);
log('foo',{bar:12});
t += 2 * 3600 * 1000;
fake_time.setTime(t);
log.stop_rotation();
