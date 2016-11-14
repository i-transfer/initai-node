'use strict'

const Immutable = require('immutable')
const isFunction = require('lodash').isFunction
const runStep = require('./stream/step/run')
const logger = require('../../src/logger')
const extractInfoFromStreamSteps = require('./stream/step/info-extractor')
const getClassificationDisplay = require('../getClassificationDisplay')
const getClassificationBaseType = require('../getClassificationBaseType')
const getClassificationWithoutStyle = require('../getClassificationWithoutStyle')
const Map = Immutable.Map
const List = Immutable.List

function getInitialState(streams) {
  return {
    streamName: streams.main,
    stepIndex: 0,
    isFirstRun: true,
    currentlyActiveStep: null,
    streamStack: List(),
  }
}

function Flow(definition, client) {
  const messagePartClassification = client.getMessagePart().classification

  this.streams = definition.streams
  this.classifications = definition.classifications || {}
  this.client = client
  this.currentMessageClassificationDisplay = getClassificationDisplay(messagePartClassification)
  this.currentMessageClassificationBaseType = getClassificationBaseType(messagePartClassification)
  this.currentMessageClassificationWithoutStyle = getClassificationWithoutStyle(messagePartClassification)
  this.state = Map(getInitialState(this.streams))
  this.runStep = runStep// stepRunner(client, this.streams)
  this.extractor = extractInfoFromStreamSteps(this.streams)
  this.autoResponses = definition.autoResponses || {}
  this.eventHandlers = definition.eventHandlers || {}

  const senderRolesToProcess = (
    definition.senderRolesToProcess || [this.client.constants.ParticipantRoles.END_USER]
  ).reduce((roles, role) => {
    roles[role] = true
    return roles
  }, {})

  if (this.isValidSenderRole(this.client.getMessage(), senderRolesToProcess)) {
    this.initialize()
  } else {
    this.client.done()
  }
}

Flow.prototype.isValidSenderRole = function isValidSenderRole(currentMessage, rolesToProcess) {
  if (currentMessage.sender_role) {
    return Boolean(
      rolesToProcess &&
      rolesToProcess[currentMessage.sender_role]
    )
  } else {
    return true
  }
}

Flow.prototype.initialize = function initialize() {
  const currentMessagePart = this.client.getMessagePart()
  const currentMessagePartContentType = currentMessagePart.content_type

  switch (currentMessagePartContentType) {
    case this.client.constants.MessageTypes.EVENT:
      logger.log('Processing event message part')
      this.handleEvent(currentMessagePart)

      break
    case this.client.constants.MessageTypes.IMAGE:
      logger.log('Processing image message part')

      this.state = this.runFirstStep()
      this.extractInfoFromStreamSteps()
      this.runStateMutations()
      this.runLastStep()

      break
    case this.client.constants.MessageTypes.POSTBACK:
      logger.log('Processing postback message part as text')
      // eslint-disable-line no-fallthrough
    case this.client.constants.MessageTypes.TEXT:
      logger.log('Processing text message part')

      this.state = this.runFirstStep()
      this.extractInfoFromStreamSteps()
      this.runStateMutations()
      this.runLastStep()

      break
    default:
      logger.log('Unsupported message part content type:', currentMessagePartContentType)
  }
}

Flow.prototype.runFirstStep = function runFirstStep() {
  return this.runStep(this.state, this.streams, this.client)
}

Flow.prototype.extractInfoFromStreamSteps = function _extractInfoFromStreamSteps() {
  this.extractor(this.client.getMessagePart())
}

