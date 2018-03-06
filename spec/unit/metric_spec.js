var Message = require('zmq-service-suite-message');

describe('metric', function() {
  var msg, log;
  var metric = require('../../metric');

  beforeEach(function () {
    msg = new Message('sid', 'verb');
    msg.identity = 'some#1';
    msg.type = Message.Type.REQ;
  });

  describe('#start', function() {
    it('should return the message', function () {
      expect(metric.start(msg)).toEqual(msg);
    });

    it('should add micro.cs header', function () {
      var message = metric.start(msg);
      var expected = message.headers['micro.cs'];
      expect(expected).not.toBe(undefined);
    });
  });

  describe('#end', function() {
    it('should return the message', function () {
      expect(metric.end(msg)).toEqual(msg);
    });

    it('should add micro.cr header', function () {
      var message = metric.end(msg);
      var expected = message.headers['micro.cr'];
      expect(expected).not.toBe(undefined);
    });
  });
});
