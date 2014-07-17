jasmine.getEnv().defaultTimeoutInterval = 2000;

describe('ZSS Client', function() {
  var Client = require('../../client');
  var zmq = require('zmq');
  var uuid = require('uuid');
  var Message = require('zmq-service-suite-message');
  var Q = require('q');

  var config = {
    broker: 'ipc://tmp/test',
    sid: 'service-identifier',
    identity: "clientX",
    timeout: 500
  };

  describe('#call', function() {

    var client;
    beforeEach(function(){
      client = new Client(config);
      spyOn(uuid, 'v1').andReturn("uuid");
    });

    it('returns a Promise', function() {
      var promise = client.call('foo');

      expect(promise.then).toEqual(jasmine.any(Function));
    });

    describe('connects the zmq socket', function(){

      it('with dealer type', function() {
        spyOn(zmq, 'socket').andReturn({
          send: Function.apply(),
          on: Function.apply(),
          connect: Function.apply()
        });

        client.call('foo');
        expect(zmq.socket).toHaveBeenCalledWith('dealer');
      });

      it('with setted identity', function(done) {
        spyOn(zmq, 'socket').andReturn({
          send: Function.apply(),
          on: Function.apply(),
          connect: function(uri) {
            expect(this.identity).toEqual("clientX#uuid");
            done();
          }
        });

        client.call('foo');
      });

      it('with setted linger', function(done) {
        spyOn(zmq, 'socket').andReturn({
          send: Function.apply(),
          on: Function.apply(),
          connect: function(uri) {
            expect(this.linger).toEqual(0);
            done();
          }
        });

        client.call('foo');
      });

      it('with broker address', function(done) {
        spyOn(zmq, 'socket').andReturn({
          send: Function.apply(),
          on: Function.apply(),
          connect: function(uri) {
            expect(uri).toEqual(config.broker);
            done();
          }
        });

        client.call('foo');
      });

    });

    it('registers a "message" callback', function(done) {
      spyOn(zmq, 'socket').andReturn({
        connect: Function.apply(),
        send: Function.apply(),
        on: function(type) {
          if (type === 'message') {
            done();
          }
        }
      });

      client.call('foo');
    });

    it('registers a "error" callback', function(done) {
      spyOn(zmq, 'socket').andReturn({
        connect: Function.apply(),
        send: Function.apply(),
        on: function(type) {
          if (type === 'error') {
            done();
          }
        }
      });

      client.call('foo');
    });

    it('closes the socket when the promise is resolved', function(done) {
      spyOn(zmq, 'socket').andReturn({
        connect: Function.apply(),
        send: Function.apply(),
        on: Function.apply(),
        close: function() {
          done();
        }
      });

      var dfd = Q.defer();
      spyOn(Q, 'defer').andReturn(dfd);

      client.call('foo');
      dfd.resolve();
    });

    it('sends request to socket', function(done) {
      var payload = { something: "payload" };
      var headers = { header: "data" };

      spyOn(zmq, 'socket').andReturn({
        connect: Function.apply(),
        send: function(frames){
          frames.unshift('identity');
          var msg = Message.parse(frames);
          expect(msg.type).toEqual(Message.Type.REQ);
          expect(msg.address.sid).toEqual(config.sid.toUpperCase());
          expect(msg.address.verb).toEqual('FOO');
          expect(msg.payload).toEqual(payload);
          expect(msg.headers).toEqual(headers);
          done();
        },
        on: Function.apply(),
        close: Function.apply()
      });

      client.call('foo', payload, { headers: headers });
    });

    describe('on success', function(){

      var msg;

      beforeEach(function(){
        msg = new Message('sid', 'verb');
        msg.type = Message.Type.REP;
        msg.status = 200;
        msg.payload = "data";
        msg.headers = { something: "data" };

        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: function(type, callback) {
            if (type === 'message') {
              callback.apply(null, msg.toFrames());
            }
          }
        });
      });

      it('resolves the promise with the payload', function(done) {

        client.call('foo')
          .then(function(response){
            expect(response.payload).toEqual(msg.payload);
            done();
          });
      });

      it('resolves the promise with the headers', function(done) {

        client.call('foo')
          .then(function(response, headers){
            expect(response.headers).toEqual(msg.headers);
            done();
          });
      });

    });

    describe('on error', function(){

      it('rejects the promise with the specified error', function(done) {
        var msg = new Message('sid', 'verb');
        msg.type = Message.Type.REP;
        msg.status = 500;

        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: function(type, callback) {
            if (type === 'message') {
              callback.apply(null, msg.toFrames());
            }
          }
        });

        client.call('foo')
          .fail(function(error){
            expect(error.code).toBe(500);
            done();
          });
      });

      it('fails the promise with the 500 error when the "error" callback is executed', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: function(type, callback) {
            if (type === 'error') {
              callback(null);
            }
          }
        });

        var client = new Client(config);
        client.call('foo')
          .fail(function(error){
            expect(error.code).toBe(500);
            done();
          });
      });

      it('closes the socket when the promise is rejected', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: Function.apply(),
          close: function() {
            done();
          }
        });

        var dfd = Q.defer();
        spyOn(Q, 'defer').andReturn(dfd);

        client.call('foo');
        dfd.reject();
      });

    });

    describe('Timeout', function() {

      it('rejects the promise with the timeout error on default timeout', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: Function.apply(),
          close: Function.apply(),
        });

        var dfd = Q.defer();
        setTimeout(dfd.resolve, 1500);
        spyOn(Q, 'defer').andReturn(dfd);

        client.call('foo', {})
          .fail(function (error) {
            expect(error.code).toBe(599);
            done();
          });
      });

      it('fails the promise with the timeout error with a given timeout', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: Function.apply(),
          close: Function.apply(),
        });

        var dfd = Q.defer();
        setTimeout(dfd.resolve, 250);
        spyOn(Q, 'defer').andReturn(dfd);

        client.call('foo', {}, {timeout: 10})
          .fail(function (error) {
            expect(error.code).toBe(599);
            done();
          });
      });

      it('fails the promise with the timeout error with a default timeout from config', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: Function.apply(),
          close: Function.apply(),
        });

        var dfd = Q.defer();
        setTimeout(dfd.resolve, 600);
        spyOn(Q, 'defer').andReturn(dfd);

        client.call('foo', {})
          .fail(function (error) {
            expect(error.code).toBe(599);
            done();
          });
      });

      it('resolves the promise before timeout', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: Function.apply(),
          close: Function.apply(),
        });

        var dfd = Q.defer();
        spyOn(Q, 'defer').andReturn(dfd);

        client.call('foo', {}, {timeout: 1000})
          .then(function () {
            done();
          });

        dfd.resolve();
      });
    });

  });
});
