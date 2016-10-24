'use strict'

module.exports = function getClassificationWithoutStyle(classification) {
  if (!classification) {
    return undefined
  }

  let classificationWithoutStyle = String(classification.base_type.value)

  if (classification.sub_type && classification.sub_type.value) {
    classificationWithoutStyle += ('/' + classification.sub_type.value)
  }

  return classificationWithoutStyle
}
