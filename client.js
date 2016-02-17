var Q = require('q'),
    zmq = require('zmq'),
    uuid = require('uuid'),
    _ = require('lodash'),
    errors = require('./config/errors'),
    Message = require('zmq-service-suite-message'),
    Logger = require('logger-facade-nodejs');

// defaults
var defaults = {
  identity: "client",
  timeout: 1000,
  headers: {}
};

function getStatusCodeClass(code){
  return parseInt(code/100);
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


var ZSSClient = function(configuration) {

  var log = Logger.getLogger('ZSSClient');

  var config = _.defaults(configuration, defaults);

  var getConnectedSocket = function() {
    var socket = zmq.socket('dealer');
    socket.identity = config.identity + "#" + uuid.v1();
    socket.linger = 0;

    log.debug("connecting to: %s", socket.identity);

    socket.connect(config.broker);
    return socket;
  };

  var onMessage = function(dfd, frames) {
    var msg = Message.parse(frames);
    log.debug("received message %s", msg);

    if(msg.status === 200){
      return dfd.resolve({
        payload: msg.payload,
        headers: msg.headers
      });
    }

    if (isValidErrorContract(msg.payload)) {
      return dfd.reject(msg.payload);
    }

    var error = errors[msg.status.toString()] || errors["500"];
    dfd.reject(error);
  };

  var onError = function(dfd, error){
    log.error("Unexpected error occurred: ", error);
    dfd.reject(errors["500"]);
  };

  this.call = function(verb, payload, options) {
    var dfd = Q.defer(),
      promise = dfd.promise;

    var socket = getConnectedSocket();

    options = _.defaults({}, options, config);

    socket.on('message', function(){
      var frames = _.toArray(arguments);
      var defer = dfd;
      onMessage(defer, frames);
    });

    socket.on('error', function(error){
      var defer = dfd;
      onError(defer, error);
    });

    promise.finally(function() {
      socket.close();
    });

    var message = new Message(options.sid.toUpperCase(), verb.toUpperCase());

    setTimeout(function() {
      log.debug("Promise for message %s rejected by timeout!", message.rid);
      dfd.reject(errors["599"]);
    }, options.timeout);

    message.headers = options.headers;
    message.payload = payload;

    log.debug("Sending message. %s", message);

    var frames = message.toFrames();
    // remove identity
    frames.shift();

    socket.send(frames);

    return promise;
  };

};

module.exports = ZSSClient;
