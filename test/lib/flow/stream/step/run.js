'use strict'

const Immutable = require('immutable')
const runStepAndGetNewState = require('../../../../../src/flow/stream/step/run')
const initClient = require('../../../../../src/index')
const logger = require('../../../../../src/logger')
const messageContext = require('../../../../helpers/message-context')

const Map = Immutable.Map
const List = Immutable.List
// const noop = () => {}

// function createFakeStep() {
//   return {
//     next: sandbox.stub(),
//     prompt: sandbox.stub(),
//     satisfied: sandbox.spy(() => true)
//   }
// }

// If the currently active step is undefined
//    return state directlyA
// If the currently active step is defined
//    If is a stream
//        return the result of the recursion
//    Else if is not a stream
//        If is satisfied
//            return result of recursion
//    Else if is is not satisfied
//        If isFirstRun
//            extractInfo on active step and set currentlyActiveStep on state
//        Else if should runFallback
//            If fallback fn is defined
//                call fallback, set ranFallback to true
//        Else
//            ?
//    Prompt
//      sync
//      async

describe('runStepAndGetNewState', () => {
  let fakeMessageContext, fakeClient, fakeLambdaContext

  beforeEach(() => {
    fakeMessageContext = Immutable.fromJS(messageContext).toJS()

    fakeLambdaContext = {
      succeed: sandbox.stub(),
      fail: sandbox.stub()
    }

    fakeClient = initClient.create(fakeMessageContext, fakeLambdaContext)

    // Swallow logs during tests
    sandbox.stub(fakeClient, 'log')
    sandbox.stub(logger, 'log')
  })

  it('follows the result of sync prompt', () => {
    let destinationStepReached = false
    const originStep = {
      satisfied: () => {
        return false
      },
      prompt: () => {
        return 'b'
      },
    }
    const destinationStep = {
      satisfied: () => {
        return false
      },
      prompt: () => {
        destinationStepReached = true
      },
    }
    const streams = {
      'a': [originStep],
      'b': [destinationStep],
    }
    let state = Map({
      streamName: 'a',
      stepIndex: 0,
      isFirstRun: false,
    })

    runStepAndGetNewState(state, streams, fakeClient)

    expect(destinationStepReached).to.equal(true)
  })

  it('follows the result of async prompt', () => {
    let destinationStepReached = false
    const originStep = {
      satisfied: () => {
        return false
      },
      prompt: (callback) => {
        callback('b')
      },
    }
    const destinationStep = {
      satisfied: () => {
        return false
      },
      prompt: () => {
        destinationStepReached = true
      },
    }
    const streams = {
      'a': [originStep],
      'b': [destinationStep],
    }
    let state = Map({
      streamName: 'a',
      stepIndex: 0,
      isFirstRun: false,
    })

    runStepAndGetNewState(state, streams, fakeClient)

    expect(destinationStepReached).to.equal(true)
  })

  it('only runs async functions once in a stack', () => {
    let destinationStepReached = false
    const stepA1 = {
      satisfied: () => {
        return true
      },
      next: sandbox.stub(),
      prompt: (callback) => {
        callback()
      },
    }
    let timesA2reached = 0
    const stepA2 = {
      satisfied: () => {
        return false
      },
      next: sandbox.stub(),
      prompt: (callback) => {
        timesA2reached += 1
        callback('init.proceed')
      },
    }

    let timesB1reached = 0
    const stepB1 = {
      satisfied: () => {
        return false
      },
      next: sandbox.stub(),
      prompt: (callback) => {
        timesB1reached += 1
        callback('init.proceed')
      },
    }

    let timesB3reached = 0
    const stepB3 = {
      satisfied: () => {
        return false
      },
      next: sandbox.stub(),
      prompt: (callback) => {
        timesB3reached += 1
        callback()
      },
    }
    const streams = {
      'a': [stepA1, stepA2],
      'b': [stepB1, 'a', stepB3],
    }
    let state = Map({
      streamName: 'b',
      stepIndex: 0,
      isFirstRun: false,
      streamStack: List([]),
    })

    runStepAndGetNewState(state, streams, fakeClient)

    expect(timesB3reached).to.equal(1)
    expect(timesA2reached).to.equal(1)
    expect(timesB1reached).to.equal(1)
  })

  it('follows next after init.proceed', () => {
    let timesA1reached = 0
    const stepA1 = {
      satisfied: () => {
        return false
      },
      next: () => {
        return 'b'
      },
      prompt: () => {
        timesA1reached += 1
        return 'init.proceed'
      },
    }
    let timesA2reached = 0
    const stepA2 = {
      satisfied: () => {
        return false
      },
      next: sandbox.stub(),
      prompt: () => {
        timesA2reached += 1
      },
    }

    let timesB1reached = 0
    const stepB1 = {
      satisfied: () => {
        return false
      },
      next: () => {
        return 'c'
      },
      prompt: (callback) => {
        timesB1reached += 1
        callback('init.proceed')
      },
    }

    let timesC1reached = 0
    const stepC1 = {
      satisfied: () => {
        return false
      },
      next: sandbox.stub(),
      prompt: (callback) => {
        timesC1reached += 1
        callback()
      },
    }
    const streams = {
      'a': [stepA1, stepA2],
      'b': [stepB1],
      'c': [stepC1],
    }
    let state = Map({
      streamName: 'a',
      stepIndex: 0,
      isFirstRun: false,
      streamStack: List([]),
    })

    runStepAndGetNewState(state, streams, fakeClient)

    expect(timesA1reached).to.equal(1)
    expect(timesA2reached).to.equal(0)
    expect(timesB1reached).to.equal(1)
    expect(timesC1reached).to.equal(1)
  })

  describe('active step is undefined', () => {
    it('returns provided state', () => {
      const result = runStepAndGetNewState(Map({x: 'y'}), {}, {})

      expect(result).to.deep.equal(Map({x: 'y'}))
    })
  })

  describe('currently active step is defined', () => {
    describe('is a stream', () => {
      // it('returns the result of recursed function', () => {
      // })
    })
  })
})
