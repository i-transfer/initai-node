# Init.ai node client

Manage conversation and event invocations and construct replies.

## Installation

### Requirements

This project is developed against Node version 4.3.2 as it intended to run as part of an [AWS Lambda](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html) execution.

If you are using [nvm](https://github.com/creationix/nvm), run: 

```bash
$ nvm use
```

## Usage

Install from npm:

```bash
$ npm i -S initai-node
```

Include in your project:

```js
const InitClient = require('initai-node')

function main(eventData, runtimeContext) {
  const client = InitClient.create(eventData, runtimeContext)

  // ... Configure your conversation logic

  client.done()
}
```

For a detailed reference, visit: http://docs.init.ai/reference/client-api.html

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
