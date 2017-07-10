'use strict'

const _ = require('lodash')
const isStream = require('../is-stream')
const getNextStep = require('./get-next')
const getCurrentlyActiveStep = require('./get-currently-active')
const logger = require('../../../logger')

const isFunction = _.isFunction

function runStepAndGetNewState(state, streams, client) {
  const currentlyActiveStep = getCurrentlyActiveStep(
    streams[state.get('streamName')],
    state
  )

  if (!currentlyActiveStep) {
    return state
  }

  client._setStreamName(state.get('streamName'))
  client._setStreamStack(state.get('streamStack'))

  // If the currentlyActiveStep is a pointer to a stream,
  // initialize running that stream
  if (isStream(streams, currentlyActiveStep)) {
    return runStepAndGetNewState(
      state.merge({
        streamName: currentlyActiveStep,
        stepIndex: 0,
      }),
      streams,
      client
    )
  }

  // If the current step is satisfied, run the next step
  //
  // Else determine how to "satsify it"
  if (currentlyActiveStep.satisfied()) {
    return runStepAndGetNewState(
      getNextStep(currentlyActiveStep, streams, state),
      streams,
      client
    )
  } else {
    if (state.get('isFirstRun')) {
      currentlyActiveStep.extractInfo(client.getMessagePart())
      state = state.set('currentlyActiveStep', currentlyActiveStep)
    } else if (state.get('runFallback')) {
      if (isFunction(currentlyActiveStep.fallback)) {
        currentlyActiveStep.fallback()
        state = state.set('ranFallback', true)
      } else {
        // No fallback defined. Error?
      }
    } else {
      let promptFn = currentlyActiveStep.prompt
      let promptHandler = promptAction => {
        let proceedFn = () => {
          logger.log(
            'Received init.proceed instruction from stream',
            state.get('streamName'),
            'step number',
            state.get('stepIndex')
          )

          let newStep = getNextStep(currentlyActiveStep, streams, state)
          logger.log(
            'After init.proceed, found new step?',
            Boolean(newStep),
            ':',
            newStep
          )

          runStepAndGetNewState(newStep, streams, client)
        }

        switch (promptAction) {
          case 'init.proceed':
            proceedFn()
            break
          default:
            if (promptAction) {
              if (isStream(streams, promptAction)) {
                logger.log(
                  'Prompt from stream',
                  state.get('streamName'),
                  'step number',
                  state.get('stepIndex'),
                  'returned to route to stream:',
                  promptAction
                )
                runStepAndGetNewState(
                  state.merge({
                    streamName: promptAction,
                    stepIndex: 0,
                  }),
                  streams,
                  client
                )
              } else {
                logger.log(
                  'Prompt from stream',
                  state.get('streamName'),
                  'step number',
                  state.get('stepIndex'),
                  'returned to route to INVALID stream:',
                  promptAction
                )
              }
            } else {
              logger.log(
                'Prompt from stream',
                state.get('streamName'),
                'step number',
                state.get('stepIndex'),
                'did not return next instructions'
              )
            }
        }
      }

      // Handle async prompt
      if (promptFn.length === 1) {
        promptFn(promptHandler)
      } else {
        promptHandler(promptFn())
      }
    }
  }

  return state
}

module.exports = runStepAndGetNewState
