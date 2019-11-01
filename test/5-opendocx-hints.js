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
        exprAst: {
          type: 'Identifier',
          name: 'x',
          constant: false
        }
      }, {
        type: 'If',
        expr: 'x',
        exprAst: {
          type: 'Identifier',
          name: 'x',
          constant: false
        },
        contentArray: []
      }
    ])
  })
})
