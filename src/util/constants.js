module.exports = {
  Errors: {
    INVALID_MESSAGE_CONTEXT: 'A valid message context must be provided',
    INVALID_LAMBDA_CONTEXT: 'A valid lambda context must be provided',
    INVALID_RESPONSE_MESSAGE: 'A valid response message must be provided',
    INVALID_RESPONSE_IMAGE: 'A valid response image URL must be provided',
    INVALID_SCRIPTS_COLLECTION: 'A valid scripts collection is required',
    INVALID_SUGGESTED_MESSAGE: 'A valid suggested message object is required',
    INVALID_USER_ID_PROVIDED: 'A valid user id must be provided',
    INVALID_TEMPLATE_STRING: 'A valid template string must be provided',
    INVALID_TEMPLATE_DATA:
      'Valid data to hydrate the template must be provided',
    INVALID_RESPONSE_NAME: 'A valid response name must be provided',
    INVALID_SOURCE_CODE: 'A valid sourceCode string must be provided',
    SEND_RESULTS_NETWORK_FAILURE:
      'There was an error sending your results. Please try again.',
    SEND_RESULTS_VALIDATION_FAILURE:
      'There was an error validating your data. Please try again.',
  },
  IdTypes: {
    APP_USER_ID: 'app_user_id',
  },
  MessageTypes: {
    TEXT: 'text',
    EVENT: 'event',
    POSTBACK: 'postback',
    IMAGE: 'image',
  },
  ActionTypes: {
    LINK: 'link',
    POSTBACK: 'postback',
    REPLY: 'reply',
  },
  ResponseTemplateTypes: {
    RESPONSE_NAME: 'app:response:name:',
  },
  ResponseTypes: {
    PREPARED_OUTBOUND: 'prepared-outbound-message',
    PREPARED_OUTBOUND_WITH_REPLIES: 'prepared-outbound-message-with-replies',
    IMAGE: 'image',
    TEXT: 'text',
    TEXT_TEMPLATE: 'text_template',
    CAROUSEL_LIST: 'carousel_list',
  },
  ParticipantRoles: {
    APP: 'app',
    AGENT: 'agent',
    END_USER: 'end-user',
  },
  ScriptCollections: {
    DEFAULT: 'scripts',
  },
}
