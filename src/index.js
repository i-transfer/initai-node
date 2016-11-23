'use strict'

const _ = require('lodash')
const jiff = require('jiff')
const Immutable = require('immutable')

const constants = require('./util/constants')
const logger = require('./logger')
const flowRunner = require('./flow/runner')
const VERSION = process.env.VERSION

const isObject = _.isObject
const isString = _.isString

function _setupMessageContext(messageContext) {
  const sender = messageContext.payload.users ? messageContext.payload.users[messageContext.payload.current_conversation.__private_temp_user_id] : null

  return Immutable.fromJS(messageContext.payload)
    .deleteIn(['execution_data'])
    .setIn(['current_conversation', 'messages', 0, 'parts', 0, 'sender'], sender)
}

/**
* @class
* @classdesc An API Client instance
* @param {messageContext} messageContext - The conversation data from the Init.ai API pertaining to the current message turn
**/
function InitClient(messageContext, lambdaContext) {
  if (!messageContext) {
    throw new Error(constants.Errors.INVALID_MESSAGE_CONTEXT)
  }

  if (!lambdaContext) {
    throw new Error(constants.Errors.INVALID_LAMBDA_CONTEXT)
  }

  this._messageResponsePartsQueue = []
  this._executionData = Immutable.fromJS(messageContext.payload.execution_data)
  this._lambdaContext = lambdaContext
  this._messageContext = _setupMessageContext(messageContext)
  this._originalMessageContext = messageContext
  this._originalUsers = messageContext.payload.users
  this._usersToReset = []
}

InitClient.prototype.log = logger.log
InitClient.prototype.logWarning = logger.warn
InitClient.prototype.logError = logger.error

InitClient.prototype._setStreamName = function _setStreamName(streamName) {
  this._streamName = streamName
}

InitClient.prototype.getStreamName = function getStreamName() {
  return this._streamName
}

InitClient.prototype._setStreamStack = function _setStreamStack(streamStack) {
  this._streamStack = streamStack
}

InitClient.prototype.getStreamStack = function getStreamStack() {
  return this._streamStack
}

/**
* @typedef {Object} ClassificationBaseType
* @property {string} value - A string definition of the type's value.
* @property {Number} confidence - A Number, 0-1 representing the type's classification accuracy.
*/

/**
* @typedef {Object} ClassificationSubType
* @property {string} value - A string definition of the type's value.
* @property {Number} confidence - A Number, 0-1 representing the type's classification accuracy.
*/

/**
* The determined intent as inferred from the NLP system.
* @typedef {Object} Classification
* @property {Number} overall_confidence A floating point number representing the overall confidence of the NLP classification
* @property {ClassificationBaseType} base_type See {@link ClassificationBaseType}
* @property {ClassificationSubType} sub_type See {@link ClassificationSubType}
*/

/**
* A specific MessagePart
* @typedef {Object} MessagePart
* @property {string} content - The message text/body.
* @property {string} content_type - The type of message. Currently, the only supported type is 'text'.
* @property {Classification} classification - The resulting classification from the NLP model.
* @property {object} slots - A mapping of individual entities.
* @property {object} sentiment - The overall sentiment derived from the provided message (See details below).
* @property {object} sender - The User representing the user who sent the current message.
*/

/**
 * Retrieve the current message Part for this tuen
 * @returns {MessagePart} messagePart - {@link MessagePart}
 */
InitClient.prototype.getMessagePart = function getMessagePart() {
  const currentMessage = this.getMessage()
  const currentMessagePart = currentMessage.parts[0]

  return currentMessagePart
}

/**
 * Retrieve the current message for this invocation
 * @returns {Message} message - {@link Message}
 */
InitClient.prototype.getMessage = function getMessage() {
  const messageToProcessIndex = this._messageContext.getIn(['current_conversation', 'conversation_message_index_to_process'])
  const messages = this._messageContext.getIn(['current_conversation', 'messages'])
  const currentMessage = messages.get(messageToProcessIndex)

  return currentMessage.toJS()
}

/**
* Retrieve the current message text body
* @returns {string|null} The message body text
*/
InitClient.prototype.getMessageText = function getMessageText() {
  const messagePart = this.getMessagePart()

  switch (messagePart.content_type) {
    case constants.MessageTypes.TEXT:
      return messagePart.content
    case constants.MessageTypes.POSTBACK:
      return messagePart.content.text
    default:
      return null
  }
}

