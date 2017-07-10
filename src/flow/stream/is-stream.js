const _ = require('lodash')
const isString = _.isString
const isObject = _.isObject

module.exports = (streams, step) =>
  isString(step) && isObject(streams) && streams.hasOwnProperty(step)
