/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
const yatte = require('../src/index')
const assert = require('assert')
const Scope = yatte.Scope

describe('Assembly of meta template via exported API', function () {
  it('should assemble a meta template', function () {
    const metaTemplate = `
{[ident1]}
{[ident2.ident3]}
{[if x]}
{[ident4]}
{[if y]}
{[ident5]}
{[else]}
{[ident6]}
{[endif]}
{[endif]}
{[list z]}
{[ident7]}
{[endlist]}
`
    const data = new yatte.Scope({
      ident1: { description: 'mock template' },
      ident2: { name: 'something',
        ident3: { description: 'another mock template' } },
      x: true,
      ident4: { description: 'mock template #4' },
      y: false,
      ident5: { description: 'mockk template #5' },
      ident6: { description: 'mock template #6' },
      z: [
        {
          iter: 1,
          ident7: { description: 'mock template #7' }
        }, {
          iter: 2,
          ident7: { description: 'mock template #7' }
        }
      ]
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    assert(typeof result === 'object')
    assert(typeof result.value === 'object')
    assert.strictEqual(result.value.type, 'Program')
    assert(Array.isArray(result.value.body))
    assert.strictEqual(result.value.body.length, 6)

    let actual = result.value.body[0]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident1')
    assert.deepStrictEqual(actual.expression, {
      type: 'Identifier',
      name: 'ident1',
      constant: false,
    })
    assert.deepStrictEqual(actual.context, [])
    let actualValue = actual.data.valueOf()
    assert.strictEqual(actualValue.ident1.description, 'mock template')
    let newStack = Scope.pushContext(actual.context, data)
    let actualValue2 = newStack.valueOf()
    assert.strictEqual(actualValue2.ident1.description, 'mock template')

    actual = result.value.body[1]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident2.ident3')
    assert.deepStrictEqual(actual.expression, {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'ident2', constant: false },
      property: { type: 'Identifier', name: 'ident3' },
      computed: false,
      constant: false,
    })
    assert.deepStrictEqual(actual.context, [])
    actualValue = actual.data.valueOf()
    assert.strictEqual(actualValue.ident2.ident3.description, 'another mock template')
    newStack = Scope.pushContext(actual.context, data)
    actualValue2 = newStack.valueOf()
    assert.strictEqual(actualValue2.ident2.ident3.description, 'another mock template')

    actual = result.value.body[2]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident4')
    assert.deepStrictEqual(actual.expression, {
      type: 'Identifier',
      name: 'ident4',
      constant: false,
    })

    actual = result.value.body[3]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident6')
    assert.deepStrictEqual(actual.expression, {
      type: 'Identifier',
      name: 'ident6',
      constant: false,
    })

    actual = result.value.body[4]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident7')
    assert.deepStrictEqual(actual.expression, {
      type: 'Identifier',
      name: 'ident7',
      constant: false,
    })
    assert.deepStrictEqual(actual.context, ['z', 0])
    actualValue = actual.data.valueOf()
    assert.strictEqual(actualValue.ident7.description, 'mock template #7')
    assert.strictEqual(actualValue.iter, 1)
    newStack = Scope.pushContext(actual.context, data)
    actualValue2 = newStack.valueOf()
    assert.strictEqual(actualValue2.ident7.description, 'mock template #7')
    assert.strictEqual(actualValue2.iter, 1)

    actual = result.value.body[5]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident7')
    assert.deepStrictEqual(actual.expression, {
      type: 'Identifier',
      name: 'ident7',
      constant: false,
    })
    assert.deepStrictEqual(actual.context, ['z', 1])
    actualValue = actual.data.valueOf()
    assert.strictEqual(actualValue.ident7.description, 'mock template #7')
    assert.strictEqual(actualValue.iter, 2)
    newStack = Scope.pushContext(actual.context, data)
    actualValue2 = newStack.valueOf()
    assert.strictEqual(actualValue2.ident7.description, 'mock template #7')
    assert.strictEqual(actualValue2.iter, 2)
  })
})