/**
* Retrieve the first slot value with the given entity and no role / default role
* @param {Object} messagePart - The messagePart for looking up the entity
* @param {string} entity - The entity to lookup
* @param {string} [role=generic] - The role to lookup
* @returns {SlotValue|null} The slot value for this entity and role
*/
InitClient.prototype.getFirstEntityWithRole = function getFirstEntityWithRole(messagePart, entity, role) {
  if (!messagePart || !isObject(messagePart)) {
    this.logError('getFirstEntityWithRole: A valid MessagePart (Object) is required. View the docs for more: https://docs.init.ai/docs/client-api-methods#section-getfirstentitywithrole')
    return null
  }

  if (!entity) {
    this.logError('getFirstEntityWithRole: A valid entity (String) is required. View the docs for more: https://docs.init.ai/docs/client-api-methods#section-getfirstentitywithrole')
    return null
  }

  role = role || 'generic'


  const entitiesForRole = this.getEntities(messagePart, entity)

  if (entitiesForRole && entitiesForRole[role]) {
    return entitiesForRole[role][0] || null
  } else {
    return null
  }
}

/**
* Retrieve a map slot values keyed by entity
* @param {Object} messagePart - The messagePart for looking up the entity
* @param {string} entity - The entity to lookup
* @returns {SlotValues|null} The slot values corresponding to this entity
*/
InitClient.prototype.getEntities = function getEntities(messagePart, entity) {
  if (!messagePart || !isObject(messagePart)) {
    this.logError('getEntities: A valid MessagePart (Object) is required. View the docs for more: https://docs.init.ai/docs/client-api-methods#section-getentities')
    return null
  }

  if (!entity) {
    this.logError('getEntities: A valid entity (String) is required. View the docs for more: https://docs.init.ai/docs/client-api-methods#section-getentities')
    return null
  }

  const slotsForEntity = messagePart.slots[entity]

  if (!slotsForEntity || !slotsForEntity.values_by_role) {
    return null
  }

  return slotsForEntity.values_by_role || null
}

/**
* Adds an image to the list of message parts to to be sent to the user.
* @param {string} imageUrl - The absolute URL for an image
* @param {string} alternativeText – Fallback text to be rendered on platforms where images are not supported
* @returns {void}
*/
InitClient.prototype.addImageResponse = function addImageResponse(imageUrl, alternativeText) {
  if (!imageUrl) {
    throw new Error(constants.Errors.INVALID_RESPONSE_IMAGE)
  }

  this._messageResponsePartsQueue.push({
    content_type: constants.ResponseTypes.IMAGE,
    content: {
      image_url: imageUrl,
      alternative_text: alternativeText,
    },
    to: this.getMessagePart().sender.id,
    to_type: constants.IdTypes.APP_USER_ID,
  })
}

/**
* Retrieve the payload from a Facebook messenger postback
* @returns {object|null} postbackData – An arbitrary data payload from Facebook messenger
*/
InitClient.prototype.getPostbackData = function getMessageText() {
  const messagePart = this.getMessagePart()

  switch (messagePart.content_type) {
    case constants.MessageTypes.POSTBACK:
      return messagePart.content.data
    default:
      return null
  }
}

/**
* Queues up a response using a pre-built response model constructed via training data. Simply provide the respone name as the first argument and then data with wcich to hydrate that response template (optional).
* @param {string} responseName – The name of the slot (entity) to which this response is related.
* @param {object} responseData - The data used to populate your response. Where each key maps to a slot name.
* @returns {void}
* @example <caption>Example usage:</caption>
* client.addResponse('provide_weather', {foo: 'bar'})
* client.addResponse('provide_weather', {condition: ['bar', 'baz', 'ben']})
* client.addResponse('provide_weather', {'string/condition': 'sunny'})
* client.addResponse('provide_weather/current', {'string/condition': 'sunny'})
*/
InitClient.prototype.addResponse = function addResponse(responseName, responseData) {
  if (!isString(responseName)) {
    throw new Error(constants.Errors.INVALID_RESPONSE_NAME)
  }

  if (!InitClient.responseTemplatePrefixTest.test(responseName)) {
    responseName = `${constants.ResponseTemplateTypes.RESPONSE_NAME}${responseName}`
  }

  this._messageResponsePartsQueue.push({
    content_type: constants.ResponseTypes.PREPARED_OUTBOUND,
    content: {
      response_name: responseName,
      response_data: responseData || null,
    },
    to: this.getMessagePart().sender.id,
    to_type: constants.IdTypes.APP_USER_ID,
  })
}

