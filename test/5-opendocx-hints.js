/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
const yatte = require('../src/index')
const assert = require('assert')

describe('Emitting ifs appropriately for OpenDocx', function () {
  it('should include (not omit) a conditional usage that follows a content usage', function () {
    const template = '{[x]}{[if x]}what{[endif]}'
    // If answers are not emitted separately for both Content AND If fields,
    // opendocx assembly will not go as expected.)
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, [
      {
        type: 'Content',
        expr: 'x',
        id: '1'
      }, {
        type: 'If',
        expr: 'x',
        id: '2',
        contentArray: []
      }
    ])
  })
})
