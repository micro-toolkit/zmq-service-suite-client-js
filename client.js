(function() {
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

  var ZSSClient = function(configuration) {

    var config = _.defaults(configuration, defaults);

    var getConnectedSocket = function() {
      var socket = zmq.socket('dealer');
      socket.identity = config.identity + "#" + uuid.v1();
      socket.linger = 0;
      socket.connect(config.broker);
      return socket;
    };

    var onMessage = function(dfd, frames) {
      var msg = Message.parse(frames);

      if(msg.status === 200){
        dfd.resolve({
          payload: msg.payload,
          headers: msg.headers
        });
      }
      else {
        var error = errors[msg.status.toString()];
        dfd.reject(error);
      }
    };

    var onError = function(dfd, error){
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

      setTimeout(function() {
        dfd.reject(errors["599"]);
      }, options.timeout);

      var message = new Message(options.sid.toUpperCase(), verb.toUpperCase());
      message.headers = options.headers;
      message.payload = payload;

      var frames = message.toFrames();
      // remove identity
      frames.shift();

      socket.send(frames);

      return promise;
    };

  };

  module.exports = ZSSClient;

}());
