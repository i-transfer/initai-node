# Init.ai Node.js SDK

A Node.js utility to manage conversation logic, event invocations, and compose replies for your [Init.ai](https://init.ai) application.

## Requirements

* An [Init.ai](https://init.ai) account and project
* A working [Logic Invocation webhook](docs)
* Node.js version 4.3.2 or later (https://nodejs.org/en/download/)

## Install

```bash
npm i -S initai-node
```

## Usage

> For a detailed reference, visit: https://docs.init.ai/v2.0/docs/node-js-sdk

Before starting, ensure you have a webhook configured to handle a logic invocation.

**Include the library in your project**

```js
const InitClient = require('initai-node')
```

**Instantiate a client instance**

The payload sent to your webhook for the `LogicInvocation` event (See [webhooks](https://docs.init.ai/docs/webhooks#section-logicinvocation) docs) contains an Object for you to provide to your client instance.

* `data`: Object – The logic invocation data received from your webhook. ([Docs](https://docs.init.ai/docs/webhooks#section-logicinvocation))
* `options`: Object - A configuration object that _must_ include a `succeed` callback
  * `succeed`: Function – A callback that will be invoked when calling `client.done()`. This callback takes a `LogicResult` object as its only argument. The `LogicResult` object must be provided in your API response for the logic invocation.

```js
const client = InitClient.create(data, {succeed: (result) => {
  // Send `result` to Init.ai
})
```

## Development

### Testing

```bash
$ npm t
```

To run continuous tests:

```bash
$ npm run test:watch
```

### Docs

To view the JSDoc output locally, run:

```bash
$ npm run jsdoc
```

then visit [http://localhost:3044](http://localhost:3044)