Flow.prototype.runStateMutations = function runStateMutations() {
  if (this.state.get('currentlyActiveStep')) {
    this.currentlyActiveStep = this.state.get('currentlyActiveStep')

    if (
      this.currentlyActiveStep &&
      isFunction(this.currentlyActiveStep.expects) &&
      this.currentlyActiveStep.expects().indexOf(this.currentMessageClassificationDisplay) !== -1
    ) {
      logger.log('Prompt after expectation assignment override')

      // TODO: this may be asynchronously returned
      this.currentlyActiveStep.prompt()

      // Abort further initialization since prompt should terminate the flow
      // TODO: There is a better pattern for this
      return
    }
  }

  // Fetch an Object that will provide the currently defined
  // "strean" and "classifications"
  this.currentExpectations = this._getCurrentExpectations()

  // TODO: This should probably happen immediately
  const messagePartContent = this.client.getMessagePart().content

  if (
    messagePartContent &&
    this.client.getMessagePart().content_type === this.client.constants.MessageTypes.TEXT &&
    (
      messagePartContent.trim() === '!RESET' ||
      messagePartContent.trim() === '/reset'
    )
  ) {
    logger.log('Resetting user')
    this.client.resetUser()

    // TODO: Emit signal to end process
    this.client.done()
    return
  }

  const classificationMatch = (
    this.classifications[this.currentMessageClassificationDisplay] ||
    this.classifications[this.getClassificationWithoutStyle] ||
    this.classifications[this.currentMessageClassificationBaseType]
  )
  logger.log('Matching classification mapping:', classificationMatch)

  if (this.client.getMessagePart().content_type === this.client.constants.MessageTypes.POSTBACK) {
    logger.log('Processing postback:', this.client.getMessagePart().content)
  }

  // This is where the default classification mappings are overridden.
  // If the previous invocation had set expected classifications, route based on those before attempting the default routing procedures
  if (
    this.currentExpectations.classifications && this.findExpectationMatchingCurrentPart()
  ) {
    this.state = this._getUpdatedStateFromExpectedClassifications()
    this.client.updateConversationState('currentExpectations', null)
    this.client.updateConversationState('lastExpectations', this.currentExpectations)
  } else if (this.autoRespond(this.client.getMessagePart().predicted_next_message)) { // autoResponder will return true if processing should stop
    // autoresponder sent a message or otherwise stopped processing
    logger.log('autoResponder stopped processing')

    // TODO: Emit signal to end process
    // this.client.done()
  } else if (
    this.client.getMessagePart() &&
    this.client.getMessagePart().content_type === this.client.constants.MessageTypes.POSTBACK &&
    this.streams[this.client.getMessagePart().content.stream]
  ) {
    logger.log('Got postback that directs to stream:', this.client.getMessagePart().content.stream)

    this.state = this.state.merge({
      streamName: this.client.getMessagePart().content.stream,
      stepIndex: 0,
      isFirstRun: false,
    })
  } else if (
    this.findClassificationMatchingCurrentPart()
  ) {
    // Route via the default classification mappings provided in the developer's declaration
    this.state = this._getUpdatedStateFromClassificationMappings()
  } else if (!this.currentlyActiveStep && this.currentExpectations.stream) {
    // If there is not a currently active "step" defined but there is a defined "stream"m
    // route to the beginning of that stream
    this.state = this.state.merge({
      streamName: this.currentExpectations.stream,
      stepIndex: 0,
      isFirstRun: false,
    })

    // Run the step in the context of the current "state". This is an initial, naieve, implementation of conversation branching logic to satsify the immediate cases.
    //
    // NOTE: if this were written as a "reducer" type function, we could return from here
    // and apply conditional logic in the next run
    //
    // TODO: runStep should be able to be run asynchronously and the following code
    // should exec in callback/promise resolver
    this.runStep(this.state, this.streams, this.client)

    if (this.state.get('ranFallback')) {
      logger.log('Ran expectation fallback')
    } else {
      logger.log('Did not run expectation fallback, routing to end')
      this.state = this.state.merge({
        streamName: 'end',
        stepIndex: 0,
        isFirstRun: false,
      })
    }
  } else if (!this.currentlyActiveStep) {
    logger.log('Routing to end')
    this.state = this.state.merge({
      streamName: 'end',
      stepIndex: 0,
      isFirstRun: false,
    })
  } else {
    this.state = Map(getInitialState(this.streams))
    this.state = this.state.set('isFirstRun', false)
  }
}

Flow.prototype.findExpectationMatchingCurrentPart = function findExpectationMatchingCurrentPart() {
  return (
    this.currentExpectations.classifications[this.currentMessageClassificationDisplay] ||
    this.currentExpectations.classifications[this.getClassificationWithoutStyle] ||
    this.currentExpectations.classifications[this.currentMessageClassificationBaseType]
  )
}

Flow.prototype.findClassificationMatchingCurrentPart = function findClassificationMatchingCurrentPart() {
  return (
    this.classifications[this.currentMessageClassificationDisplay] ||
    this.classifications[this.getClassificationWithoutStyle] ||
    this.classifications[this.currentMessageClassificationBaseType]
  )
}

Flow.prototype.runLastStep = function runLastStep() {
  this.runStep(this.state, this.streams, this.client)
}

