const fs = require('fs')
const path = require('path')
const stateMachine = require('../src')
const logger = require('../src/logger')
const InitClient = require('../src')
const sampleMessageContext = require('./helpers/message-context')
const exampleFlowScript = fs.readFileSync(
  path.resolve(__dirname + '/helpers/example-flow-script.js'),
  'utf8'
)
const InitClientConstructor = InitClient.InitClient

describe('stateMachine handler', () => {
  beforeEach(() => {
    const fakeMessageContext = Object.assign({}, sampleMessageContext)

    fakeMessageContext.payload.scripts.flow = {
      id: Date.now(),
      source_code: exampleFlowScript,
    }

    this.fakeMessageContext = fakeMessageContext
  })
})
