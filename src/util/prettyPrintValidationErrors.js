const errorMessagePrefix = errors =>
  `Logic invocation validation failure${errors.length > 1 ? 's' : ''}`.trim()

const writeError = (_, index, errorMessage, data) => {
  const message = [`${index + 1}) ${errorMessage}`]

  if (data) {
    message.push(JSON.stringify(data, null, 2), '')
  }

  return message.join('\n')
}

const prettyPrintValidationErrors = (errors, suggestions) => {
  const errorMessage = [errorMessagePrefix(errors), '']
    .concat(
      errors.map((error, index) => {
        const invalidObject =
          (error.correlation_id &&
            suggestions.find(
              suggestion => suggestion.correlation_id === error.correlation_id
            )) ||
          null

        return writeError`${index}${error.message}${invalidObject}`
      }),
      '',
      '| Ensure all keys in `data` match templates for the given intent.',
      '| > Docs: https://docs.init.ai/docs/intents-entities-and-templates#section-templates.'
    )
    .join('\n')

  return errorMessage
}

module.exports = prettyPrintValidationErrors
