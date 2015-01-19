var log = require('../lib/litejsonlog.js');
log.set_dir('test-litejsonlog');
log('foo',{bar:12});
log.stop_rotation();
