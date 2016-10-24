const logger = require('tracer').colorConsole({
  format: '[initai-node:{{title}}]: {{message}}',
})

module.exports = logger
