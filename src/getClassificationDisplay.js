'use strict'

module.exports = function getClassificationDisplay(classification) {
  if (!classification) {
    return undefined
  }

  let classificationDisplay = String(classification.base_type.value)

  if (classification.sub_type && classification.sub_type.value) {
    classificationDisplay += ('/' + classification.sub_type.value)
  }

  if (classification.style && classification.style.value) {
    classificationDisplay += ('#' + classification.style.value)
  }

  return classificationDisplay
}
