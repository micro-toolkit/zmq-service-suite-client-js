var Q = require('q'),
    zmq = require('zmq'),
    uuid = require('uuid'),
    _ = require('lodash'),
    errors = require('./config/errors'),
    metric = require('./metric'),
    Message = require('zmq-service-suite-message'),
    Logger = require('logger-facade-nodejs'),
    log = Logger.getLogger('micro.client');

// defaults
var defaults = {
  identity: "client",
  timeout: 1000,
  headers: {}
};

function getStatusCodeClass(code){
  return parseInt(code/100);
}

function isSuccessStatusCode(code){
  return getStatusCodeClass(code) === 2;
}

function isValidErrorCode(code){
  var validErrorCode = code >= 400 && code && code < 600;
  if (!validErrorCode) { return false; }
  var statusCodeClass = getStatusCodeClass(code);
  return statusCodeClass === 4 || statusCodeClass === 5;
}

function isValidErrorContract(error){
  return error && isValidErrorCode(error.code);
}

function getConnectedSocket(config) {
  var socket = zmq.socket('dealer');
  socket.identity = config.identity + "#" + uuid.v1();
  socket.linger = 0;

  log.trace("connecting as %s", socket.identity);

  socket.connect(config.broker);
  return socket;
}

function onError(dfd, error){
  log.error(error, "Unexpected error occurred: %s stack: %s", error, error.stack);
  dfd.reject(errors["500"]);
}

function onMessage(socket, dfd, frames) {
  // when received the message have no identity we will push it with identify
  // from the socket itself
  frames.unshift(socket.identity);

  var msg = Message.parse(frames);

  // metrics will add a metric header to the message
  msg = metric.end(msg);

  log.info(msg, "Received REP with id %s from %s:%s#%s with status %s", msg.rid,
      msg.address.sid, msg.address.sversion, msg.address.verb, msg.status);

  if (isSuccessStatusCode(msg.status)) {
    return dfd.resolve({
      payload: msg.payload,
      headers: msg.headers,
      status:  msg.status
    });
  }

  if (isValidErrorContract(msg.payload)) {
    return dfd.reject(msg.payload);
  }

  var error = errors[msg.status.toString()] || errors["500"];
  dfd.reject(error);
}

function sendMessage(socket, dfd, verb, payload, options){
  var message = new Message(
    options.sid.toUpperCase(), verb.toUpperCase(),
    null, socket.identity, options.headers);

  message.payload = payload;

  var timeout = setTimeout(function() {
    var error = errors["599"];
    message.status = error.code;
    message.payload = error;
    message.type = Message.Type.REP;

    // metrics will add a metric header to the message
    message = metric.end(message);

    log.info(message, "REP to %s:%s#%s with id %s ended with timeout after %s ms!",
      message.address.sid, message.address.sversion, message.address.verb, message.rid,
      options.timeout);
    dfd.reject(message.payload);
  }, options.timeout);

  // metrics will add a metric header to the message
  message = metric.start(message);

  log.info(message, "Sending REQ with id %s to %s:%s#%s", message.rid,
    message.address.sid, message.address.sversion, message.address.verb);

  var frames = message.toFrames();
  // remove identity
  frames.shift();

  socket.send(frames);

  return timeout;
}

function call(config, verb, payload, options) {
  var dfd = Q.defer(),
    promise = dfd.promise;

  var socket = getConnectedSocket(config);

  options = _.defaults({}, options, config);

  var timeout;

  socket.on('message', function(){
    var frames = _.toArray(arguments);
    var defer = dfd;
    onMessage(socket, defer, frames);
    clearTimeout(timeout);
    timeout = null;
  });

  socket.on('error', function(error){
    var defer = dfd;
    onError(defer, error);
  });

  promise.finally(function() {
    socket.close();
  });

  timeout = sendMessage(socket, dfd, verb, payload, options);

  return promise;
}

function client(configuration) {
  var config = _.defaults(configuration, defaults);

  return {
    call: function(verb, payload, options) {
      return call(config, verb, payload, options);
    }
  };
}

module.exports = client;
