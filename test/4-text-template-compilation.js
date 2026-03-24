/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
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

  it('setLabel should work for compiled text templates', function () {
    yatte.compileText.cache = new Map()
    const compiled = yatte.compileText('{[FirstName]} {[LastName]}')
    const warnings = []
    const priorWarn = console.warn
    console.warn = (message) => warnings.push(message)
    try {
      yatte.setLabel(compiled, 'Entity::DisplayName')
      yatte.setLabel(compiled, 'Entity::DisplayName')
      yatte.setLabel(compiled, 'Entity::FormalName')
    } finally {
      console.warn = priorWarn
    }
    assert.strictEqual(compiled.lbl, 'Entity::FormalName')
    assert.strictEqual(warnings.length, 1)
    assert.ok(warnings[0].includes('Entity::DisplayName'))
    assert.ok(warnings[0].includes('Entity::FormalName'))
  })

  it('setLabel should reveal overwrite collisions on cached compiled templates', function () {
    yatte.compileText.cache = new Map()
    const compiled1 = yatte.compileText('{[FirstName]} {[LastName]}')
    const compiled2 = yatte.compileText('{[FirstName]} {[LastName]}')
    assert.strictEqual(compiled1, compiled2)
    const warnings = []
    const priorWarn = console.warn
    console.warn = (message) => warnings.push(message)
    try {
      yatte.setLabel(compiled1, 'TypeA::Template')
      yatte.setLabel(compiled2, 'TypeB::Template')
    } finally {
      console.warn = priorWarn
    }
    assert.strictEqual(compiled1.lbl, 'TypeB::Template')
    assert.strictEqual(warnings.length, 1)
  })
})
