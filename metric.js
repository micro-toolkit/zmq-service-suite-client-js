var _ = require('lodash');
var moment = require('moment');
var Logger = require('logger-facade-nodejs');
var log = Logger.getLogger('micro.metric.client');

// TODO: Add proper test to ensure the format of the metric, mocking logger was giving troubles
function metric(name, ts, message) {
  var metadata = _.pick(message, ['type', 'rid', 'address', 'status', 'client', 'clientId', 'transaction']);
  metadata['micrometric'] = { name: name, value: ts }
  log.info(metadata, 'Publishing metric "%s":%sms', name, ts);
  return metadata;
}

function start(message) {
  var now = moment().valueOf();
  // add the micro client send timestamp
  message.headers = _.defaults(message.headers, {'micro.cs': now});
  metric('micro.cs', now, message);
  return message;
}

function end(message) {
  var now = moment().valueOf();

  // add the micro client receive timestamp
  message.headers = _.defaults(message.headers, {'micro.cr': now});
  metric('micro.cr', now, message);

  var cs = message.headers['micro.cs'];
  metric('micro.c.span', now - cs, message);

  var bfes = message.headers['micro.bfes'];
  metric('micro.bc.span', now - bfes, message);

  return message;
}

module.exports = {start: start, end: end};
