[![Build Status](https://travis-ci.org/micro-toolkit/zmq-service-suite-client-js.svg?branch=master)](https://travis-ci.org/micro-toolkit/zmq-service-suite-client-js)
[![Code Climate](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js.png)](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js)
[![Coverage](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js/coverage.png)](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js)
[![Issue Count](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js/badges/issue_count.svg)](https://codeclimate.com/github/micro-toolkit/zmq-service-suite-client-js)

## ZMQ Service Oriented Suite - Node-js Client

[![NPM version](https://badge.fury.io/js/zmq-service-suite-client.svg)](http://badge.fury.io/js/zmq-service-suite-client)

This project is a node-js client implementation for [ZMQ Service Suite](http://micro-toolkit.github.io/zmq-service-suite-specs/).

**0MQ Install**

You need to have [0MQ installed](http://zeromq.org/area:download).

If you use MacOS just do

    $ brew install zeromq

## Installation

    npm install zmq-service-suite-client --save

## ZSS Client Usage

```javascript

var ZSSClient = require('zmq-service-suite-client');

var config = {
  // broker frontend address
  broker: 'tcp://127.0.0.1:7777',
  // service unique identifier
  sid: 'service-identifier',
  // client identity (optional), defaults to 'client'
  identity: "clientX",
  // client timeout in ms (optional), defaults to 1s
  timeout: 1000
};

var client = new ZSSClient(config);

var verb = "service/action";
var payload = "something";

// call return a promise
client.call(verb, payload)
  .then(function(response){
    console.log("received payload =>", response.payload);
    console.log("received headers =>", response.headers);
  });

// fails the promise when service status is not 200
client.call('foo')
  .fail(function(error){
    console.log("fail with code: %s and user message: %s and dev message %s",
      error.code, error.userMessage, error.developerMessage);
  });

```

### Options are optional and can be used to:

#### Timeout request

```javascript
// it fails the promise
client.call(verb, payload, { timeout: 1000 });
```

* pass request headers

```javascript
client.call(verb, payload, { headers: { something: "data" } });

```

## System Metrics

The library publishes some log events related with metrics of the system and some headers are added to the request along the way to identify the timestamp of the different events. with the timestamp in milliseconds.

The following sigles are used for each component identification:
* `c` - stands for client
* `s` - stands for service
* `bfe` - stands for broker frontend
* `bbe` - stands for broker backend
* `b` - stands for broker

The following sigles are used for each socket event:
* `s` - stands for message sent
* `r` - stands for message receive

The following spans are used to identify the different component traces:

* `micro.cb.span`: Identifies the time it takes since the client sent the request until the broker receives it (`micro.cs - micro.bfer`).
* `micro.bfe.span`: Identifies the time it takes since the broker receives the request until it processes it to send through the backend (internal broker actions) (`micro.bbes - micro.bfer`).
* `micro.bs.span`: Identifies the time it takes since the broker sends the request until it is received in the service (`micro.sr - micro.bbes`).
* `micro.s.span`: Identifies the time it takes since the service received the request until the response is sent (`micro.ss - micro.sr`).
* `micro.sb.span`: Identifies the time it takes since the service sent the response until the response is received in the broker (`micro.bber - micro.ss`).
* `micro.bbe.span`: Identifies the time it takes since the broker received the response until the response is sent through the broker frontend (internal broker actions) (`micro.bfes - micro.bber`).
* `micro.bc.span`: Identifies the time it takes since the broker sent the response until the response is received in the client (`micro.cr - micro.bfes`).
* `micro.c.span`: Identifies the time it takes since the client sent the request until the response is received in the client (`micro.cr - micro.cs`).

The following headers are added by the client to calculate the metrics:

* When sending a new request adds the header `micro.cs` of the request send time.
* When receives the request adds the header `micro.cr` of the request receive time.

The following metrics are calculated when the request is received:

* `micro.bc.span`: Identifies the time it takes since the broker sent the response until the response is received in the client (`micro.cr - micro.bfes`).
* `micro.c.span`: Identifies the time it takes since the client sent the request until the response is received in the client (`micro.cr - micro.cs`).

`micro.c.span` - Allows to identify the full span of a particular request.

## NOTES

The client library have a peer dependency to logger-facade-nodejs, the module used for logging.


## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

## Bump versioning

We use [grunt bump package](https://www.npmjs.org/package/grunt-bump) to control package versioning.

Bump Patch version

    $ grunt bump

Bump Minor version

    $ grunt bump:minor

Bump Major version

    $ grunt bump:major

## Running Specs

    $ npm test

## Coverage Report

We aim for 100% coverage and we hope it keeps that way! :)
We use pre-commit and pre-push hooks and CI to accomplish this, so don't mess with our build! :P

Check the report after running npm test.

    $ open ./coverage/lcov-report/index.html
