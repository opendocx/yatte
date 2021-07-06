const yatte = require('../src/index')
const assert = require('assert')

describe('Compiling text templates via exported API', function () {
  it('should reuse a compiled text template rather than re-compiling it', function () {
    const evaluator = yatte.compileText('{[FirstName]} {[LastName]}')
    const evaluator2 = yatte.compileText('{[FirstName]} {[LastName]}')
    assert.strictEqual(evaluator, evaluator2)
  })
  it('should compile the if/endif template', function () {
    const template = '{[if true]}A{[endif]}'
    const evaluator = yatte.compileText(template)
    assert.strictEqual(typeof evaluator, 'function')
    assert.strictEqual(Array.isArray(evaluator.logic), true)
    const asmResult = evaluator({})
    assert.strictEqual(asmResult.toString(), 'A')
  })
  it('should compile the missing endif template with an error', function () {
    const template = '{[if true]}A'
    const expectedError = 'The If has no matching EndIf'
    const evaluator = yatte.compileText(template, false)
    assert.strictEqual(typeof evaluator, 'function')
    assert.strictEqual(evaluator.error, expectedError)
    assert.strictEqual(evaluator.logic, true)
    const asmResult = evaluator({})
    assert.strictEqual(typeof asmResult, 'object')
    assert.strictEqual(asmResult.value, null)
    assert.deepStrictEqual(asmResult.errors, [expectedError])
  })
})