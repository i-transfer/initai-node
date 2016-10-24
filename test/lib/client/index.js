'use strict'

const initClient = require('../../../src/index')
const Immutable = require('immutable')
const constants = require('../../../src/util/constants')
const jiff = require('jiff')
const assign = require('lodash').assign
const messageContext = require('../../helpers/message-context')
const messageEventContext = require('../../helpers/message-event-context')
const flowRunner = require('../../../src/flow/runner')
const logger = require('../../../src/logger')
const VERSION = process.env.VERSION

const InitClient = initClient.InitClient

describe('InitClient', () => {
  let originalConstants, fakeMessageContext, fakeMessageWithEventContext, fakeLambdaContext

  beforeEach(() => {
    fakeMessageContext = Immutable.fromJS(messageContext).toJS()
    fakeMessageWithEventContext = Immutable.fromJS(messageEventContext).toJS()

    originalConstants = Immutable.fromJS(constants).toJS()
    fakeLambdaContext = {
      succeed: sandbox.stub(),
      fail: sandbox.stub()
    }

    sandbox.stub(logger, 'log')
  })

  afterEach(() => {
    InitClient.constants = originalConstants
  })

  describe('InitClient factory', () => {
    it('returns an instance of an InitClient', () => {
      expect(initClient.create(fakeMessageContext, fakeLambdaContext))
      .to.be.an.instanceof(InitClient)
    })
  })

  describe('constructor()', () => {
    describe('_executionData', () => {
      it('pulls execution_data off of payload and assigns it to the instance', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(Immutable.Map.isMap(client._executionData)).to.equal(true)
        expect(client._executionData.toJS()).to.deep.equal(fakeMessageContext.payload.execution_data)
      })
    })

    describe('_messageContext', () => {
      it('throws an error if message context is not provided', () => {
        function run() {
          return new InitClient()
        }

        expect(run).to.throw('A valid message context must be provided')
      })

      it('ingests messageContext and assigns it to the instance', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const strippedPayload = Immutable.fromJS(fakeMessageContext.payload).toJS()

        delete strippedPayload.execution_data

        strippedPayload.current_conversation.messages[0].parts[0].sender = strippedPayload.users[
          Object.keys(strippedPayload.users)[0]
        ]

        expect(Immutable.Map.isMap(client._messageContext)).to.equal(true)
        expect(client._messageContext.toJS()).not.to.have.any.keys('execution_data')
        expect(client._messageContext.toJS()).to.deep.equal(strippedPayload)
      })
    })
  })

  describe('helpers', () => {
    describe('entity extraction', () => {
      let fakeSlots

      beforeEach(() => {
        // Start mock slots
        fakeSlots = {
          game_location: {
            entity: 'game_location',
            base_type: 'string',
            roles: ['city', 'venue'],
            values_by_role: {
              city: [
                {
                  value: 'Chicago',
                  raw_value: 'Chicago',
                  canonicalized: false,
                  parsed: null
                },
                {
                  value: 'Los Angeles',
                  raw_value: 'Los Angeles',
                  canonicalized: false,
                  parsed: null
                }
              ],
              venue: [
                {
                  value: 'Wrigley Field',
                  raw_value: 'Wrigley Field',
                  canonicalized: false,
                  parsed: null
                },
                {
                  value: 'Chavez Ravine',
                  raw_value: 'Chavez Ravine',
                  canonicalized: false,
                  parsed: null
                }
              ]
            }
          },
          team: {
            entity: 'team',
            base_type: 'string',
            roles: ['generic'],
            values_by_role: {
              generic: [
                {
                  value: 'Cubs',
                  raw_value: 'Cubs',
                  canonicalized: false,
                  parsed: null
                }
              ]
            }
          }
        }
        // End mock slots
      })

      describe('getEntities', () => {
        it('returns a map of entities', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const fakeContext = {logError: sandbox.stub()}
          const result = InitClient.prototype.getEntities.call(fakeContext, fakeMessagePart, 'game_location')

          expect(result).to.have.all.keys('city', 'venue')
          expect(result.city).to.deep.equal([
            {
              value: 'Chicago',
              raw_value: 'Chicago',
              canonicalized: false,
              parsed: null
            },
            {
              value: 'Los Angeles',
              raw_value: 'Los Angeles',
              canonicalized: false,
              parsed: null
            }
          ])
          expect(result.venue).to.deep.equal([
            {
              value: 'Wrigley Field',
              raw_value: 'Wrigley Field',
              canonicalized: false,
              parsed: null
            },
            {
              value: 'Chavez Ravine',
              raw_value: 'Chavez Ravine',
              canonicalized: false,
              parsed: null
            }
          ])
        })

        it('returns null if no slots are found for the given entity', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const fakeContext = {logError: sandbox.stub()}
          const result = InitClient.prototype.getEntities.call(fakeContext, fakeMessagePart, 'foo')

          expect(result).to.equal(null)
        })

        it('logs an error if a messagePart is not provided', () => {
          const fakeContext = {logError: sandbox.stub()}
          const result = InitClient.prototype.getEntities.call(fakeContext)

          expect(fakeContext.logError).to.have.been.calledWith('getEntities: A valid MessagePart (Object) is required. View the docs for more: https://docs.init.ai/reference/client-api.html')
          expect(result).to.equal(null)
        })

        it('logs an error if an entity is not provided', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const fakeContext = {logError: sandbox.stub()}
          const result = InitClient.prototype.getEntities.call(fakeContext, fakeMessagePart)

          expect(fakeContext.logError).to.have.been.calledWith('getEntities: A valid entity (String) is required. View the docs for more: https://docs.init.ai/reference/client-api.html')
          expect(result).to.equal(null)
        })
      })

      describe('getFirstEntityWithRole', () => {
        it('returns the first SlotValue for the given entity and role', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole(fakeMessagePart, 'game_location', 'venue')

          expect(result).to.deep.equal({
            value: 'Wrigley Field',
            raw_value: 'Wrigley Field',
            canonicalized: false,
            parsed: null
          })
        })

        it('returns null if no SlotValues are found for the role', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole(fakeMessagePart, 'game_location', 'foo')

          expect(result).to.deep.equal(null)
        })

        it('returns null if no entities are found', () => {
          const fakeMessagePart = {slots: fakeSlots}
          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole(fakeMessagePart, 'foo')

          expect(result).to.deep.equal(null)
        })

        it('returns the first SlotValue for the generic role if no role is provided', () => {
          // Add "generic" roles
          fakeSlots.game_location.roles.push('generic')
          fakeSlots.game_location.values_by_role.generic = [
            {
              value: 'Foo',
              raw_value: 'Foo',
              canonicalized: false,
              parsed: null
            },
            {
              value: 'Bar',
              raw_value: 'Bar',
              canonicalized: false,
              parsed: null
            },
          ]

          const fakeMessagePart = {slots: fakeSlots}
          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole(fakeMessagePart, 'game_location')

          expect(result).to.deep.equal({
            value: 'Foo',
            raw_value: 'Foo',
            canonicalized: false,
            parsed: null,
          })
        })

        it('logs an error when no MessagePart is provided', () => {
          sandbox.stub(InitClient.prototype, 'logError')

          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole()

          expect(client.logError).to.have.been.calledWith('getFirstEntityWithRole: A valid MessagePart (Object) is required. View the docs for more: https://docs.init.ai/reference/client-api.html')
          expect(result).to.equal(null)
        })

        it('logs an error when no entity is provided', () => {
          sandbox.stub(InitClient.prototype, 'logError')

          const fakeMessagePart = {slots: fakeSlots}
          const client = new InitClient(fakeMessageContext, fakeLambdaContext)
          const result = client.getFirstEntityWithRole(fakeMessagePart)

          expect(client.logError).to.have.been.calledWith('getFirstEntityWithRole: A valid entity (String) is required. View the docs for more: https://docs.init.ai/reference/client-api.html')
          expect(result).to.equal(null)
        })
      })
    })
  })

  describe('Current Message', () => {
    describe('getMessagePart', () => {
      it('returns the current message part', () => {
        let client
        const testUser = {
          id: 'testUser',
        }

        fakeMessageContext.payload.users = {
          'testUser': testUser,
        }

        fakeMessageContext.payload.current_conversation.__private_temp_user_id = 'testUser'

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(
          client.getMessagePart()
        ).to.deep.equal(
          assign(
            {},
            fakeMessageContext.payload.current_conversation.messages[0].parts[0],
            {sender: testUser}
          )
        )
      })

      it('is an immutable Object', () => {
        let client, result1, result2
        const testUser = {
          id: 'testUser',
        }

        fakeMessageContext.payload.users = {
          'testUser': testUser,
        }

        fakeMessageContext.payload.current_conversation.__private_temp_user_id = 'testUser'

        fakeMessageContext.payload.current_conversation.messages[0].parts[0] = {
          foo: {bar: 'baz'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        result1 = client.getMessagePart()
        result2 = client.getMessagePart()

        delete result1.foo.bar

        expect(result2).to.deep.equal({
          foo: {bar: 'baz'},
          sender: testUser,
        })
        expect(result2).to.deep.equal(client.getMessagePart())
      })
    })

    describe('getMessageText', () => {
      it('returns the text body of the current message', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(client.getMessageText()).to.equal('what\'s going on with southwest 244, taking off from denver?')
      })

      it('returns the text body of the current message for a postback', () => {
        const fakeMessageContextWithPostback = {}
        assign(fakeMessageContextWithPostback, fakeMessageContext)
        fakeMessageContextWithPostback.payload.current_conversation.messages[0].parts[0].content_type = constants.MessageTypes.POSTBACK
        fakeMessageContextWithPostback.payload.current_conversation.messages[0].parts[0].content = {
          version: '1',
          stream: 'mystream',
          data: {
            a: 1,
            b: 2,
          },
          text: 'postback text',
        }
        const client = new InitClient(fakeMessageContextWithPostback, fakeLambdaContext)

        expect(client.getMessageText()).to.equal('postback text')
      })

      it('is an immutable String', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const result2 = client.getMessageText()

        expect(result2).to.equal('what\'s going on with southwest 244, taking off from denver?')
        expect(result2).to.equal(client.getMessageText())
      })
    })

    describe('getPostbackData', () => {
      it('returns null if current message is text', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(client.getPostbackData()).to.equal(null)
      })

      it('returns data from the postaback', () => {
        const fakeMessageContextWithPostback = {}
        assign(fakeMessageContextWithPostback, fakeMessageContext)
        fakeMessageContextWithPostback.payload.current_conversation.messages[0].parts[0].content_type = constants.MessageTypes.POSTBACK
        fakeMessageContextWithPostback.payload.current_conversation.messages[0].parts[0].content = {
          version: '1',
          stream: 'mystream',
          data: {
            a: 1,
            b: 2,
          },
          text: 'postback text',
        }
        const client = new InitClient(fakeMessageContextWithPostback, fakeLambdaContext)

        expect(client.getPostbackData()).to.deep.equal({
          a: 1,
          b: 2,
        })
      })
    })
  })

  describe('responses', () => {
    describe('addResponse', () => {
      it('throws an error if a responseName is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.addResponse()
        }

        expect(run).to.throw('A valid response name must be provided')
      })

      it('pushes response onto queue', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addResponse('foobar')

        expect(client._messageResponsePartsQueue[0]).to.deep.equal(
          {
          content_type: 'prepared-outbound-message',
          content: {
            response_name: 'foobar',
            response_data: null,
          },
          to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
          to_type: 'app_user_id',
        }
        )
      })

      it('pushes response onto queue with data', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addResponse('foobar', {foo: 'bar'})

        expect(client._messageResponsePartsQueue[0]).to.deep.equal(
          {
          content_type: 'prepared-outbound-message',
          content: {
            response_name: 'foobar',
            response_data: {foo: 'bar'},
          },
          to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
          to_type: 'app_user_id',
        }
        )
      })
    })

    describe('addTextResponse', () => {
      it('throws an error if a message is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.addTextResponse()
        }

        expect(run).to.throw('A valid response message must be provided')
      })

      it('pushes response onto queue', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addTextResponse('foobar')

        expect(client._messageResponsePartsQueue[0]).to.deep.equal(
          {
            content_type: 'text',
            content: 'foobar',
            to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
            to_type: 'app_user_id',
          }
        )
      })
    })

    describe('addImageResponse', () => {
      it('throws an error if an image URL is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(() => client.addImageResponse()).to.throw('A valid response image URL must be provided')
      })

      it('pushes response onto queue', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addImageResponse('http://wikipedia.org/example.png')

        expect(client._messageResponsePartsQueue[0]).to.deep.equal({
          content_type: 'image',
          content: {
            image_url: 'http://wikipedia.org/example.png',
            alternative_text: undefined,
          },
          to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
          to_type: 'app_user_id',
        })
      })

      it('saves alternativeText', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addImageResponse('http://wikipedia.org/example.png', 'Alternative text.')

        expect(client._messageResponsePartsQueue[0]).to.deep.equal({
          content_type: 'image',
          content: {
            image_url: 'http://wikipedia.org/example.png',
            alternative_text: 'Alternative text.',
          },
          to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
          to_type: 'app_user_id',
        })
      })
    })

    describe('addTextTemplateResponse', () => {
      it('throws an error if a template string is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.addTextTemplateResponse()
        }

        expect(run).to.throw('A valid template string must be provided')
      })

      it('throws an error if template data is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.addTextTemplateResponse('{{.Name}}')
        }

        expect(run).to.throw('Valid data to hydrate the template must be provided')
      })

      it('pushes response onto queue', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addTextTemplateResponse('My name is {{.Name}}', {name: 'joe'})

        expect(client._messageResponsePartsQueue[0]).to.deep.equal(
          {
            content_type: 'text_template',
            content: {
              template_type: 'go',
              template_string: 'My name is {{.Name}}',
              template_data: {name: 'joe'},
            },
            to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
            to_type: 'app_user_id',
          }
        )
      })
    })

    describe('addCarouselListResponse', () => {
      it('throws an error if payload is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.addCarouselListResponse()
        }

        expect(run).to.throw
      })

      it('pushes response onto queue', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.addCarouselListResponse({
          items: [
            {
              'media_url': 'https://c2.staticflickr.com/4/3512/5763418254_e2f42b2224_b.jpg',
              'media_type': 'image/jpeg',
              'description': 'desc',
              title: 'Yosemite',
              actions: [
                {
                  type: constants.ActionTypes.POSTBACK,
                  text: 'Visit',
                  payload: {
                    data: {
                      action: 'visit',
                      park: 'yosemite',
                    },
                    stream: 'a',
                    version: '1',
                  },
                },
              ],
            },
            {
              'media_url': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Morning_Glory_Pool.jpg',
              'media_type': 'image/jpeg',
              'description': 'desc',
              title: 'Yellowstone',
              actions: [
                {
                  type: constants.ActionTypes.LINK,
                  text: 'View info',
                  uri: 'https://en.wikipedia.org/wiki/Yellowstone_National_Park',
                },
              ],
            },
          ],
        })

        expect(client._messageResponsePartsQueue[0]).to.deep.equal(
          {
            content_type: 'carousel_list',
            content: {
              version: '1',
              payload: {
                items: [
                  {
                    'media_url': 'https://c2.staticflickr.com/4/3512/5763418254_e2f42b2224_b.jpg',
                    'media_type': 'image/jpeg',
                    'description': 'desc',
                    title: 'Yosemite',
                    actions: [
                      {
                        type: 'postback',
                        text: 'Visit',
                        payload: {
                          data: {
                            action: 'visit',
                            park: 'yosemite',
                          },
                          version: '1',
                          stream: 'a',
                        },
                      },
                    ],
                  },
                  {
                    'media_url': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Morning_Glory_Pool.jpg',
                    'media_type': 'image/jpeg',
                    'description': 'desc',
                    title: 'Yellowstone',
                    actions: [
                      {
                        type: 'link',
                        text: 'View info',
                        uri: 'https://en.wikipedia.org/wiki/Yellowstone_National_Park',
                      },
                    ],
                  },
                ],
              },
            },
            to: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
            to_type: 'app_user_id',
          }
        )
      })
    })

  })

  describe('conversation management', () => {
    describe('getConversation', () => {
      it('returns a conversation model', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const result = client.getConversation()

        expect(result).to.be.an('Object')
        expect(result).to.have.all.keys([
          'id',
          'state',
          'conversation_message_index_to_process',
          'messages',
          '__private_temp_user_id',
        ])
      })

      it('is an immutable object', () => {
        let client, result1, result2

        fakeMessageContext.payload.current_conversation.id = '123'
        fakeMessageContext.payload.current_conversation.state = 'of the world'

        client = new InitClient(fakeMessageContext, fakeLambdaContext)
        result1 = client.getConversation()
        result2 = client.getConversation()

        result1.id = null
        result1.state = 'nux'

        expect(result2.id).to.equal('123')
        expect(result2.state).to.equal('of the world')
      })
    })

    describe('expect', () => {
      it('writes to the client currentExpectations conversation state', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.expect('myStreamName', ['a', 'b'])

        expect(client.getConversationState().currentExpectations).to.deep.equal({
          myStreamName: ['a', 'b'],
        })
      })
    })

    describe('getConversationState', () => {
      it('returns a conversation state model', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        let fetchedState = client.getConversationState()
        console.log('fetchedState:', fetchedState)
        expect(fetchedState).to.deep.equal({
          onboarding_complete: true,
          onboarding_welcome_sent: true,
        })
      })

      it('is an immutable object', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const result1 = client.getConversationState()
        const result2 = client.getConversationState()

        result1.foo = 'bar'
        result1.onboarding_complete = 'nux'

        expect(result2).not.to.have.any.keys('foo')
        expect(result2.onboarding_complete).to.equal(true)
      })
    })

    describe('updateConversationState', () => {
      it('writes a new object to the conversation state', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateConversationState({userDidSomething: 'yes'})

        expect(client.getConversationState().userDidSomething).to.equal('yes')
      })

      it('deeply merges values', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateConversationState({
          person: {
            name: {
              first: 'Gordon',
              last: 'Bombay',
            },
            teams: ['Mighty Ducks', 'Team USA', 'Waves'],
          },
        })

        expect(client.getConversationState().person.name).to.deep.equal({
          first: 'Gordon',
          last: 'Bombay',
        })

        client.updateConversationState({
          person: {
            name: {nickname: 'The Minnesota Miracle Man'},
          },
        })

        expect(client.getConversationState()).to.deep.equal({
          onboarding_complete: true,
          onboarding_welcome_sent: true,
          person: {
            name: {
              first: 'Gordon',
              last: 'Bombay',
              nickname: 'The Minnesota Miracle Man',
            },
            teams: ['Mighty Ducks', 'Team USA', 'Waves'],
          },
        })

        client.updateConversationState('person/teams'.split('/'), 'HS')

        expect(client.getConversationState().person.teams).to.deep.equal('HS')
      })

      it('overwrites a value on the state object', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateConversationState({onboarding_complete: '123'})

        expect(client.getConversationState().onboarding_complete).to.equal('123')
      })

      it('overwrites a value on the state object with a key/value pair', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateConversationState('onboarding_complete', 'nux')

        expect(client.getConversationState().onboarding_complete).to.equal('nux')
      })

      it('deeply updates and sets values', () => {
        let newState
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateConversationState(['foo', 'bar'], 'baz')
        client.updateConversationState('nux', {foo: 'tool'})
        client.updateConversationState('tunes', {royksopp: {location: {country: 'iceland'}}})
        newState = client.getConversationState()

        expect(newState).to.deep.equal({
          onboarding_complete: true,
          onboarding_welcome_sent: true,
          foo: {bar: 'baz'},
          nux: {foo: 'tool'},
          tunes: {
            royksopp: {
              location: {
                country: 'iceland',
              },
            },
          },
        })
      })
    })
  })

  describe('user management', () => {
    describe('getUsers', () => {
      it('returns a collection of all users', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(client.getUsers()).to.deep.equal({
          '23eeee22-4fdf-40b9-48b3-57ea2b200876': {
            'app_id': '4ee5930a-5b37-4551-7615-8b7e1d6b7a56',
            'id': '23eeee22-4fdf-40b9-48b3-57ea2b200876',
            'platform_user_id': '8f6b2f33-420d-469f-6ef7-d2693a7dff2c',
            'remote_id': null,
            'first_name': '',
            'last_name': '',
            'metadata': null,
            'minimum_token_issued_at': 0,
            'created_at': '2016-04-27T18:17:54.582669-04:00',
            'updated_at': '2016-04-27T18:17:54.582669-04:00',
            'deleted_at': null,
          },
        })
      })

      it('returns an empty Object if no users are available', () => {
        let client
        const context = fakeMessageContext

        context.payload.users = null

        client = new InitClient(context, fakeLambdaContext)

        expect(client.getUsers()).to.deep.equal({})
      })
    })

    describe('updateUser', () => {
      it('throws if a valid user id is not provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.updateUser('xxx', 'foo')
        }

        expect(run).to.throw('A valid user id must be provided')
      })

      it('throws if no user id is provided', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        function run() {
          client.updateUser()
        }

        expect(run).to.throw('A valid user id must be provided')
      })

      it('updates the user with the provided id', () => {
        let client, userBefore, userAfter

        fakeMessageContext.payload.users = {
          '123': {
            id: '123',
          },
          '456': {
            id: '456',
          },
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)
        userBefore = client.getUsers()['123']

        client.updateUser('123', {foo: 'bar'})
        userAfter = client.getUsers()['123']

        expect(userBefore.foo).not.to.exist
        expect(userAfter.foo).to.equal('bar')
      })

      it('performs a deep merge', () => {
        let client
        const fakeId = '456'// Object.keys(fakeMessageContext.payload.users)[0]

        fakeMessageContext.payload.users[fakeId] = {
          id: fakeId,
          foo: {
            bar: {
              baz: {firstName: 'Gordon'},
            },
          },
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateUser('456', {
          foo: {
            bar: {
              baz: {
                lastName: 'Bombay',
              },
            },
          },
        })

        expect(client.getUsers()['456']).to.deep.equal({
          id: fakeId,
          foo: {
            bar: {
              baz: {
                firstName: 'Gordon',
                lastName: 'Bombay',
              },
            },
          },
        })
      })

      it('deeply updates and sets values', () => {
        const fakeId = Object.keys(fakeMessageContext.payload.users)[0]
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.updateUser(fakeId, ['foo', 'bar'], 'baz')
        client.updateUser(fakeId, 'nux', {foo: 'tool'})
        client.updateUser(fakeId, 'tunes', {royksopp: {location: {country: 'iceland'}}})

/*
 "23eeee22-4fdf-40b9-48b3-57ea2b200876": {
        "app_id": "4ee5930a-5b37-4551-7615-8b7e1d6b7a56",
        "id": "23eeee22-4fdf-40b9-48b3-57ea2b200876",
        "platform_user_id": "8f6b2f33-420d-469f-6ef7-d2693a7dff2c",
        "remote_id": null,
        "first_name": "",
        "last_name": "",
        "metadata": null,
        "minimum_token_issued_at": 0,
        "created_at": "2016-04-27T18:17:54.582669-04:00",
        "updated_at": "2016-04-27T18:17:54.582669-04:00",
        "deleted_at": null
      }
*/

        expect(client.getUsers()[fakeId]).to.deep.equal({
          platform_user_id: '8f6b2f33-420d-469f-6ef7-d2693a7dff2c',
          foo: {bar: 'baz'},
          created_at: '2016-04-27T18:17:54.582669-04:00',
          metadata: null,
          minimum_token_issued_at: 0,
          nux: {foo: 'tool'},
          last_name: '',
          remote_id: null,
          updated_at: '2016-04-27T18:17:54.582669-04:00',
          deleted_at: null,
          app_id: '4ee5930a-5b37-4551-7615-8b7e1d6b7a56',
          first_name: '',
          id: '23eeee22-4fdf-40b9-48b3-57ea2b200876',
          tunes: {
            royksopp: {
              location: {country: 'iceland'},
            },
          },
        })
      })
    })

    describe('resetUser', () => {
      it('resets all users if no id is provided', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)
        client.resetUser()

        expect(client._usersToReset).to.deep.equal([
          'abc',
          'def',
          'ghi',
        ])
      })

      it('appends provided id to reset collection', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.resetUser('abc')
        expect(client._usersToReset).to.deep.equal(['abc'])

        client.resetUser('def')
        expect(client._usersToReset).to.deep.equal(['abc', 'def'])
      })

      it('appends duplicate ids to reset collection', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.resetUser('abc')
        expect(client._usersToReset).to.deep.equal(['abc'])

        client.resetUser('abc')
        expect(client._usersToReset).to.deep.equal(['abc', 'abc'])
      })

      it('does not append id to collection if id is not found on users map', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.resetUser('foo')
        expect(client._usersToReset).to.deep.equal([])
      })

      it('does not append provided argument to collection if it is not a string', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'},
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.resetUser([])
        client.resetUser(false)
        client.resetUser(1)
        client.resetUser(null)
        client.resetUser({foo: 'bar'})
        expect(client._usersToReset).to.deep.equal([])
      })
    })
  })

  describe('current application', () => {
    describe('getCurrentApplication', () => {
      it('returns the current app Object', () => {
        let client
        const messageContext = fakeMessageContext
        const fakeCurrentApplication = {foo: {bar: 'baz'}}

        messageContext.payload.current_application = fakeCurrentApplication
        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(
          client.getCurrentApplication()
        ).to.deep.equal(fakeCurrentApplication)
      })

      it('is an immutable Object', () => {
        let client, result1, result2
        const messageContext = fakeMessageContext
        const fakeCurrentApplication = {foo: {bar: 'baz'}}

        messageContext.payload.current_application = fakeCurrentApplication
        client = new InitClient(fakeMessageContext, fakeLambdaContext)

        result1 = client.getCurrentApplication()
        result2 = client.getCurrentApplication()

        delete result1.foo

        expect(result2).to.deep.equal(fakeCurrentApplication)
      })
    })

    describe('getCurrentApplicationEnvironment', () => {
      it('returns a collection of environment vars', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(client.getCurrentApplicationEnvironment()).to.deep.equal({
          common: {
            externalAppName: 'LocalGitApp1',
          },
          one: {
            two: {
              three: 'MyEnvValue',
            },
          },
        })
      })

      it('is an immutable Object', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const result1 = client.getCurrentApplicationEnvironment()
        const result2 = client.getCurrentApplicationEnvironment()

        result2.common = 'not so similar...'

        expect(result1).to.deep.equal({
          common: {
            externalAppName: 'LocalGitApp1',
          },
          one: {
            two: {
              three: 'MyEnvValue',
            },
          },
        })
      })
    })
  })

  describe('statics', () => {
    describe('constants', () => {
      it('exports constants as a static property', () => {
        expect(InitClient.constants).to.deep.equal({
          Errors: {
            INVALID_LAMBDA_CONTEXT: 'A valid lambda context must be provided',
            INVALID_MESSAGE_CONTEXT: 'A valid message context must be provided',
            INVALID_RESPONSE_MESSAGE: 'A valid response message must be provided',
            INVALID_RESPONSE_IMAGE: 'A valid response image URL must be provided',
            INVALID_SCRIPTS_COLLECTION: 'A valid scripts collection is required',
            INVALID_USER_ID_PROVIDED: 'A valid user id must be provided',
            INVALID_TEMPLATE_STRING: 'A valid template string must be provided',
            INVALID_TEMPLATE_DATA: 'Valid data to hydrate the template must be provided',
            INVALID_RESPONSE_NAME: 'A valid response name must be provided',
            INVALID_SOURCE_CODE: 'A valid sourceCode string must be provided',
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
          },
          ResponseTypes: {
            PREPARED_OUTBOUND: 'prepared-outbound-message',
            IMAGE: 'image',
            TEXT: 'text',
            TEXT_TEMPLATE: 'text_template',
            CAROUSEL_LIST: 'carousel_list',
          },
          ScriptCollections: {
            DEFAULT: 'scripts',
          },
        })
      })

      it('exports a copy of the constants Object', () => {
        const result1 = InitClient.constants

        result1.Errors = 'foo'

        expect(constants.Errors).to.deep.equal({
          INVALID_LAMBDA_CONTEXT: 'A valid lambda context must be provided',
          INVALID_MESSAGE_CONTEXT: 'A valid message context must be provided',
          INVALID_RESPONSE_MESSAGE: 'A valid response message must be provided',
          INVALID_RESPONSE_IMAGE: 'A valid response image URL must be provided',
          INVALID_SCRIPTS_COLLECTION: 'A valid scripts collection is required',
          INVALID_USER_ID_PROVIDED: 'A valid user id must be provided',
          INVALID_TEMPLATE_STRING: 'A valid template string must be provided',
          INVALID_TEMPLATE_DATA: 'Valid data to hydrate the template must be provided',
          INVALID_RESPONSE_NAME: 'A valid response name must be provided',
          INVALID_SOURCE_CODE: 'A valid sourceCode string must be provided',
        })
      })

      it('exports a copy as an instance property', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        expect(client.constants).to.deep.equal({
          Errors: {
            INVALID_LAMBDA_CONTEXT: 'A valid lambda context must be provided',
            INVALID_MESSAGE_CONTEXT: 'A valid message context must be provided',
            INVALID_RESPONSE_MESSAGE: 'A valid response message must be provided',
            INVALID_RESPONSE_IMAGE: 'A valid response image URL must be provided',
            INVALID_SCRIPTS_COLLECTION: 'A valid scripts collection is required',
            INVALID_USER_ID_PROVIDED: 'A valid user id must be provided',
            INVALID_TEMPLATE_STRING: 'A valid template string must be provided',
            INVALID_TEMPLATE_DATA: 'Valid data to hydrate the template must be provided',
            INVALID_RESPONSE_NAME: 'A valid response name must be provided',
            INVALID_SOURCE_CODE: 'A valid sourceCode string must be provided',
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
          },
          ResponseTypes: {
            PREPARED_OUTBOUND: 'prepared-outbound-message',
            IMAGE: 'image',
            TEXT: 'text',
            TEXT_TEMPLATE: 'text_template',
            CAROUSEL_LIST: 'carousel_list',
          },
          ScriptCollections: {
            DEFAULT: 'scripts',
          },
        })
      })
    })
  })

  /**
   * Conversation state flow
   */
  describe('createStep', () => {
    it('returns an Object with expected methods', () => {
      const client = new InitClient(fakeMessageContext, fakeLambdaContext)

      expect(client.createStep()).to.have.all.keys([
        'expects',
        'extractInfo',
        'next',
        'prompt',
        'satisfied',
      ])
    })

    describe('expects', () => {
      it('returns an empty array', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep()

        expect(step.expects()).to.deep.equal([])
      })

      it('returns value from method provided via override', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep({
          expects: () => {
            return ['foo', 'bar']
          },
        })

        expect(step.expects()).to.deep.equal([
          'foo',
          'bar',
        ])
      })
    })

    describe('extractInfo', () => {
      xit('logs default message', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep()

        sandbox.stub(logger, 'log')

        step.extractInfo()

        expect(logger.log).to.have.been.calledWith('Default extract messages')
      })

      it('calls user provided function', () => {
        const extractInfoStub = sandbox.stub()
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep({
          extractInfo: extractInfoStub,
        })
        const fakeMessagePart = {foo: 'bar'}

        step.extractInfo(fakeMessagePart)

        expect(extractInfoStub).to.have.been.calledWith(fakeMessagePart)
      })
    })

    describe('prompt', () => {
      xit('logs default message', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep()

        sandbox.stub(logger, 'log')

        step.prompt()

        expect(logger.log).to.have.been.calledWith('Default prompt')
      })

      it('calls user provided function', () => {
        const promptStub = sandbox.stub()
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep({
          prompt: promptStub,
        })

        step.prompt()

        expect(promptStub).to.have.been.called
      })
    })

    describe('next', () => {
      xit('logs default message', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep()

        sandbox.stub(logger, 'log')

        step.next()

        expect(logger.log).to.have.been.calledWith('Default next')
      })

      it('calls user provided function', () => {
        const nextStub = sandbox.stub()
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep({
          next: nextStub,
        })

        step.next()

        expect(nextStub).to.have.been.called
      })
    })

    describe('satisfied', () => {
      xit('returns true by default', () => {
        let result
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep()

        sandbox.stub(logger, 'log')

        result = step.satisfied()

        expect(logger.log).to.have.been.calledWith('Default satisfied')
        expect(result).to.equal(true)
      })

      it('calls user provided function', () => {
        const satisfiedStub = sandbox.stub()
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)
        const step = client.createStep({
          satisfied: satisfiedStub,
        })

        step.satisfied()

        expect(satisfiedStub).to.have.been.called
      })
    })
  })

  describe('runFlow', () => {
    it('does not error without classifications object on definiton', () => {
      const client = new InitClient(fakeMessageContext, fakeLambdaContext)
      const fakeFlowDefinition = {
        streams: {},
      }

      expect(client.runFlow(fakeFlowDefinition)).to.not.throw
    })

    it('initiates a flow', () => {
      const client = new InitClient(fakeMessageContext, fakeLambdaContext)
      const fakeFlowDefinition = {
        classifications: {},
        streams: {},
      }

      sandbox.stub(flowRunner, 'run')

      client.runFlow(fakeFlowDefinition)

      expect(flowRunner.run).to.have.been.calledWith(fakeFlowDefinition, client)
    })

    it('initiates a flow with an event', () => {
      const client = new InitClient(fakeMessageWithEventContext, fakeLambdaContext)
      const fakeFlowDefinition = {
        classifications: {},
        streams: {},
      }

      sandbox.stub(flowRunner, 'run')

      client.runFlow(fakeFlowDefinition)

      expect(flowRunner.run).to.have.been.calledWith(fakeFlowDefinition, client)
    })
  })

  describe('done', () => {
    it('signals termination to the λ function', () => {
      let client

      fakeMessageContext.payload.execution_data.execution_id = 'foobar'

      client = new InitClient(fakeMessageContext, fakeLambdaContext)

      client.done()

      expect(fakeLambdaContext.succeed).to.have.been.calledWith({
        version: VERSION,
        payload: {
          execution_id: 'foobar',
          conversation_state: sinon.match.object,
          conversation_state_patch: sinon.match.array,
          users_patch: sinon.match.array,
          reset_users: sinon.match.array,
          messages: [
            {parts: sinon.match.array}
          ]
        }
      })
    })

    it('sends the conversation diff', () => {
      let client

      sandbox.stub(jiff, 'diff')

      fakeMessageContext.payload.current_conversation.state = {foo: 'noo'}

      client = new InitClient(fakeMessageContext, fakeLambdaContext)

      client.updateConversationState('bar', 'baz')

      client.done()

      expect(jiff.diff.args[0]).to.deep.equal([
        {foo: 'noo'},
        {foo: 'noo', bar: 'baz'}
      ])
    })

    it('sends the users patch', () => {
      let client

      sandbox.stub(jiff, 'diff')

      fakeMessageContext.payload.users = {
        '123': {
          id: '123',
          first_name: 'dave'
        }
      }

      client = new InitClient(fakeMessageContext, fakeLambdaContext)

      client.updateUser('123', {last_name: 'grohl'})

      client.done()

      expect(jiff.diff.args[1]).to.deep.equal([
        {
          '123': {
            first_name: 'dave',
            id: '123'
          }
        },
        {
          '123': {
            first_name: 'dave',
            last_name: 'grohl',
            id: '123'
          }
        }
      ])
    })

    describe('reset_users', () => {
      it('sends an empty array', () => {
        const client = new InitClient(fakeMessageContext, fakeLambdaContext)

        client.done()

        expect(fakeLambdaContext.succeed.args[0][0].payload.reset_users).to.deep.equal([])
      })

      it('sends a popuplated array', () => {
        let client

        fakeMessageContext.payload.users = {
          'abc': {id: 'abc'},
          'def': {id: 'def'},
          'ghi': {id: 'ghi'}
        }

        client = new InitClient(fakeMessageContext, fakeLambdaContext)
        client.resetUser()

        client.done()

        expect(fakeLambdaContext.succeed.args[0][0].payload.reset_users).to.deep.equal([
          'abc',
          'def',
          'ghi'
        ])
      })
    })
  })
})
