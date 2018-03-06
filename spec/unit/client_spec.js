jasmine.getEnv().defaultTimeoutInterval = 2000;

describe('ZSS Client', function() {
  var Client = require('../../client');
  var errors = require('../../config/errors');
  var zmq = require('zmq');
  var uuid = require('uuid');
  var Message = require('zmq-service-suite-message');
  var Q = require('q');
  var _ = require('lodash');

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

      it('resolves the promise with the msg status 200', function(done) {
        client.call('foo')
          .then(function(response){
            expect(response.status).toEqual(200);
            done();
          });
      });

      it('resolves the promise with different success status code', function(done) {
        msg.status = 204;
        client.call('foo')
          .then(function(response){
            expect(response.status).toEqual(204);
            done();
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
            expect(response.headers.something).toEqual(msg.headers.something);
            done();
          });
      });
    });

    describe('on error', function(){
      describe('when it receives a error payload', function(){
        var msg;
        beforeEach(function(){
          msg = new Message('sid', 'verb');
          msg.type = Message.Type.REP;

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

        it('rejects the promise with the default 500 error', function(done) {
          msg.status = 500;
          client.call('foo')
            .fail(function(error){
              expect(error.code).toBe(500);
              expect(error.userMessage).toBe(errors["500"].userMessage);
              expect(error.developerMessage).toBe(errors["500"].developerMessage);
              done();
            });
        });

        describe('handles errors retrieved by the service', function(){
          it('rejects the promise with the 4xx error', function(done) {
            var serviceError = _.cloneDeep(errors["404"]);
            serviceError.developerMessage = "some usefull message";
            msg.status = 404;
            msg.payload = serviceError;

            client.call('foo')
              .fail(function(error){
                expect(error.code).toBe(404);
                expect(error.userMessage).toBe(serviceError.userMessage);
                expect(error.developerMessage).toBe(serviceError.developerMessage);
                done();
              });
          });

          it('rejects the promise with the 5xx error', function(done) {
            var serviceError = _.cloneDeep(errors["599"]);
            serviceError.developerMessage = "some usefull message";
            msg.status = 599;
            msg.payload = serviceError;

            client.call('foo')
              .fail(function(error){
                expect(error.code).toBe(599);
                expect(error.userMessage).toBe(serviceError.userMessage);
                expect(error.developerMessage).toBe(serviceError.developerMessage);
                done();
              });
          });

          describe('when error contract isnt valid', function(){

            it('rejects the promise with the default error for status', function(done) {
              msg.status = 404;
              msg.payload = {};
              client.call('foo')
                .fail(function(error){
                  expect(error.code).toBe(404);
                  expect(error.userMessage).toBe(errors["404"].userMessage);
                  expect(error.developerMessage).toBe(errors["404"].developerMessage);
                  done();
                });
            });
          });

          it('rejects the promise with the default 500 if status not in errors', function(done) {
            msg.status = 409;
            msg.payload = {};

            client.call('foo')
              .fail(function(error){
                expect(error.code).toBe(500);
                expect(error.userMessage).toBe(errors["500"].userMessage);
                expect(error.developerMessage).toBe(errors["500"].developerMessage);
                done();
              });
          });
        });
      });

      it('fails the promise with the 500 error when the "error" callback is executed', function(done) {
        spyOn(zmq, 'socket').andReturn({
          connect: Function.apply(),
          send: Function.apply(),
          on: function(type, callback) {
            if (type === 'error') {
              callback(new Error('something happen'));
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
