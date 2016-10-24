// INIT_VERSION: 0.0.5

'use strict'

/**
 * Example developer implementation of our state machine.
 */

exports.handle = function handle(client) {
  const returnPolicies = client.createStep({
    satisfied() {
      return false
    },

    prompt() {
      client.addTextResponse('Our return policy states that you cant do it')
      client.done()
    },
  })

  const presentItems = client.createStep({
    extractInfo() {
      let itemName
      client.log('Extract messages')

      try {
        itemName = client.getMessagePart().slots.city.values_by_role.generic[0].value
        client.setConversationState('cart', [itemName])
      } catch (e) {}
    },

    satisfied() {
      const cart = client.getConversationState().cart
      return cart && cart.length > 0
    },

    prompt() {
      client.addTextResponse('Which item do you want?')
      client.done()
    },

    expects() {
      return ['show_items']
    },
  })

  const collectAddress = client.createStep()
  const collectPayment = client.createStep({
    extractInfo() {
      client.log('Extract messages')
      let cardNumber

      try {
        cardNumber = client.getMessagePart().slots.city.values_by_role.generic[0].value
        client.setConversationState('paymentInstrument', {cardNumber})
      } catch (e) {}
    },

    satisfied() {
      const paymentInstrument = client.getConversationState().paymentInstrument

      return paymentInstrument && paymentInstrument.cardNumber
    },

    prompt() {
      client.addTextResponse('What is your card number? (You can trust me)')
      client.done()
    },
  })
  const confirmOrder = client.createStep()
  const end = client.createStep({
    prompt() {
      client.addTextResponse('This is the end, my friend, so make amends and dont get the bends or youll lose a contact lens')
      client.done()
    },

    satisfied() {
      return false
    },
  })

  client.runFlow({
    // classifications: {
    //   'return_policies': 'returnPolicies'
    // },
    streams: {
      returnPolicies: [returnPolicies],
      fillCart: presentItems,
      checkout: ['fillCart', collectAddress, collectPayment, confirmOrder],
      main: [], // 'checkout',
      end: [end],
    },
  })
}
