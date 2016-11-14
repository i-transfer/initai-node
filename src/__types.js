/**
* @typedef {object} ConversationModel
* @property {string} id - The databse id of the current conversation
* @property {array} messages - A collection of messages that have occurred in the lifespan of the conversation. See {@link MessagePart} for the structure of these Objects.
* @property {object} state - A representation of "stateful" data and values used to contextualize the conversation flow
*/

/**
* @typedef {object} ConversationState
* @description The conversational state model. This Object is writable via {@link updateConversationState} and as such can take any shape you would like.
*/

/**
* @typedef messageContext
* @description tbd...
*/

/**
* @typedef {object} CarouselPayloadItemAction
* @description A description of a certain action for a carousel item
* @property needs description...
*/

/**
* @typedef {object} CarouselPayloadItem
* @description Data per carousel item
* @property {string} title – The title for each carousel "slide"
* @property {string} description – The description for the current slide
* @property {string} media_url - An absolute URL for the media to display
* @property {string} media_type - The type of media for this carousel "slide"
* @property {array} actions – A list of {@link CarouselPayloadItemAction}
*/

/**
* @typedef {Object} CarouselPayload
* @description Data to popuplate a carousel
* @property {array} items - A list of {@link InitClient-CarouselPayloadItem} to add (max 10)
*/

/**
* The default User object provided to your function contains:
* @typedef Users
* @property {string} app_id - The id of the current appA
* @property {string} id - The user id
* @property {string} platform_user_id - User's init.ai id
* @property {string} remote_id - The id associating this user with an external service (such as Twilio)
* @property {string} first_name - The user's first name
* @property {string} last_name - The user's last name
* @property {object} metadata - By default, this is provided as an empty Object for you to store arbitrary user data
* @property {string} created_at - A timestamp to denote when the user was created
* @property {string} updated_at - A timestamp to denote the last update to the user
*/

/**
* @typedef StepDefinition
* @description Overrides for any of the default step methods (`extractInfo`, `next`, `satisfied`, and `prompt`).
* @property {function} satisfied - A function expected to return a `Boolean</code></pre>
* @property {Function} prompt - Function to be executed if `satisfied` returns false.<br />If your prompt function needs to be asynchronous, you must define it to accept a callback as the first and only argument. You must either:<br /><ul><li>call `client.done()` from within your asynchronous code when you are ready to return a message or update conversation state, ending execution.</li><li>invoke the callback Init provides to have processing continue to the next step in the Flow</li></ul>
* @property {Function} extractInfo - A function used to extract a slot value from a message. This function is provided a MessagePart as an argument.
* @property {Function} next - A Step may redirect the conversation to another Stream if desired. It may do so by defining a next function function and returning name of the Stream to go to next.
*/

/**
* @typedef FlowDefinition
* @description A Flow is an object that defines how the app handles the user's navigation through a conversation. This object is constructed using a combination of the following keys:
* @property {object} [classifications] - An object mapping classification designations to <a href="http://docs.init.ai/reference/guides/logic.md#streams">Streams</a>.
* @property {object} [eventHandlers] - An object mapping events to specific handlers.<br />Read more about <a href="http://docs.init.ai/guides/logic.html#handling-an-event">Event Handlers</a>.
* @property {object} [streams] -An object mapping streams to collections of <a href="http://docs.init.ai/guides/logic.html#steps">Steps</a>.
* @example
* const flowDefinition = {
  classifications: {
    'check_weather': 'checkWeather'
  },
  eventHandlers: {
    '*': handleEvent,
  },
  streams: {
    checkWeather: [getLocation],
    getLocation: [getState, getCity, getAddress, confirmAddress],
    getPayment: [collectCardNumber, collectExpiration],
    checkout: ['getLocation', 'getPayment', sendReceipt],
    selectProduct: [...],
    placeOrder: [selectProduct, 'checkout'],
    main: 'placeOrder',
    end: [help],
  },
}

client.runFlow(flowDefinition)
*/

/**
* A specific Message
* @typedef {Object} Message
* @property {string} sender_role - The role in the conversation of the entity that sent the message
* @property {array<MessagePart>} parts - The parts of the current message. Currently only one part is returned even the current message has more than one part.
*/

/**
* @typedef ResponseStatePayload
* @property {string} execution_id - The id of this code run
* @property {object} conversation_state - The latest version of your conversation state
* @property {object} conversation_state_patch - The diffed representation of the inbound and outbound state
* @property {object} users_patch - The diffed representation of the inbound and outbound users object
* @property {array} reset_users - A list of user ids queued up to be reset
* @property {array} messages - A collection of messages scheduled to be sent as a response
*/

/**
* @typedef ResponseState
* @property {string} version - The version of the client library
* @property {ResponseStatePayload}
*/

/**
 * @typedef SlotValues
 * @property {object} values An object keyed on each entity for the given MessagePart
 * @property {SlotValuesByRole} values.values_by_role A mapping of {@link SlotValue} objects keyed by role
 */

/**
 * @typedef SlotValuesByRole
 * @property {SlotValue[]} values An array of SlotValues
 */

/**
 * @typedef SlotValue
 * @property {string} value The presentational value of the given slot
 * @property {string} raw_value The raw value of the given slot
 *
 * @property {boolean} [canonicalized=false] Currently unused
 * @property {any} [canonicalized=null] Currently unused
 */
