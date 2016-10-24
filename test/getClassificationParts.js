'use strict'

const getClassificationDisplay = require('../src/getClassificationDisplay')
const getClassificationBaseType = require('../src/getClassificationBaseType')
const getClassificationWithoutStyle = require('../src/getClassificationWithoutStyle')

const sampleObjects = [
  {
    classification: {
      base_type: {value: 'foo'}
    },
    display: 'foo',
    baseType: 'foo',
    withoutStyle: 'foo',
  },
  {
    classification: {
      base_type: {value: 'a'},
      sub_type: {value: 'b'},
      style: {value: ''}
    },
    display: 'a/b',
    baseType: 'a',
    withoutStyle: 'a/b',
  },
  {
    classification: {
      base_type: {value: 'foo'},
      sub_type: {value: 'bar'},
      style: {value: 'baz'}
    },
    display: 'foo/bar#baz',
    baseType: 'foo',
    withoutStyle: 'foo/bar',
  },
  {
    classification: null,
    display: undefined,
    baseType: undefined,
    withoutStyle: undefined,
  },
  {
    classification: undefined,
    display: undefined,
    baseType: undefined,
    withoutStyle: undefined,
  },
]

describe('getClassificationDisplay', () => {
  for (let caseNumber = 0; caseNumber < sampleObjects.length; caseNumber++) {
    const testCase = sampleObjects[caseNumber]
    it(`returns the proper classification display for test case ${caseNumber}`, () => {
      expect(getClassificationDisplay(testCase.classification)).to.equal(testCase.display)
    })
  }
})

describe('getClassificationBaseType', () => {
  for (let caseNumber = 0; caseNumber < sampleObjects.length; caseNumber++) {
    const testCase = sampleObjects[caseNumber]
    it(`returns the proper classification base type for test case ${caseNumber}`, () => {
      expect(getClassificationBaseType(testCase.classification)).to.equal(testCase.baseType)
    })
  }
})

describe('getClassificationWithoutStyle', () => {
  for (let caseNumber = 0; caseNumber < sampleObjects.length; caseNumber++) {
    const testCase = sampleObjects[caseNumber]
    it(`returns the proper classification without style for test case ${caseNumber}`, () => {
      expect(getClassificationWithoutStyle(testCase.classification)).to.equal(testCase.withoutStyle)
    })
  }
})