/**
* @deprecated since version 0.1.0
* @param {string} responseMessage – The message to send
* @returns {void}
*/
InitClient.prototype.addTextResponse = function addTextResponse(responseMessage) {
  if (!responseMessage) {
    throw new Error(constants.Errors.INVALID_RESPONSE_MESSAGE)
  }

  this._messageResponsePartsQueue.push({
    content_type: constants.ResponseTypes.TEXT,
    content: responseMessage,
    to: this.getMessagePart().sender.id,
    to_type: constants.IdTypes.APP_USER_ID,
  })
}

/**
* @param {CarouselPayload} payload – The payload to populate a carousel
* @description Adds a payload to populate a carousel
* @returns {void}
*/
InitClient.prototype.addCarouselListResponse = function addCarouselListResponse(payload) {
  if (!payload) {
    throw new Error('Carousel List definition is required')
  }

  if (!Array.isArray(payload.items)) {
    throw new Error('items is required is required and must be an array')
  }

  if (payload.items.length < 0 && payload.items.length > 10) {
    throw new Error('items must contain between 1 and 10 elements')
  }

  const supportedItemKeys = {
    'title': true,
    'description': true,
    'media_url': true,
    'media_type': true,
    'actions': true,
  }

  const supportedActionKeys = {
    'type': true,
    'text': true,
    'uri': true,
    'payload': true,
    'metadata': true,
  }

  payload.items.forEach(item => {
    if (!item.title || typeof item.title !== 'string' || item.title.length > 80) {
      throw new Error('title is required to be string, less than 80 characters long')
    }

    if (!item.actions || !Array.isArray(item.actions)) {
      throw new Error('actions is required element of items and must be an array')
    }

    if (item.actions.length > 3) {
      throw new Error('actions cannot contain more than three elements')
    }

    Object.getOwnPropertyNames(item).forEach(itemProp => {
      if (!supportedItemKeys[itemProp]) {
        throw new Error('unsupported property for item: ' + itemProp)
      }
    })

    item.actions.forEach(action => {
      Object.getOwnPropertyNames(action).forEach(actionProp => {
        if (!supportedActionKeys[actionProp]) {
          throw new Error('unsupported property for action: ' + actionProp)
        }
      })

      if (!action.text || typeof action.text !== 'string' || action.text.length > 20) {
        throw new Error('action text is required to be string, less than 20 characters long')
      }

      switch (action.type) {
        case constants.ActionTypes.POSTBACK:
          if (!action.payload || typeof action.payload !== 'object') {
            throw new Error('action payload is required for postback actions and must be an object')
          }

          if (typeof action.payload.stream !== 'string') {
            throw new Error('action payload must have a stream value that is a string')
          }

          if (typeof action.payload.data === 'undefined') {
            throw new Error('action payload must have a data value')
          }

          if (action.payload.version !== '1') {
            throw new Error('action payload must have a version value equal to the string \'1\'')
          }

          break
        case constants.ActionTypes.LINK:
          if (!action.uri || typeof action.uri !== 'string') {
            throw new Error('uri is required for link actions')
          }
          break
        default:
          throw new Error('action type must be either \'link\' or \'postback\'')
      }
    })
  })

  this._messageResponsePartsQueue.push({
    content_type: constants.ResponseTypes.CAROUSEL_LIST,
    content: {
      version: '1',
      payload: payload,
    },
    to: this.getMessagePart().sender.id,
    to_type: constants.IdTypes.APP_USER_ID,
  })
}

