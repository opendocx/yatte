//const yatte = require('../src/index')
const yatte = require('../lib/yatte.min')
const assert = require('assert')

describe('Compiling text templates via exported API', function () {
  it('should reuse a compiled text template rather than re-compiling it', function () {
    const evaluator = yatte.compileText('{[FirstName]} {[LastName]}')
    const evaluator2 = yatte.compileText('{[FirstName]} {[LastName]}')
    assert.strictEqual(evaluator, evaluator2)
  })
})
