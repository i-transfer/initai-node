'use strict'

const Map = require('immutable').Map
const isString = require('lodash').isString
const isStream = require('../is-stream')

module.exports = function getNextStep(step, streams, previousState) {
  const next = step.next()
  let nextState = Map(previousState)

  // Check if the "next" item is a defined "stream"
  //
  // If it is not, then move to the next step in the stream
  if (next && isStream(streams, next)) {
    // Check if we are still within the current stream. If so,
    // move to the next step in the stream
    //
    // Else, if it is a new stream, initialize that stream
    if (next === previousState.get('streamName')) {
      let stepIndex = previousState.get('stepIndex')

      nextState = previousState.merge({
        stepIndex: ++stepIndex,
      })
    } else {
      let streamStack = previousState.get('streamStack')
      streamStack = streamStack.push(
        Map({
          streamName: previousState.get('streamName'),
          stepIndex: previousState.get('stepIndex') + 1,
        })
      )
      nextState = previousState.merge({
        streamName: next,
        stepIndex: 0,
        streamStack: streamStack,
      })
    }
  } else {
    let stepIndex = previousState.get('stepIndex')

    nextState = previousState.merge({
      stepIndex: ++stepIndex,
    })
  }

  // Check if we have exceeded the length of the steps array
  if (
    nextState.get('stepIndex') >= streams[nextState.get('streamName')].length
  ) {
    let streamStack = previousState.get('streamStack')
    if (streamStack.count() > 0) {
      const previousStreamState = streamStack.last()
      streamStack = streamStack.pop() // this is a List!
      nextState = previousState.merge({
        streamName: previousStreamState.get('streamName'),
        stepIndex: previousStreamState.get('stepIndex') + 1,
        streamStack: streamStack,
      })
    } else {
      streamStack = streamStack.push(
        Map({
          streamName: previousState.get('streamName'),
          stepIndex: previousState.get('stepIndex') + 1,
        })
      )
      nextState = previousState.merge({
        streamName: 'end', // TODO: Make this a constant
        stepIndex: 0,
        streamStack: streamStack,
      })
    }
  } else {
    let streamName = nextState.get('streamName')
    let stepIndex = nextState.get('stepIndex')
    let steps = streams[streamName]
    let nextStepOrStreamName = steps[stepIndex]

    if (isStream(streams, nextStepOrStreamName)) {
      let streamStack = previousState.get('streamStack')
      streamStack = streamStack.push(
        Map({
          streamName: previousState.get('streamName'),
          stepIndex: previousState.get('stepIndex') + 1,
        })
      )
      nextState = previousState.merge({
        streamName: nextStepOrStreamName,
        stepIndex: 0,
        streamStack: streamStack,
      })
    } else if (!nextStepOrStreamName || isString(nextStepOrStreamName)) {
      throw new Error(
        JSON.stringify(nextStepOrStreamName) + ' is not a valid stream'
      )
    }
  }

  return nextState
}
