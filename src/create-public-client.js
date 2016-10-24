const logger = require('./logger')

module.exports = function createPublicClient(client) {
  return client.constants.PUBLIC_METHODS.reduce(function (publicClient, method) {
    if (client[method]) {
      publicClient[method] = client[method].bind(client)
    } else {
      logger.error('Client has no method', method)
    }

    return publicClient
  }, {})
}
