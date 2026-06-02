/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
const yatte = require('../src/index')
const assert = require('assert')
const { assertASTMatches } = require('./test-helpers')
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
    assertASTMatches(actual.expression, {
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
    assertASTMatches(actual.expression, {
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
    assertASTMatches(actual.expression, {
      type: 'Identifier',
      name: 'ident4',
      constant: false,
    })

    actual = result.value.body[3]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident6')
    assertASTMatches(actual.expression, {
      type: 'Identifier',
      name: 'ident6',
      constant: false,
    })

    actual = result.value.body[4]
    assert.strictEqual(actual.type, 'ExpressionStatement')
    assert.strictEqual(actual.text, 'ident7')
    assertASTMatches(actual.expression, {
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
    assertASTMatches(actual.expression, {
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

  it('should preserve parent object context for list-item virtuals in meta assembly', function () {
    const metaTemplate = `
{[list obj1.obj2]}
{[virtual]}
{[endlist]}
`
    const data = Scope.pushObject({
      obj1: {
        shared: 'S',
        obj2: [
          { local: 'a', virtual: yatte.Engine.compileExpr('shared + local') },
          { local: 'b', virtual: yatte.Engine.compileExpr('shared + local') }
        ]
      }
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    assert.strictEqual(result.value.body.length, 2)
    const evaluator = yatte.Engine.compileExpr('virtual')
    const values = result.value.body.map(node => {
      const rebuiltScope = Scope.pushContext(node.context, data)
      return rebuiltScope.evaluate(evaluator)
    })
    assert.deepStrictEqual(values, ['Sa', 'Sb'])
  })

  it('should preserve _parent context for list-item virtuals in meta assembly', function () {
    const metaTemplate = `
{[list obj1.obj2]}
{[virtual]}
{[endlist]}
`
    const data = Scope.pushObject({
      obj1: {
        shared: 'S',
        obj2: [
          { local: 'a', virtual: yatte.Engine.compileExpr('_parent.shared + local') },
          { local: 'b', virtual: yatte.Engine.compileExpr('_parent.shared + local') }
        ]
      }
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    assert.strictEqual(result.value.body.length, 2)
    const evaluator = yatte.Engine.compileExpr('virtual')
    const values = result.value.body.map(node => {
      const rebuiltScope = Scope.pushContext(node.context, data)
      return rebuiltScope.evaluate(evaluator)
    })
    assert.deepStrictEqual(values, ['Sa', 'Sb'])
  })

  it('should preserve parent context through meta node scope handoff to text assembly', function () {
    const fileTemplateVirtual = function (scope) {
      return new yatte.IndirectVirtual(
        {
          typeName: 'MockType',
          name: 'MockTemplate',
          type: 'file',
          templateDef: { text: '{[virtual]}' }
        },
        scope,
        'text'
      )
    }
    fileTemplateVirtual.logic = true
    const metaTemplate = `
{[list obj1.obj2]}
{[FileTemplate]}
{[endlist]}
`
    const data = Scope.pushObject({
      obj1: {
        shared: 'S',
        obj2: [
          { local: 'a', virtual: yatte.Engine.compileExpr('shared + local'), FileTemplate: fileTemplateVirtual },
          { local: 'b', virtual: yatte.Engine.compileExpr('shared + local'), FileTemplate: fileTemplateVirtual }
        ]
      }
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    const values = result.value.body.map(node => {
      const tmplInfo = node.data.getProperty(node.expression.name)
      const scopeForAssembly = tmplInfo.scope || node.data
      return yatte.assembleText(tmplInfo.templateDef.text, scopeForAssembly).value
    })
    assert.deepStrictEqual(values, ['Sa', 'Sb'])
  })

  it('should fully unwind nested member-expression list contexts before later meta fields', function () {
    const metaTemplate = `
{[list test1]}
{[a]}
{[list test2.test3]}
{[c]}
{[endlist]}
{[b]}
{[endlist]}
{[x]}
`
    const data = Scope.pushObject({
      x: 'X',
      test1: [
        {
          a: 'A',
          b: 'B',
          test2: {
            test3: [
              { c: 'C1' },
              { c: 'C2' }
            ]
          }
        }
      ]
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    assert.strictEqual(result.value.body.length, 5)
    const xNode = result.value.body.find(node => node.text === 'x')
    assert.ok(xNode, 'expected x expression node')
    assert.deepStrictEqual(xNode.context, [])
    const rebuiltScope = Scope.pushContext(xNode.context, data)
    const xValue = rebuiltScope.evaluate(yatte.Engine.compileExpr('x'))
    assert.strictEqual(xValue, 'X')
  })

  it('should keep meta node contexts stable for nested list map member paths', function () {
    const metaTemplate = `
{[list test1]}
{[list test2.test3|map:test4.test5]}
{[x]}
{[endlist]}
{[b]}
{[endlist]}
{[outside]}
`
    const data = Scope.pushObject({
      outside: 'OUT',
      x: 'TOP',
      test1: [
        {
          b: 'B1',
          test2: {
            test3: [
              {
                test4: {
                  test5: { x: 'T5' }
                }
              }
            ]
          }
        }
      ]
    })
    const result = yatte.assembleMeta(metaTemplate, data)
    const xNode = result.value.body.find(node => node.text === 'x')
    const bNode = result.value.body.find(node => node.text === 'b')
    const outsideNode = result.value.body.find(node => node.text === 'outside')
    assert.ok(xNode && bNode && outsideNode)
    assert.deepStrictEqual(bNode.context, ['test1', 0])
    assert.deepStrictEqual(outsideNode.context, [])
    const xValue = Scope.pushContext(xNode.context, data).evaluate(yatte.Engine.compileExpr('x'))
    const bValue = Scope.pushContext(bNode.context, data).evaluate(yatte.Engine.compileExpr('b'))
    const outsideValue = Scope.pushContext(outsideNode.context, data).evaluate(yatte.Engine.compileExpr('outside'))
    assert.strictEqual(xValue, 'T5')
    assert.strictEqual(bValue, 'B1')
    assert.strictEqual(outsideValue, 'OUT')
  })
})
