const isArray = require('lodash').isArray

module.exports = function getCurrentlyActiveStep(stream, state) {
  return isArray(stream) ? stream[state.get('stepIndex')] : stream
}
