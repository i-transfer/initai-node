const isStream = require('../../../../src/flow/stream/is-stream')

describe('isStream', () => {
  it('returns a Boolean', () => {
    expect(isStream()).to.be.a('boolean')
  })

  it('returns true if key is a string', () => {
    expect(
      isStream({foo: 'bar'}, 'foo')
    ).to.equal(true)
  })

  describe('returns false', () => {
    describe('if streams', () => {
      it('are undefined', () => {
        expect(isStream(undefined, 'foo')).to.equal(false)
      })

      it('are null', () => {
        expect(isStream(null, 'foo')).to.equal(false)
      })

      it('are empty', () => {
        expect(isStream({}, 'foo')).to.equal(false)
      })

      it('are an Array', () => {
        expect(isStream([], 'foo')).to.equal(false)
      })

      it('are a Number', () => {
        expect(isStream(2, 'foo')).to.equal(false)
      })

      it('are a Boolean', () => {
        expect(isStream(true, 'foo')).to.equal(false)
      })
    })

    describe('if key', () => {
      it('is undefined', () => {
        expect(isStream({foo: 'bar'}, undefined)).to.equal(false)
      })

      it('is null', () => {
        expect(isStream({foo: 'bar'}, null)).to.equal(false)
      })

      it('is an empty Object', () => {
        expect(isStream({foo: 'bar'}, {})).to.equal(false)
      })

      it('is a not a property', () => {
        expect(isStream({foo: 'bar'}, 'baz')).to.equal(false)
      })

      it('is a prototype key', () => {
        expect(isStream({foo: 'bar'}, 'keys')).to.equal(false)
      })

      it('is a Boolean', () => {
        expect(isStream({foo: 'bar'}, true)).to.equal(false)
      })

      it('is an Array', () => {
        expect(isStream({foo: 'bar'}, [])).to.equal(false)
      })

      it('is a Number', () => {
        expect(isStream({foo: 'bar'}, 2)).to.equal(false)
      })
    })
  })
})
