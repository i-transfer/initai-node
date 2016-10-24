'use strict'

module.exports = function getClassificationBaseType(classification) {
  if (!classification) {
    return undefined
  }

  const classificationDisplay = classification.base_type.value

  return classificationDisplay
}
