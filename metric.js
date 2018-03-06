var _ = require('lodash');
var moment = require('moment');
var Logger = require('logger-facade-nodejs');
var log = Logger.getLogger('micro.metric.client');

var microHeaders = [
  'micro.cs', 'micro.cr',
  'micro.ss', 'micro.sr',
  'micro.bfes', 'micro.bfer',
  'micro.bbes', 'micro.bber'
];

// TODO: Add proper test to ensure the format of the metric, mocking logger was giving troubles
function metric(name, ts, message) {
  // val is not a NaN should log the metric
  if (isNaN(ts)) { return message; }

  var metadata = _.pick(message, ['type', 'rid', 'address', 'status', 'client', 'clientId', 'transaction']);
  metadata['micrometric'] = { name: name, value: ts }
  log.info(metadata, 'Publishing metric "%s":%sms', name, ts);
  return metadata;
}

function start(message) {
  var now = moment().valueOf();
  var headers = message.headers || {};
  var stack = headers['micro-metrics-stack'] || [];

  // since a new request span is created need to persist
  // the micro headers stack accross calls of several
  // services when present.
  var callStackHeaders = _.pick(headers, microHeaders);
  if (Object.keys(callStackHeaders).length) {
    stack.push(callStackHeaders);
  }

  // omit the micro metric headers and the old stack
  var headers = _.omit(headers, microHeaders, 'micro-metrics-stack');
  // add the micro client send timestamp
  message.headers = _.defaults({},
    headers,
    {'micro.cs': now}
  );

  // only include stack if is not empty
  if (stack.length) {
    message.headers['micro-metrics-stack'] = stack;
  }

  metric('micro.cs', now, message);
  return message;
}

function end(message) {
  var now = moment().valueOf();

  // remove the headers, from the current call stack
  // and restore the micro headers from call stack
  // and add the micro client receive timestamp
  var callStackHeaders = message.headers || {};
  var oldStackHeaders = callStackHeaders['micro-metrics-stack'] || [];
  message.headers = _.defaults({},
    _.omit(message.headers, microHeaders, 'micro-metrics-stack'),
    {'micro.cr': now},
    oldStackHeaders.pop());

  metric('micro.cr', now, message);

  var cs = callStackHeaders['micro.cs'];
  metric('micro.c.span', now - cs, message);

  var bfes = callStackHeaders['micro.bfes'];
  metric('micro.bc.span', now - bfes, message);

  return message;
}

module.exports = {start: start, end: end};
