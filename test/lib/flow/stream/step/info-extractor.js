const stepInfoExtractor = require('../../../../../src/flow/stream/step/info-extractor')

describe('stepInfoExtractor', () => {
  beforeEach(() => {
    this.extractInfoStub = sandbox.stub()

    this.createStep = () => {
      return {
        extractInfo: this.extractInfoStub,
      }
    }
  })

  it('returns a function', () => {
    expect(stepInfoExtractor()).to.be.a('function')
  })

  it('invokes extractInfo on steps', () => {
    const streams = {
      a: [this.createStep()],
      b: [this.createStep(), this.createStep()],
      c: [this.createStep(), this.createStep(), this.createStep()],
      main: [this.createStep()],
    }
    const extractInfoFromAllSteps = stepInfoExtractor(streams)

    extractInfoFromAllSteps()
    expect(this.extractInfoStub.callCount).to.equal(6)
  })

  it('can travese flows', () => {
    const streams = {
      a: [this.createStep()],
      b: [this.createStep(), this.createStep()],
      c: [this.createStep(), this.createStep(), this.createStep()],
      d: ['b', this.createStep()],
      main: [this.createStep()],
    }
    const extractInfoFromAllSteps = stepInfoExtractor(streams)

    extractInfoFromAllSteps()
    expect(this.extractInfoStub.callCount).to.equal(7)
  })

  it('does not duplicate calls', () => {
    const streams = {
      a: [this.createStep()],
      b: [this.createStep(), this.createStep()],
      c: [this.createStep(), this.createStep(), this.createStep()],
      d: ['a', 'b', 'c'],
      main: [this.createStep()],
    }
    const extractInfoFromAllSteps = stepInfoExtractor(streams)

    extractInfoFromAllSteps()
    expect(this.extractInfoStub.callCount).to.equal(6)
  })
})