/** Queues up a response using a text template.
* @param {string} templateString – The name of the desired template.
* @param {object} templateData - The data used to populate your template.
* @returns {void}
*/
InitClient.prototype.addTextTemplateResponse = function addTextTemplateResponse(templateString, templateData) {
  if (!isString(templateString)) {
    throw new Error(constants.Errors.INVALID_TEMPLATE_STRING)
  }

  if (!isObject(templateData)) {
    throw new Error(constants.Errors.INVALID_TEMPLATE_DATA)
  }

  this._messageResponsePartsQueue.push({
    content_type: constants.ResponseTypes.TEXT_TEMPLATE,
    content: {
      template_type: 'go',
      template_string: templateString,
      template_data: templateData,
    },
    to: this.getMessagePart().sender.id,
    to_type: constants.IdTypes.APP_USER_ID,
  })
}

/**
* Appends the provided stream to the queue of expectations for subsequent inbound messages
* @param {string} streamName - A reference the the stream name to be queued
* @param {array} classifications - TBD...
* @returns {void}
*/
InitClient.prototype.expect = function expect(streamName, classifications) {
  const currentExpectations = {}
  currentExpectations[streamName] = classifications

  logger.log('Recording expection of stream', streamName, 'to receive classifications:', classifications)

  this.updateConversationState({
    currentExpectations: currentExpectations,
    currentExpectationsStreamStack: this.getStreamStack(),
  })
}

/**
* Retrieve an copy of the {@link ConversationModel}. This object is a serialized representation of an immutable Map held internally by the client instance. To set or update values on this Object, see {@link updateConversationState}.
* @returns {ConversationModel}
*/
InitClient.prototype.getConversation = function getConversation() {
  return this._messageContext.get('current_conversation').toJS()
}

/**
* Retrieve a copy of the conversation state object. As with {@link getConversation}, this object is a serialized representation of an immutable Map held internally by the client instance. To set or update values on this Object, see {@link updateConversationState}.
* @returns {ConversationState}
*/
InitClient.prototype.getConversationState = function getConversationState() {
  return this._messageContext.getIn(['current_conversation', 'state'], {}).toJS()
}

/**
* Allows the writing of new values and overwriting of previously set values.
* The Client API uses Immutable.js under the hood. The ConversationState is stored as an immutable Map. As such, many of the constructs for setting values are accessible via the documentation in that library.

This method implements a <a href="https://facebook.github.io/immutable-js/docs/#/Map/mergeDeep">deep merge strategy</a> where any values/Object provided in this structure will extend existing values and new values will be merged in. If you do not wish to merge values and would prefer to overwrite them completely, use the keymap strategy discussed below.
* @param {object|string} objectOrKey - The key to set on the Conversation State for later lookup (this can be any JS type, but usually is a String). If this key already exists, the associated value will be used to overwrite the currently set value.
* @param {any} value - The value associated with the key
* @example <caption>Using an object literal</caption>
* client.updateConversationState({foo: {bar: 'baz'})
* @example <caption>Using a keypath and value</caption>
* client.updateConversationState('foo', {bar: 'baz'})
*/
InitClient.prototype.updateConversationState = function updateConversationState(objectOrKey, value) {
  if (isObject(objectOrKey) && !value) {
    this._messageContext = this._messageContext.updateIn(
      ['current_conversation', 'state'],
      function (map) {
        return map.mergeDeep(objectOrKey)
      }
    )
  } else {
    this._messageContext = this._messageContext.setIn(
      ['current_conversation', 'state'].concat(objectOrKey),
      value
    )
  }

  return this._messageContext.toJS()
}

/**
* Reset the conversation state to an empty Immtuable Map.
*/
InitClient.prototype.resetConversationState = function resetConversationState() {
  this._messageContext = this._messageContext.setIn(
    ['current_conversation', 'state'],
    Immutable.Map()
  )
}

/**
 * Fetch a collection of User objects.
This array is a serialized representation of an <a href="https://facebook.github.io/immutable-js/docs/#/List">Immutable List</a> held internally by the client instance. Use the {@link updateUser} method to operate on this list.
*
* @returns {Users} Users
*/
InitClient.prototype.getUsers = function getUsers() {
  return Immutable.Map(this._messageContext.get('users')).toJS()
}