Flow.prototype.handleEvent = function handleEvent(eventMessagePart) {
  const eventType = eventMessagePart.content.event_type
  const handlersConfig = this.eventHandlers || {}
  const handler = (
    handlersConfig[eventType] ||
    handlersConfig['*']
  )

  if (handler) {
    logger.log('Found matching event handler:', handler)
    handler(eventType, eventMessagePart.content.payload)
    // TODO maybe return retValue?
  } else {
    logger.log('Did not find matching event handler.')
  }
}

Flow.prototype.autoRespond = function autoRespond(prediction) {
  logger.log('Running autoRespond')

  if (!prediction) {
    return false
  }

  const predictedDirection = prediction.direction.value
  const predictedBaseType = prediction.base_type.value
  const predictedSubType = prediction.sub_type.value

  try {
    logger.log('Prediction:', JSON.stringify(prediction, null, 2))
  } catch (e) {
    logger.log('Prediction:', prediction)
  }

  if (predictedDirection === 'input') {
    const continuationConfig = this.autoResponses._continuation

    logger.log('Another message from the user is expected')
    logger.log('continuationConfig:', continuationConfig)

    if (continuationConfig && continuationConfig.minimumConfidence && continuationConfig.minimumConfidence > prediction.overall_confidence) {
      logger.log('Not confident enough in continuation')
      return false
    } else if (continuationConfig && continuationConfig.ignore) {
      logger.log('Ignoring message because it is expected user will continue')

      return true
    }

    logger.log('Another message from the user is expected, but processing will continue')
  } else if (predictedDirection === 'output') {
    logger.log('An output was predicted')

    const predictionConfig = (
      this.autoResponses[predictedBaseType + '/' + predictedSubType] ||
      this.autoResponses[predictedBaseType]
    )

    if (!predictionConfig) {
      logger.log('Auto response is not configured for the predicted response')
      return false
    } else {
      logger.log('predictionConfig exists:', predictionConfig)
    }

    if (!prediction.predicted_response || !prediction.predicted_response.auto_fill_capable) {
      logger.log('Predicted response is not capable of being auto filled')
      return false
    }

    let minimumConfidence = (predictionConfig && predictionConfig.minimumConfidence) || 0.5

    if (minimumConfidence > prediction.overall_confidence) {
      logger.log('Prediction response confidence of', prediction.overall_confidence, 'did not meet minimum threshold of', minimumConfidence)
      return false
    }

    let responseName = 'app:response:name:' + predictedBaseType
    if (predictedSubType !== '') {
      responseName += '/' + predictedSubType
    }

    // TODO: This introduces a side effect to an already difficult to reason about and
    // tough to test method. It should be broken out and this pattern should be re-evaluated
    logger.log('Automatically sending predicted response:', responseName)
    this.client.addResponse(responseName, {})

    return true
  }

  return false
}

Flow.prototype._getCurrentExpectations = function _getCurrentExpectations() {
  let stream
  let currentExpectations = this.client.getConversationState().currentExpectations

  if (currentExpectations) {
    logger.log('Found expectations on conversation state:', currentExpectations)
    stream = Object.keys(currentExpectations)[0]

    if (stream) {
      return currentExpectations[stream].reduce((accum, classification) => {
        accum.classifications[classification] = stream
        return accum
      }, {
        stream,
        classifications: {},
      })
    }
  }

  logger.log(
    'Did not find expectations on conversation state:',
    this.client.getConversationState()
  )
  return {}
}

Flow.prototype._getCurrentExpectationsStreamStack = function _getCurrentExpectationsStreamStack() {
  return this.client.getConversationState().currentExpectationsStreamStack || List()
}

Flow.prototype._getUpdatedStateFromExpectedClassifications = function _getUpdatedStateFromExpectedClassifications() {
  const matchedStreamName = (
    this.findExpectationMatchingCurrentPart()
  )
  const currentExpectationsStreamStack = this._getCurrentExpectationsStreamStack()

  return (
    matchedStreamName
  ) ? (
    this.state.merge({
      streamName: matchedStreamName,
      stepIndex: 0,
      isFirstRun: false,
      streamStack: currentExpectationsStreamStack,
    })
  ) : this.state
}

Flow.prototype._getUpdatedStateFromClassificationMappings = function _getUpdatedStateFromClassificationMappings() {
  const matchedStreamName = (
    this.findClassificationMatchingCurrentPart()
  )
  return this.state.merge({
    streamName: matchedStreamName,
    stepIndex: 0,
    isFirstRun: false,
  })
}

module.exports = {
  Flow,
  run(flowDefinition, client) {
    return new Flow(flowDefinition, client)
  },
}
