'use strict'

const Immutable = require('immutable')
const flowRunner = require('../../../src/flow/runner')
const initClient = require('../../../src/index')
const messageContext = require('../../helpers/message-context')
const messageEventContext = require('../../helpers/message-event-context')
const logger = require('../../../src/logger')
const constants = require('../../../src/util/constants')

const Flow = flowRunner.Flow

const Map = Immutable.Map
const List = Immutable.List
const noop = () => {}

describe('flowRunner', () => {
  let fakeFlowDefinition, fakeMessageContext, fakeMessageEventContext, fakeLambdaContext, fakeClient, fakeClientWithEvent

  beforeEach(() => {
    fakeFlowDefinition = {
      classifications: {},
      streams: {},
      senderRolesToProcess: [constants.ParticipantRoles.END_USER],
    }

    fakeMessageContext = Immutable.fromJS(messageContext).toJS()
    fakeMessageEventContext = Immutable.fromJS(messageEventContext).toJS()
    fakeLambdaContext = {
      succeed: sandbox.stub(),
      fail: sandbox.stub()
    }

    fakeClient = initClient.create(fakeMessageContext, fakeLambdaContext)
    fakeClientWithEvent = initClient.create(fakeMessageEventContext, fakeLambdaContext)

    // Swallow logs during tests
    sandbox.stub(fakeClient, 'log')
    sandbox.stub(logger, 'log')
  })

  describe('factory', () => {
    beforeEach(() => {
      Object.keys(Flow.prototype).forEach(fn => {
        sandbox.stub(Flow.prototype, fn)
      })
    })

    describe('run', () => {
      it('intializes an instance of Flow', () => {
        expect(
          flowRunner.run(fakeFlowDefinition, fakeClient)
        ).to.be.an.instanceOf(Flow)
      })
    })
  })

  describe('instance', () => {
    describe('constructor', () => {
      beforeEach(() => {
        Object.keys(Flow.prototype).forEach(fn => {
          sandbox.stub(Flow.prototype, fn)
        })
      })

      describe('initial assignments', () => {
        it('streams', () => {
          const flow = new Flow({
            classifications: [],
            streams: {foo: 'bar'},
            streamStack: [],
          }, fakeClient)

          expect(flow.streams).to.deep.equal({foo: 'bar'})
        })

        it('classifications', () => {
          const flow = new Flow({
            classifications: ['one fish', 'two fish'],
            streams: {},
          }, fakeClient)


          expect(flow.classifications).to.deep.equal([
            'one fish',
            'two fish',
          ])
        })

        it('client', () => {
          const flow = new Flow(fakeFlowDefinition, fakeClient)
          expect(flow.client).to.deep.equal(fakeClient)
        })

        it('currentMessageClassificationDisplay', () => {
          fakeClient.getMessagePart = () => {
            return {
              classification: {
                base_type: {
                  value: 'foobar',
                },
              },
            }
          }

          const flow = new Flow(fakeFlowDefinition, fakeClient)

          expect(flow.currentMessageClassificationDisplay).to.equal('foobar')
        })

        it('state', () => {
          const flow = new Flow({
            classifications: [],
            streams: {
              'foo': [],
              'bar': [],
              'main': 'bar',
            },
          }, fakeClient)

          expect(Map.isMap(flow.state)).to.be.true
          expect(flow.state.toJS()).to.deep.equal({
            streamName: 'bar',
            stepIndex: 0,
            isFirstRun: true,
            currentlyActiveStep: null,
            streamStack: [],
          })
        })

        it('runStep', () => {
          const flow = new Flow(fakeFlowDefinition, fakeClient)

          expect(flow.runStep).to.be.a('function')
        })

        it('extractor', () => {
          const flow = new Flow(fakeFlowDefinition, fakeClient)

          expect(flow.extractor).to.be.a('function')
        })

        describe('autoResponses', () => {
          it('maps provided autoResponses to instance property', () => {
            const fakeAutoResponses = {foo: {bar: 'baz'}}
            const flow = new Flow(
              Object.assign({}, fakeFlowDefinition, {autoResponses: fakeAutoResponses}),
              fakeClient
            )

            expect(flow.autoResponses).to.deep.equal(fakeAutoResponses)
          })

          it('falls back to an empty Object', () => {
            const flow = new Flow(fakeFlowDefinition, fakeClient)

            expect(flow.autoResponses).to.deep.equal({})
          })
        })
      })

      describe('initialize', () => {
        let flow

        beforeEach(() => {
          Flow.prototype.initialize.restore()
          Flow.prototype.isValidSenderRole = sandbox.stub().returns(true)
          flow = new Flow(fakeFlowDefinition, fakeClient)
        })

        it('calss runFirstStep', () => {
          expect(flow.runFirstStep).to.have.been.called
        })

        it('calls extractInfoFromStreamSteps', () => {
          expect(flow.extractInfoFromStreamSteps).to.have.been.called
        })

        it('calls runStateMutations', () => {
          expect(flow.runStateMutations).to.have.been.called
        })

        it('calls runLastStep', () => {
          expect(flow.runLastStep).to.have.been.called
        })

        it('should not call handleEvent', () => {
          expect(flow.handleEvent).to.not.have.been.called
        })
      })

      describe('initialize with event', () => {
        let flow

        beforeEach(() => {
          Flow.prototype.initialize.restore()
          Flow.prototype.isValidSenderRole = sandbox.stub().returns(true)
          flow = new Flow(fakeFlowDefinition, fakeClientWithEvent)
        })

        it('should not call runFirstStep', () => {
          expect(flow.runFirstStep).to.not.have.been.called
        })

        it('should not call extractInfoFromStreamSteps', () => {
          expect(flow.extractInfoFromStreamSteps).to.not.have.been.called
        })

        it('should not call runStateMutations', () => {
          expect(flow.runStateMutations).to.not.have.been.called
        })

        it('should not call runLastStep', () => {
          expect(flow.runLastStep).to.not.have.been.called
        })

        it('should call handleEvent', () => {
          expect(flow.handleEvent).to.have.been.called
        })
      })
    })

    describe('isValidSenderRole', () => {
      describe('true', () => {
        it('if sender role is included in senderRolesToProcess map', () => {
          const currentMessage = {sender_role: 'end-user'}
          const rolesToProcess = {'end-user': true}
          const result = Flow.prototype.isValidSenderRole.call({}, currentMessage, rolesToProcess)

          expect(result).to.equal(true)
        })

        it('if Message does not contain sender_role', () => {
          const currentMessage = {}
          const rolesToProcess = {'end-user': true}
          const result = Flow.prototype.isValidSenderRole.call({}, currentMessage, rolesToProcess)

          expect(result).to.equal(true)
        })

        it('if Message sender_role is falsey', () => {
          const currentMessage = {sender_role: undefined}
          const rolesToProcess = {'end-user': true}
          const result = Flow.prototype.isValidSenderRole.call({}, currentMessage, rolesToProcess)

          expect(result).to.equal(true)
        })
      })

      describe('false', () => {
        it('if sender role is not included in rolesToProcess', () => {
          const currentMessage = {sender_role: 'other-user'}
          const rolesToProcess = {'end-user': true}
          const result = Flow.prototype.isValidSenderRole.call({}, currentMessage, rolesToProcess)

          expect(result).to.equal(false)
        })
      })
    })

    describe('runFirstStep', () => {
      it('calls runStep', () => {
        const fakeContext = {
          runStep: sandbox.stub(),
          state: Map({fake: 'stateObject'}),
        }

        Flow.prototype.runFirstStep.call(fakeContext)

        expect(fakeContext.runStep).to.have.been.calledWith(fakeContext.state)
      })

      it('returns the mutated state', () => {
        const fakeContext = {
          runStep: sandbox.spy(state => {
            return state.merge({new: 'value'})
          }),
          state: Map({fake: 'stateObject'}),
        }

        const result = Flow.prototype.runFirstStep.call(fakeContext)

        expect(result).to.deep.equal(Map({
          fake: 'stateObject',
          new: 'value',
        }))
      })
    })

    describe('extractInfoFromStreamSteps', () => {
      it('runs info extraction on all steps', () => {
        const fakeContext = {
          client: {
            getMessagePart() {
              return 'fakeMessagePart'
            },
          },
          extractor: sandbox.stub(),
        }

        Flow.prototype.extractInfoFromStreamSteps.call(fakeContext)

        expect(fakeContext.extractor).to.have.been.calledWith('fakeMessagePart')
      })
    })

    describe('runStateMutations', () => {
      it('prompts on currentlyActiveStep when an expected classification is set', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          state: Map({currentlyActiveStep: fakeActiveFunction}),
          currentMessageClassificationDisplay: 'foo_bar',
          client: fakeClient,
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeActiveFunction.prompt).to.have.been.called
      })

      it('does not prompt on currentlyActiveStep when an expected classification not matched', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar', 'bar_baz']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          _getCurrentExpectations: sandbox.stub().returns({}),
          autoRespond: () => true,
          classifications: ['noo'],
          client: fakeClient,
          currentMessageClassificationDisplay: 'qux',
          state: Map({currentlyActiveStep: fakeActiveFunction}),
          streams: {},
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeActiveFunction.prompt).not.to.have.been.called
      })

      it('sets currentExpectations on the instance', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar', 'bar_baz']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          autoRespond: () => true,
          client: fakeClient,
          classifications: ['noo'],
          currentMessageClassificationDisplay: 'qux',
          _getCurrentExpectations: sandbox.stub().returns({foo: 'bar'}),
          state: Map({currentlyActiveStep: fakeActiveFunction}),
          streams: {},
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(fakeContext.currentExpectations).to.deep.equal({foo: 'bar'})
      })

      it('resets user state', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar', 'bar_baz']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          client: Object.assign({}, fakeClient, {
            getMessagePart() {
              return {content: '!RESET', content_type: 'text'}
            },
            constants: {
              MessageTypes: {
                TEXT: 'text',
              },
            },
            resetUser: sandbox.stub(),
            _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
            done: sandbox.stub(),
          }),
          _getCurrentExpectations: sandbox.stub().returns({foo: 'bar'}),
          state: Map({currentlyActiveStep: fakeActiveFunction}),
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeContext.client.resetUser).to.have.been.called
      })

      it('sets the state to route to classification assignment for previous expectation', () => {
        sandbox.stub(fakeClient, 'updateConversationState')
        const fakeContext = {
          autoRespond: () => true,
          client: fakeClient,
          classifications: ['foo', 'bar'],
          currentMessageClassificationDisplay: 'bar',
          _getCurrentExpectations: sandbox.stub().returns({
            classifications: {
              'bar': 'streamName',
            },
          }),
          _getUpdatedStateFromExpectedClassifications: sandbox.stub().returns(new Map({foo: 'bar'})),
          _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
          state: Map({}),
          streams: {},
          findExpectationMatchingCurrentPart: Flow.prototype.findExpectationMatchingCurrentPart,
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeContext._getUpdatedStateFromExpectedClassifications).to.have.been.called
        expect(fakeContext.state.toJS()).to.deep.equal({foo: 'bar'})
        expect(fakeContext.client.updateConversationState).to.have.been.calledWith('currentExpectations', null)
        expect(fakeContext.client.updateConversationState).to.have.been.calledWith('lastExpectations', {classifications: {bar: 'streamName'}})
      })

      // it('calls done when autoResponse is warranted', () => {
      //   fakeClient.done = sandbox.stub()
      //
      //   const fakeContext = {
      //     autoRespond: () => true,
      //     client: fakeClient,
      //     classifications: {
      //       'bar': 'getBar',
      //     },
      //     currentMessageClassificationDisplay: 'bar',
      //     _getCurrentExpectations: sandbox.stub().returns({}),
      //     state: Map({}),
      //     streams: {},
      //   }
      //   const result = Flow.prototype.runStateMutations.call(fakeContext)
      //
      //   expect(result).to.equal(undefined)
      //   expect(fakeClient.done).to.have.been.called
      // })

      it('sets the state to route to classification assignment from flow definition', () => {
        const fakeContext = {
          autoRespond: () => false,
          client: fakeClient,
          classifications: {
            'bar': 'getBar',
          },
          currentMessageClassificationDisplay: 'bar',
          _getCurrentExpectations: sandbox.stub().returns({}),
          _getUpdatedStateFromClassificationMappings: sandbox.stub().returns({
            new: 'state',
          }),
          state: Map({}),
          streams: {},
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeContext._getUpdatedStateFromClassificationMappings).to.have.been.called
        expect(fakeContext.state).to.deep.equal({new: 'state'})
      })

      describe('route to the current expectations stream', () => {
        it('ran fallback in branched step', () => {
          const fakeContext = {
            autoRespond: () => false,
            client: fakeClient,
            classifications: {
              'bar': 'getBar',
            },
            currentMessageClassificationDisplay: 'qux',
            _getCurrentExpectations: sandbox.stub().returns({
              stream: 'streamName',
            }),
            _getUpdatedStateFromClassificationMappings: sandbox.stub().returns({
              new: 'state',
            }),
            runStep: sandbox.spy(() => {
              fakeContext.state = Map({
                streamName: 'streamName',
                stepIndex: 0,
                isFirstRun: false,
                ranFallback: true,
              })
            }),
            state: Map({}),
            streams: {},
            findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
          }
          const result = Flow.prototype.runStateMutations.call(fakeContext)

          expect(result).to.equal(undefined)
          expect(fakeContext.runStep).to.have.been.calledWith(Map({
            streamName: 'streamName',
            stepIndex: 0,
            isFirstRun: false,
          }))
        })

        it('did not run fallback in branched step', () => {
          const fakeContext = {
            autoRespond: () => false,
            client: fakeClient,
            classifications: {
              'bar': 'getBar',
            },
            currentMessageClassificationDisplay: 'qux',
            _getCurrentExpectations: sandbox.stub().returns({
              stream: 'streamName',
            }),
            _getUpdatedStateFromClassificationMappings: sandbox.stub().returns({
              new: 'state',
            }),
            runStep: sandbox.stub(),
            state: Map({}),
            streams: {},
            findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
          }
          const result = Flow.prototype.runStateMutations.call(fakeContext)

          expect(result).to.equal(undefined)
          expect(fakeContext.runStep).to.have.been.called
          expect(fakeContext.state).to.deep.equal(Map({
            streamName: 'end',
            stepIndex: 0,
            isFirstRun: false,
          }))
        })
      })

      it('sets state to end when there is no active step', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          _getCurrentExpectations: sandbox.stub().returns({}),
          autoRespond: () => false,
          classifications: {},
          client: fakeClient,
          currentMessageClassificationDisplay: 'foo_bar',
          state: Map({}),
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeContext.state).to.deep.equal(Map({
          streamName: 'end',
          stepIndex: 0,
          isFirstRun: false,
        }))
      })

      it('resets state and inverts firstRun', () => {
        const fakeActiveFunction = {
          expects: sandbox.stub().returns(['foo_bar', 'bar_baz']),
          prompt: sandbox.stub(),
        }
        const fakeContext = {
          autoRespond: () => false,
          client: fakeClient,
          classifications: ['noo'],
          currentMessageClassificationDisplay: 'qux',
          _getCurrentExpectations: sandbox.stub().returns({}),
          state: Map({currentlyActiveStep: fakeActiveFunction}),
          streams: {main: 'mainStream'},
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype.runStateMutations.call(fakeContext)

        expect(result).to.equal(undefined)
        expect(fakeContext.state.toJS()).to.deep.equal({
          streamName: 'mainStream',
          stepIndex: 0,
          isFirstRun: false,
          currentlyActiveStep: null,
          streamStack: [],
        })
      })
    })

    describe('runLastStep', () => {
      it('invokes runStep with the current state', () => {
        const fakeContext = {
          state: Map({
            foo: 'bar',
          }),
          runStep: sandbox.stub(),
        }

        Flow.prototype.runLastStep.call(fakeContext)

        expect(fakeContext.runStep).to.have.been.calledWith(fakeContext.state)
      })
    })

    describe('autoRespond', () => {
      it('returns false if no prediction is provided', () => {
        expect(Flow.prototype.autoRespond.call({}, null)).to.equal(false)
      })

      describe('predictedDirection === input', () => {
        it('returns true if continuation ignore is set', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: true,
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'input'},
            base_type: {value: ''},
            sub_type: {value: ''},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(true)
        })

        it('returns false if continuation ignore is not set', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'input'},
            base_type: {value: ''},
            sub_type: {value: ''},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })

        it('returns false if continuation ignore is set to false', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'input'},
            base_type: {value: ''},
            sub_type: {value: ''},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })
      })

      describe('predictedDirection === output', () => {
        it('returns false if no autoResponse mapping is found', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'output'},
            base_type: {value: 'foo'},
            sub_type: {value: 'bar'},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })

        it('returns false if there is no predicted response', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'output'},
            base_type: {value: 'foo'},
            sub_type: {value: 'bar'},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })

        it('returns false if there is auto_fill_capable is false', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.8,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'output'},
            base_type: {value: 'foo'},
            sub_type: {value: 'bar'},
            predicted_response: {auto_fill_capable: false},
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })

        it('returns false if the prediction confidence of the autoResponse is greater than the overall prediction', () => {
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.8,
              },
              'foo/bar': {
                minimumConfidence: 0.9,
              },
            },
          }
          const fakePrediction = {
            direction: {value: 'output'},
            base_type: {value: 'foo'},
            sub_type: {value: 'bar'},
            predicted_response: {auto_fill_capable: true},
            overall_confidence: 0.5,
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(result).to.equal(false)
        })

        it('sends predicted response', () => {
          const addResponse = sandbox.stub()
          const fakeContext = {
            autoResponses: {
              _continuation: {
                ignore: false,
                minimumConfidence: 0.9,
              },
              'foo/bar': {
                minimumConfidence: 0.9,
              },
            },
            client: {addResponse},
          }
          const fakePrediction = {
            direction: {value: 'output'},
            base_type: {value: 'foo'},
            sub_type: {value: 'bar'},
            predicted_response: {auto_fill_capable: true},
            overall_confidence: 0.9,
          }

          const result = Flow.prototype.autoRespond.call(fakeContext, fakePrediction)

          expect(addResponse).to.have.been.calledWith('app:response:name:foo/bar', {})
          expect(result).to.equal(true)
        })
      })
    })

    describe('event processing', () => {
      let paymentEventPart1 = {
        content_type: 'event',
        content: {
          event_type: 'payment.succeed',
          payload: {
            amount: 63,
          },
        },
      }

      describe('with wildcard event handler', () => {
        it('calls the wildcard event handler if no others are set', () => {
          let wildcardHandlerCalled = false

          const fakeContext = {
            eventHandlers: {
              '*': () => { wildcardHandlerCalled = true },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(wildcardHandlerCalled).to.equal(true)
        })

        it('calls the specifc event handler if provided', () => {
          let wildcardHandlerCalled = false
          let specificHandlerCalled = false

          const fakeContext = {
            eventHandlers: {
              '*': () => { wildcardHandlerCalled = true },
              'payment.succeed': () => { specificHandlerCalled = true },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(wildcardHandlerCalled).to.equal(false)
          expect(specificHandlerCalled).to.equal(true)
        })

        it('can access the event type', () => {
          let returnString = sandbox.stub()

          const fakeContext = {
            eventHandlers: {
              'payment.succeed': (eventType, payload) => { returnString(eventType) },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(returnString).to.have.been.calledWith('payment.succeed')
        })
      })

      describe('with no event handlers defined', () => {
        it('does nothing', () => {
          const fakeContext = {}

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)
        })
      })

      describe('with a matching handler', () => {
        it('can call client.done', () => {
          fakeClient.done = sandbox.stub()

          const fakeContext = {
            eventHandlers: {
              'payment.succeed': () => { fakeClient.done() },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(fakeClient.done).to.have.been.called
        })

        it('can access the payload', () => {
          let returnNumber = sandbox.stub()

          const fakeContext = {
            eventHandlers: {
              'payment.succeed': (eventType, payload) => { returnNumber(payload.amount) },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(returnNumber).to.have.been.calledWith(63)
        })

        it('can access the event type', () => {
          let returnString = sandbox.stub()

          const fakeContext = {
            eventHandlers: {
              'payment.succeed': (eventType, payload) => { returnString(eventType) },
            },
          }

          const result = Flow.prototype.handleEvent.call(fakeContext, paymentEventPart1)

          expect(returnString).to.have.been.calledWith('payment.succeed')
        })
      })
    })

    describe('_getCurrentExpectations', () => {
      it('returns current expectations', () => {
        const fakeContext = {
          client: {
            log: noop,
            getConversationState() {
              return {
                currentExpectations: {
                  'get': ['foo', 'bar'],
                },
              }
            },
          },
        }
        const result = Flow.prototype._getCurrentExpectations.call(fakeContext)

        expect(result).to.deep.equal({
          stream: 'get',
          classifications: {
            'foo': 'get',
            'bar': 'get',
          },
        })
      })

      it('returns an empty Object if no currentExpectations exist', () => {
        const fakeContext = {
          client: {
            log: noop,
            getConversationState() {
              return {}
            },
          },
        }
        const result = Flow.prototype._getCurrentExpectations.call(fakeContext)

        expect(result).to.deep.equal({})
      })
    })

    describe('findExpectationMatchingCurrentPart', () => {
      it('matches full display', () => {
        const fakeContext = {
            currentExpectations: {
              classifications: {
                'a/b#c': 'stream1',
                'a': 'stream2',
                'c/b': 'stream3',
                'd': 'stream4',
              },
            },
            currentMessageClassificationDisplay: 'a/b#c',
            getClassificationWithoutStyle: 'a/b',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findExpectationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream1')
      })

      it('matches base type', () => {
        const fakeContext = {
            currentExpectations: {
              classifications: {
                'a/b#c': 'stream1',
                'a': 'stream2',
                'c/b': 'stream3',
                'd': 'stream4',
              },
            },
            currentMessageClassificationDisplay: 'a',
            getClassificationWithoutStyle: 'a',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findExpectationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream2')
      })

      it('matches base and subtype', () => {
        const fakeContext = {
            currentExpectations: {
              classifications: {
                'a/b#c': 'stream1',
                'a': 'stream2',
                'c/b': 'stream3',
                'd': 'stream4',
                'a/b': 'stream5',
              },
            },
            currentMessageClassificationDisplay: 'a/b',
            getClassificationWithoutStyle: 'a/b',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findExpectationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream5')
      })

      it('does match an incorrect match', () => {
        const fakeContext = {
            currentExpectations: {
              classifications: {
                'a/b#c': 'stream1',
                'a': 'stream2',
                'c/b': 'stream3',
                'd': 'stream4',
              },
            },
            currentMessageClassificationDisplay: 'z/b#c',
            getClassificationWithoutStyle: 'z/b',
            currentMessageClassificationBaseType: 'z',
          }
          const result = Flow.prototype.findExpectationMatchingCurrentPart.call(fakeContext)
          expect(result).to.be.undefined
      })
    })

    describe('findClassificationMatchingCurrentPart', () => {
      it('matches full display', () => {
        const fakeContext = {
            classifications: {
              'a/b#c': 'stream1',
              'a': 'stream2',
              'c/b': 'stream3',
              'd': 'stream4',
            },
            currentMessageClassificationDisplay: 'a/b#c',
            getClassificationWithoutStyle: 'a/b',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findClassificationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream1')
      })

      it('matches base type', () => {
        const fakeContext = {
            classifications: {
              'a/b#c': 'stream1',
              'a': 'stream2',
              'c/b': 'stream3',
              'd': 'stream4',
            },
            currentMessageClassificationDisplay: 'a',
            getClassificationWithoutStyle: 'a',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findClassificationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream2')
      })

      it('matches base and subtype', () => {
        const fakeContext = {
            classifications: {
              'a/b#c': 'stream1',
              'a': 'stream2',
              'c/b': 'stream3',
              'd': 'stream4',
              'a/b': 'stream5',
            },
            currentMessageClassificationDisplay: 'a/b',
            getClassificationWithoutStyle: 'a/b',
            currentMessageClassificationBaseType: 'a',
          }
          const result = Flow.prototype.findClassificationMatchingCurrentPart.call(fakeContext)
          expect(result).to.equal('stream5')
      })

      it('does match an incorrect match', () => {
        const fakeContext = {
            classifications: {
              'a/b#c': 'stream1',
              'a': 'stream2',
              'c/b': 'stream3',
              'd': 'stream4',
            },
            currentMessageClassificationDisplay: 'z/b#c',
            getClassificationWithoutStyle: 'z/b',
            currentMessageClassificationBaseType: 'z',
          }
          const result = Flow.prototype.findClassificationMatchingCurrentPart.call(fakeContext)
          expect(result).to.be.undefined
      })
    })

    describe('_getUpdatedStateFromExpectedClassifications', () => {
      describe('current message classification matches current expectations', () => {
        it('returns new state', () => {
          const fakeContext = {
            currentExpectations: {
              classifications: {
                'foo_bar': 'streamA',
                'baz_qux': 'streamB',
                'biz_bane': 'streamC',
              },
            },
            currentMessageClassificationDisplay: 'baz_qux',
            state: Map(),
            findExpectationMatchingCurrentPart: Flow.prototype.findExpectationMatchingCurrentPart,
            _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
          }
          const result = Flow.prototype._getUpdatedStateFromExpectedClassifications.call(fakeContext)

          expect(result.toJSON()).to.deep.equal({
            streamName: 'streamB',
            stepIndex: 0,
            isFirstRun: false,
            streamStack: [],
          })
        })

        it('returns new state via merge strategy', () => {
          const fakeContext = {
            currentExpectations: {
              classifications: {
                'foo_bar': 'streamA',
                'baz_qux': 'streamB',
                'biz_bane': 'streamC',
              },
            },
            currentMessageClassificationDisplay: 'baz_qux',
            state: Map({foo: 'bar'}),
            findExpectationMatchingCurrentPart: Flow.prototype.findExpectationMatchingCurrentPart,
            _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
          }
          const result = Flow.prototype._getUpdatedStateFromExpectedClassifications.call(fakeContext)

          expect(result.toJSON()).to.deep.equal({
            foo: 'bar',
            streamName: 'streamB',
            stepIndex: 0,
            isFirstRun: false,
            streamStack: [],
          })
        })

        it('does not mutate context state', () => {
          const fakeContext = {
            currentExpectations: {
              classifications: {
                'foo_bar': 'streamA',
                'baz_qux': 'streamB',
                'biz_bane': 'streamC',
              },
            },
            currentMessageClassificationDisplay: 'baz_qux',
            state: Map({stepIndex: 2}),
            findExpectationMatchingCurrentPart: Flow.prototype.findExpectationMatchingCurrentPart,
            _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
          }
          const result = Flow.prototype._getUpdatedStateFromExpectedClassifications.call(fakeContext)

          expect(fakeContext.state.toJS()).to.deep.equal({stepIndex: 2})
        })
      })

      it('returns original state', () => {
        const fakeContext = {
          currentExpectations: {
            classifications: {
              'foo_bar': 'streamA',
              'baz_qux': 'streamB',
              'biz_bane': 'streamC',
            },
          },
          currentMessageClassificationDisplay: 'city',
          state: Map({stepIndex: 2}),
          findExpectationMatchingCurrentPart: Flow.prototype.findExpectationMatchingCurrentPart,
          _getCurrentExpectationsStreamStack: sandbox.stub().returns(List()),
        }
        const result = Flow.prototype._getUpdatedStateFromExpectedClassifications.call(fakeContext)

        expect(fakeContext.state.toJS()).to.deep.equal({stepIndex: 2})
        expect(result.toJS()).to.deep.equal(fakeContext.state.toJS())
      })
    })

    describe('_getUpdatedStateFromClassificationMappings', () => {
      it('returns a state Object', () => {
        const fakeContext = {
          currentMessageClassificationDisplay: 'foo',
          classifications: {
            'foo': 'bar',
          },
          state: Map({}),
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype._getUpdatedStateFromClassificationMappings.call(fakeContext)

        expect(Map.isMap(result)).to.equal(true)
        expect(result.toJS()).to.deep.equal({
          streamName: 'bar',
          stepIndex: 0,
          isFirstRun: false,
        })
      })

      it('returns a state Object with a nested classification', () => {
        const fakeContext = {
          currentMessageClassificationDisplay: 'foo/whatever#mystyle',
          currentMessageClassificationWithoutStyle: 'foo/whatever',
          currentMessageClassificationBaseType: 'foo',
          classifications: {
            'foo': 'bar',
          },
          state: Map({}),
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype._getUpdatedStateFromClassificationMappings.call(fakeContext)

        expect(Map.isMap(result)).to.equal(true)
        expect(result.toJS()).to.deep.equal({
          streamName: 'bar',
          stepIndex: 0,
          isFirstRun: false,
        })
      })

      it('returns a state Object with a nested classification', () => {
        const fakeContext = {
          currentMessageClassificationDisplay: 'foo/whatever#mystyle',
          currentMessageClassificationWithoutStyle: 'foo/whatever',
          currentMessageClassificationBaseType: 'foo',
          classifications: {
            'foo': 'bar',
          },
          state: Map({}),
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype._getUpdatedStateFromClassificationMappings.call(fakeContext)

        expect(Map.isMap(result)).to.equal(true)
        expect(result.toJS()).to.deep.equal({
          streamName: 'bar',
          stepIndex: 0,
          isFirstRun: false,
        })
      })

      it('returns a state Object via merge strategy', () => {
        const fakeContext = {
          currentMessageClassificationDisplay: 'foo',
          classifications: {
            'foo': 'bar',
          },
          state: Map({foo: 'bar'}),
          findClassificationMatchingCurrentPart: Flow.prototype.findClassificationMatchingCurrentPart,
        }
        const result = Flow.prototype._getUpdatedStateFromClassificationMappings.call(fakeContext)

        expect(Map.isMap(result)).to.equal(true)
        expect(result.toJS()).to.deep.equal({
          foo: 'bar',
          streamName: 'bar',
          stepIndex: 0,
          isFirstRun: false,
        })
      })
    })
  })
})
