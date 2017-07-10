const createErrorWithDocsLink = docsUrl => str =>
  [str, '', `| > Docs: ${docsUrl}`].join('\n')

module.exports = createErrorWithDocsLink
