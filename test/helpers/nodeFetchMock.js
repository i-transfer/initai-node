function mockFailure(status, statusText, resultJSON) {
  return Promise.resolve({
    json: () => Promise.resolve(resultJSON), // This should never be caled
    status: status || 404,
    statusText: statusText || 'Authorization not found or missing',
  })
}

exports.mockFailure = mockFailure

function mockSuccess() {
  return Promise.resolve({
    json: () => Promise.resolve({body: 'OK', error: null}),
    status: 200,
  })
}

exports.mockSuccess = mockSuccess
