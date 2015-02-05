var http = require('http');
var litejsonlog = require('../lib/litejsonlog');
var url = require('url');
var OptionParser = require('daveb-option-parser').OptionParser;

var option_parser = new OptionParser();
option_parser.addInt('port', 'HTTP port').setMandatory();
option_parser.addString('log-dir', 'Log Directory').setDefaultValue('examples/logs');
option_parser.addString('scoreboard', 'Log Scoreboard File').setDefaultValue('examples/scoreboard');
option_parser.addString('upload-script', 'Upload script').setDefaultValue('examples/example-upload-script.sh');
option_parser.addFlag('minutely', 'Use per-minute log rotation');
var options = option_parser.parse();

litejsonlog.configure({
  dir: options.logDir,
  minutely: options.minutely,
  postHandler: {
    scoreboardFilename: options.scoreboard,
    uploadScript: options.uploadScript,
  }
});

var server = http.createServer(function(req,res) {
  res.sendJSON = function(statusCode, json) {
    res.statusCode = statusCode;
    res.end(JSON.stringify(json));
  };
  if (req.method !== 'POST') {
    res.sendJSON(405, {error:'must be POST', description:'non-POST request'});
    return;
  }
  var reqUrl = url.parse(req.url);
  var path = reqUrl.pathname;
  if (!/^\/([a-zA-Z0-9_][a-zA-Z0-9_\-,.]*)$/.test(path)) {
    res.sendJSON(404, {error:'path must be a category name',
      description:'categories must start with an alphanumeric and subsequent characters may include -_,.'});
    return;
  }
  var buffers = [];

  function handleDataEnded() {
    try {
    var json = JSON.parse(Buffer.concat(buffers).toString());
    } catch (e) {
      res.sendJSON(400, {error:'post data not JSON',
                         description:'error parsing post data: ' + e});
      return;
    }
    litejsonlog(path.substr(1), json);
    res.sendJSON(200, {});
  }

  req.on('data', function(data) { buffers.push(data); })
     .on('end', handleDataEnded);
});

console.log("listening on port " + options.port);
server.listen(options.port, function(err) {
  console.log("listen done: " + err);
});
