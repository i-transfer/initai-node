'use strict'

const Immutable = require('immutable')
const getNextStep = require('../../../../../src/flow/stream/step/get-next')

const Map = Immutable.Map
const List = Immutable.List

function createFakeStep() {
  return {
    next: sandbox.stub(),
    prompt: sandbox.stub(),
    satisfied: sandbox.spy(() => true)
  }
}

describe('getNextStep', () => {
  let fakeStep, fakeStreams, fakeState

  beforeEach(() => {
    const step0 = createFakeStep()

    fakeStreams = {
      'streamA': [step0]
    }

    fakeState = Map({
      streamName: 'streamA',
      stepIndex: 0,
      streamStack: List(),
    })
  })

  it('returns a Map', () => {
    const result = getNextStep(createFakeStep(), fakeStreams, fakeState)

    expect(Map.isMap(result)).to.equal(true)
  })

  it('returns a state mapping to the next step in the current stream', () => {
    let result
    const currentStep = createFakeStep()
    const step0 = createFakeStep()
    const step1 = createFakeStep()
    const step2 = createFakeStep()

    fakeStreams = {
      'streamA': [step0, step1, step2],
      'streamB': 'streamA'
    }

    currentStep.next = sandbox.spy(() => {
      return 'streamA'
    })

    fakeState = fakeState.set('stepIndex', 1)

    result = getNextStep(currentStep, fakeStreams, fakeState)

    expect(result).to.deep.equal(Map({
      streamName: 'streamA',
      stepIndex: 2,
      streamStack: List(),
    }))
  })

  it('returns state mapping to the first step in the next stream', () => {
    let result, currentStep
    const step0 = createFakeStep()
    const step1 = createFakeStep()
    const step2 = createFakeStep()
    const step3 = createFakeStep()
    const step4 = createFakeStep()

    fakeStreams = {
      'streamA': [step0, step1, step2],
      'streamB': [step3, step4],
      'streamC': 'streamA'
    }

    currentStep = step2
    currentStep.next = sandbox.spy(() => {
      return 'streamB'
    })

    fakeState = fakeState.set('stepIndex', 2)

    result = getNextStep(currentStep, fakeStreams, fakeState)

    expect(result.toJS()).to.deep.equal(Map({
      streamName: 'streamB',
      stepIndex: 0,
      streamStack: List([Map({
        streamName: 'streamA',
        stepIndex: 3,
      })]),
    }).toJS())
  })

  describe('undefined/mismatched "next" result', () => {
    it('increments stepIndex in current stream', () => {
      let result, currentStep
      const step0 = createFakeStep()
      const step1 = createFakeStep()
      const step2 = createFakeStep()
      const step3 = createFakeStep()
      const step4 = createFakeStep()

      fakeStreams = {
        'streamA': [step0, step1, step2],
        'streamB': [step3, step4],
        'streamC': 'streamA'
      }

      currentStep = step3
      currentStep.next = sandbox.spy(() => {
        return null
      })

      fakeState = fakeState.merge({
        streamName: 'streamB',
        stepIndex: 0
      })

      result = getNextStep(currentStep, fakeStreams, fakeState)

      expect(result).to.deep.equal(Map({
        streamName: 'streamB',
        stepIndex: 1,
        streamStack: List(),
      }))
    })

    describe('exceeds bounds', () => {
      it('routes to "end" if bounds are exceeded', () => {
        let result, currentStep
        const step0 = createFakeStep()
        const step1 = createFakeStep()
        const step2 = createFakeStep()
        const step3 = createFakeStep()
        const step4 = createFakeStep()

        fakeStreams = {
          'streamA': [step0, step1, step2],
          'streamB': [step3, step4],
          'streamC': 'streamA'
        }

        currentStep = step4
        currentStep.next = sandbox.spy(() => {
          return null
        })

        fakeState = fakeState.merge({
          streamName: 'streamB',
          stepIndex: 1
        })

        result = getNextStep(currentStep, fakeStreams, fakeState)

        const expected = Map({
          streamName: 'end',
          stepIndex: 0,
          streamStack: List([Map({
            streamName: 'streamB',
            stepIndex: 2,
          })]),
        }).toJS()

        expect(result.toJS()).to.deep.equal(expected)
      })
    })

    describe('within bounds', () => {
      it('routes to beginning if next step is a "stream pointer" ', () => {
        let result, currentStep
        const step0 = createFakeStep()
        const step1 = createFakeStep()
        const step2 = createFakeStep()
        const step3 = createFakeStep()
        const step4 = createFakeStep()

        fakeStreams = {
          'streamA': [step0, step1, step2],
          'streamB': [step3, step4, 'streamC'],
          'streamC': 'streamA'
        }

        currentStep = step4
        currentStep.next = sandbox.spy(() => {
          return null
        })

        fakeState = fakeState.merge({
          streamName: 'streamB',
          stepIndex: 1
        })

        result = getNextStep(currentStep, fakeStreams, fakeState)

        expect(result.toJS()).to.deep.equal(Map({
          streamName: 'streamC',
          stepIndex: 0,
          streamStack: List([Map({
            streamName: 'streamB',
            stepIndex: 2,
          })]),
        }).toJS())
      })

      describe('throws an error', () => {
        it('if next step is not defined', () => {
          let result, currentStep
          const step0 = createFakeStep()
          const step1 = createFakeStep()
          const step2 = createFakeStep()
          const step3 = createFakeStep()
          const step4 = createFakeStep()

          fakeStreams = {
            'streamA': [step0, step1, step2],
            'streamB': [step3, step4, 'streamX'],
            'streamC': 'streamA'
          }

          currentStep = step4
          currentStep.next = sandbox.spy(() => {
            return null
          })

          fakeState = fakeState.merge({
            streamName: 'streamB',
            stepIndex: 1,
            streamStack: List(),
          })

          function run() {
            getNextStep(currentStep, fakeStreams, fakeState)
          }

          expect(run).to.throw('"streamX" is not a valid stream')
        })
      })
    })
  })
})