/**
* Update data for a specific user
* @param {string} userId - The id of the user
* @param {any} key - The key to set on the User model for later lookup (this can be any JS type, but usually is a String). If this key already exists, the associated value will be used to overwrite the currently set value.
* @param {any} value - The value associated with the key
* @example <caption>Using key, value pair</caption>
* client.updateUser('123', 'name', 'Tony')
* @example <caption>Using an object literal</caption>
* client.updateUser('123', {name: 'Tony'})
* @example <caption>Using a <a href="https://facebook.github.io/immutable-js/docs/#/Map/setIn">keypath</a> and value</caption>
* client.updateUser('123', ['name', 'first'], 'Tony')
*/
InitClient.prototype.updateUser = function updateUser(id, objectOrKey, value) {
  if (!id || !this.getUsers()[id]) {
    throw new Error(constants.Errors.INVALID_USER_ID_PROVIDED)
  }

  if (isObject(objectOrKey) && !value) {
    this._messageContext = this._messageContext.updateIn(
      ['users', id],
      function (map) {
        return map.mergeDeep(objectOrKey)
      }
    )
  } else {
    this._messageContext = this._messageContext.setIn(
      ['users', id].concat(objectOrKey),
      value
    )
  }

  return this.getUsers()[id]
}

/**
* Reset the state of a particlar User by providing an id or all users by leaving the arguments blank.
* @param {string|null} id - The id of user to reset. If left blank, all users will be reset
*/
InitClient.prototype.resetUser = function resetUser(id) {
  if (id) {
    if (isString(id) && this.getUsers()[id]) {
      this._usersToReset.push(id)
    }
  } else if (id === undefined) {
    this._usersToReset = Object.keys(this._originalUsers).map(function (userId) {
      return userId
    })
  }
}

/**
* Get data about the current application
*/
InitClient.prototype.getCurrentApplication = function getCurrentApplication() {
  return this._messageContext.get('current_application').toJS()
}

/**
* Retrieve environment variables set on the application
* @returns {object}
*/
InitClient.prototype.getCurrentApplicationEnvironment = function getCurrentApplicationEnvironment() {
  return this._messageContext.get('current_application').get('environment').toJS()
}

/**
 * Create a <a href="http://docs.init.ai/guides/logic.html#steps">Step</a> for a <a href="http://docs.init.ai/guides/logic.html#managing-conversation-flow">Conversation Flow</a>.
* @param {StepDefinition}
* @returns {object} Step - An Object containing the configured methods for state management.
 */
InitClient.prototype.createStep = function createStep(methods) {
  return Object.assign({}, {
    expects: function expects() {
      return []
    },

    extractInfo: function extractInfo() {},

    prompt: function prompt() {},

    next: function next() {
      return undefined
    },

    satisfied: function satisfied() {
      return true
    },
  }, methods)
}


/**
 * Initiate a Flow sequence.
* @param {FlowDefinition}
* @example
* client.runFlow({
  classifications: {},
  eventHandlers: {},
  streams: {
    streamName: [step1, step2],
    otherStreamName: [step2],
    main: 'otherStreamName',
    end: [help],
  },
})
 */
InitClient.prototype.runFlow = function _runFlow(flowDefinition) {
  flowRunner.run(flowDefinition, this)
}

/**
* Signal that you have completed processing this message and would like to send your reply (or queued replies) the the user.
* You should call this only when you are ready to immediately terminate your message processing function.
* @returns {void}
*/
InitClient.prototype.done = function done() {
  this._lambdaContext.succeed({
    version: VERSION,
    payload: {
      execution_id: this._executionData.get('execution_id'),
      conversation_state: this.getConversationState(),
      conversation_state_patch: jiff.diff(
        this._originalMessageContext.payload.current_conversation.state,
        this.getConversationState()
      ),
      users_patch: jiff.diff(
        this._originalUsers,
        this.getUsers()
      ),
      reset_users: this._usersToReset,
      messages: [
        {parts: this._messageResponsePartsQueue},
      ],
    },
  })
}

InitClient.constants = InitClient.prototype.constants = Immutable.fromJS(constants).toJS()

InitClient.responseTemplatePrefixTest = new RegExp(`^${constants.ResponseTemplateTypes.RESPONSE_NAME}`)

module.exports = {
  InitClient,
  create(messageContext, lambdaContext) {
    return new InitClient(messageContext, lambdaContext)
  },
}
