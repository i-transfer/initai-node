const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const Immutable = require('immutable')
const pkg = require('../../package.json')
const messageContext = require('./message-context')
const messageEventContext = require('./message-event-context')

chai.use(sinonChai)

global.expect = require('chai').expect
global.sinon = sinon
global.sandbox = sinon.sandbox.create()

if (!process.env.VERSION) {
  process.env.VERSION = pkg.version
}

afterEach(() => {
  sandbox.restore()
})
