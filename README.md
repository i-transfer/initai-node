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

> For a detailed reference, visit: [https://docs.init.ai/docs/node-js-sdk](https://docs.init.ai/docs/node-js-sdk)

Before starting, ensure you have a webhook configured to handle a logic invocation.

**Include the library in your project**

```js
const InitClient = require('initai-node')
```

**Instantiate a client instance**

The payload sent to your webhook for the `LogicInvocation` event (See [webhooks](https://docs.init.ai/docs/webhooks#section-logicinvocation) docs) contains an Object for you to provide to your client instance.

* `data`: Object – The logic invocation data received from your webhook. ([Docs](https://docs.init.ai/docs/webhooks#section-logicinvocation))

```js
const client = InitClient.create(data)
```

**Sending the logic result**

Prior to version `0.0.14,` it was required that you manually send a logic invocation result to our API. With version `0.0.14`, a new method `sendResult` was added which handles this call for you.

```js
const client = new InitClient.create(data)
const done = () => client.sendResult().then(() => console.log('Done!'))

client.addResponse('provide_gametime', { team: 'Chicago Cubs' })
done()
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
