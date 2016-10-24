const _ = require('lodash')
const isArray = _.isArray
const isString = _.isString

module.exports = streams => messagePart => {
  Object.keys(streams).forEach(stream => {
    if (stream !== 'main') {
      if (isArray(streams[stream])) {
        streams[stream].forEach(step => {
          if (!isString(step)) {
            step.extractInfo(messagePart)
          }
        })
      } else {
        streams[stream].extractInfo(messagePart)
      }
    }
  })
}
