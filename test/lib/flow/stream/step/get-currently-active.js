'use strict'

const Map = require('immutable').Map
const getCurrentlyActiveStep = require('../../../../../src/flow/stream/step/get-currently-active')

describe('getCurrentlyActiveStep', () => {
  it('returns a step if provided "stream" is a stream', () => {
    const result = getCurrentlyActiveStep(['a', 'b'], Map({
      stepIndex: 0,
    }))

    expect(result).to.equal('a')
  })

  it('returns provided stream', () => {
    const result = getCurrentlyActiveStep('a', Map({stepIndex: 0}))
    expect(result).to.equal('a')
  })
})
