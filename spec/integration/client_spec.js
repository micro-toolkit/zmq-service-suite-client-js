jasmine.getEnv().defaultTimeoutInterval = 2000;

describe('ZSS Client Integration', function() {
  var Client = require('../../client');

  var zmq = require('zmq'),
      _ = require('lodash'),
      Message = require('zmq-service-suite-message');

  var config = {
    broker: 'tcp://127.0.0.1:5560',
    sid: 'service-identifier',
    identity: "clientX",
    timeout: 500
  };

  var Broker = function(){
    var socket = zmq.socket('router');

    var run = function(){
      socket.bindSync(config.broker);
      socket.on('message', function(){
        var frames = _.toArray(arguments);

        var msg = Message.parse(frames);
        msg.status = 200;
        msg.payload = "PONG";
        msg.type = Message.Type.REP;

        socket.send(msg.toFrames());
      });
    };

    var stop = function(){
      socket.close();
    };

    return { run: run, stop: stop };
  };

  var broker;

  beforeEach(function(){
    broker = new Broker();
    broker.run();
  });

  afterEach(function(){
    broker.stop();
  });


  it('resolves promise with service response', function(done){
    var client = new Client(config);
    client.call('ping')
      .then(function(response){
        expect(response.payload).toEqual("PONG");
        done();
      });
  });

});
