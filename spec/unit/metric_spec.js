var Message = require('zmq-service-suite-message');

describe('metric', function() {
  var msg, log;
  var metric = require('../../metric');

  beforeEach(function () {
    msg = new Message('sid', 'verb');
    msg.identity = 'some#1';
    msg.type = Message.Type.REQ;
    msg.headers = {
      'micro.cs': 1,
      'micro.cr': 2,
      'micro.ss': 3,
      'micro.sr': 4,
      'micro.bfes': 5,
      'micro.bfer': 6,
      'micro.bbes': 7,
      'micro.bber': 8
    };
  });

  describe('#start', function() {
    it('should return the message', function () {
      expect(metric.start(msg)).toEqual(msg);
    });

    it('should return the message when headers not present', function () {
      msg.headers = null;
      expect(metric.start(msg)).toEqual(msg);
    });

    it('should add micro.cs header', function () {
      var message = metric.start(msg);
      var expected = message.headers['micro.cs'];
      expect(expected).not.toBe(undefined);
    });

    describe('when micro metrics headers are present', function() {
      it('should have micro.cs header with new value', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro.cs'];
        expect(expected).not.toBe(1);
      });

      it('should stack micro.cr header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.cr'];
        expect(expected).toBe(2);
      });

      it('should stack micro.ss header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.ss'];
        expect(expected).toBe(3);
      });

      it('should stack micro.sr header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.sr'];
        expect(expected).toBe(4);
      });

      it('should stack micro.bfes header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.bfes'];
        expect(expected).toBe(5);
      });

      it('should stack micro.bfer header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.bfer'];
        expect(expected).toBe(6);
      });

      it('should stack micro.bbes header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.bbes'];
        expect(expected).toBe(7);
      });

      it('should stack micro.bber header', function () {
        var message = metric.start(msg);
        var expected = message.headers['micro-metrics-stack'][0]['micro.bber'];
        expect(expected).toBe(8);
      });
    });
  });

  describe('#end', function() {
    it('should return the message', function () {
      expect(metric.end(msg)).toEqual(msg);
    });

    it('should return the message when headers not present', function () {
      msg.headers = null;
      expect(metric.end(msg)).toEqual(msg);
    });

    it('should add micro.cr header', function () {
      var message = metric.end(msg);
      var expected = message.headers['micro.cr'];
      expect(expected).not.toBe(undefined);
    });

    describe('when micro metrics headers are present in call headers', function() {
      beforeEach(function () {
        msg.headers['micro-metrics-stack'] = [{
          'micro.cs': 11,
          'micro.cr': 12,
          'micro.ss': 13,
          'micro.sr': 14,
          'micro.bfes': 15,
          'micro.bfer': 16,
          'micro.bbes': 17,
          'micro.bber': 18
        }];
      });

      it('should add micro.cr header for the current receive', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.cr'];
        expect(expected).not.toBe(12);
      });

      it('should add micro.cs header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.cs'];
        expect(expected).toBe(11);
      });

      it('should add micro.ss header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.ss'];
        expect(expected).toBe(13);
      });

      it('should add micro.sr header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.sr'];
        expect(expected).toBe(14);
      });

      it('should add micro.bfes header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.bfes'];
        expect(expected).toBe(15);
      });

      it('should add micro.bfer header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.bfer'];
        expect(expected).toBe(16);
      });

      it('should add micro.bbes header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.bbes'];
        expect(expected).toBe(17);
      });

      it('should add micro.bber header from the previous call', function () {
        var message = metric.end(msg);
        var expected = message.headers['micro.bber'];
        expect(expected).toBe(18);
      });
    });
  });
});
