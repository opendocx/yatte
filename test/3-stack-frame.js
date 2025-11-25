/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
const Scope = require('../src/yobj')
const Engine = require('../src/base-templater')
const { Earth_Data, simVirtuals, makeObject } = require('./test-data')
const assert = require('assert')

describe('Proper operation of the context stack', function () {
  it('should evaluate an expression based on a context stack', function () {
    //
    const objContext = { a: 'global' }
    const objLocals = { b: 'local', c: [{ d: 'one' }, { d: 'two' }, { d: 'three' }] }
    let stack = Scope.pushObject(objContext)
    stack = Scope.pushObject(objLocals, stack)

    const frame = stack // .peek()
    const evaluator = Engine.compileExpr('c|punc:"1, 2, and 3"')
    const iterable = frame.evaluate(evaluator)
    stack = Scope.pushList(iterable, stack)
    const indices = stack.indices
    assert.notStrictEqual(objLocals.c, iterable)
    assert(!objLocals.punc)
  })

  it('should build and properly use a nested context stack', function () {
    //
    const objContext = simVirtuals({
      a: 'global',
      t: [3, 1, 4, 1, 5, 9, 2, 6],
      pi: function (obj) { return obj.t.reduce((prev, curr, idx) => prev + curr * Math.pow(10, -idx), 0) }
    })
    const lProto = simVirtuals({
      cpi: function (obj) { return (obj.c.length * obj.pi).toFixed(8) }
    })
    const cProto = simVirtuals({
      up: function (obj) { return obj.d.toUpperCase() }
    })
    const objLocals = makeObject(lProto, {
      b: 'local',
      c: [
        makeObject(cProto, { d: 'one' }),
        makeObject(cProto, { d: 'two' }),
        makeObject(cProto, { d: 'three' })
      ],
    })
    let stack = Scope.pushObject(objContext)
    stack = Scope.pushObject(objLocals, stack)
    stack = Scope.pushList(objLocals.c, stack)
    stack = Scope.pushListItem(1, stack)
    const evaluator = Engine.compileExpr('up + "." + b + "." + a + " + " + cpi')
    const value = stack.evaluate(evaluator)
    assert.strictEqual(value, 'TWO.local.global + ' + (3 * 3.1415926).toFixed(8))
  })

  it('should correctly evaluate an expression that refers to a wrapped string', function () {
    const data = { ClientName: 'John Doe', DPOAType: new String('Contingent') }
    const stack = Scope.pushObject(data)
    const evaluator = Engine.compileExpr('DPOAType=="Contingent"')
    const value = stack.evaluate(evaluator)
    assert.strictEqual(value, true)
  })

  it('should evaluate an expression against an object proxy', function () {
    const stack = Scope.pushObject(Earth_Data)
    const p = stack.proxy
    assert.strictEqual(p.ContinentCount, 7)
    assert.strictEqual(p._parent, null)
  })

  it('should evaluate an expression against a nested object proxy', function () {
    let stack = Scope.pushObject(Earth_Data) // start on Earth
    stack = Scope.pushList(Earth_Data.Continents, stack) // List Continents
    stack = Scope.pushListItem(3, stack) // we're on continent #4 (North America)
    const p = stack.proxy
    assert.strictEqual(p.SurfaceArea, 24709000) // property of North America
    assert.strictEqual(p.LakeCount, 5) // virtual on Continents
    assert.strictEqual(p.Planet, undefined) // it's an object proxy, so lookup (up to planet scope) does not happen
    assert.strictEqual(p._parent.Planet, 'Earth') // _parent returns a scope proxy for the parent, so Planet is then available
  })

  it('should recognize stacks based on the same data as equivalent (or not)', function () {
    const stack = Scope.pushObject(Earth_Data) // start on Earth
    const stackA = Scope.pushList(Earth_Data.Continents, stack) // List Continents
    const stackB = Scope.pushList(Earth_Data.Continents, stack) // List Continents
    const stackA1 = Scope.pushListItem(3, stackA) // we're on continent #4 (North America)
    const stackA2 = Scope.pushListItem(3, stackA) // we're on continent #4 (North America)
    const stackB1 = Scope.pushListItem(3, stackB) // we're on continent #4 (North America)
    const stackB2 = Scope.pushListItem(2, stackB) // we're on continent #3 (Europe)
    assert.strictEqual(stackA1.valueEqualTo(stackA2), true)
    assert.strictEqual(stackA2.valueEqualTo(stackA1), true)
    assert.strictEqual(stackA1.valueEqualTo(stackB1), true)
    assert.strictEqual(stackB1.valueEqualTo(stackA1), true)
    assert.strictEqual(stackA.valueEqualTo(stackB), true)
    // but non-equivalent stacks should return false
    assert.strictEqual(stackA1.valueEqualTo(stackB2), false)
    assert.strictEqual(stackA1.valueEqualTo(stackA), false)
    assert.strictEqual(stackA1.valueEqualTo(stack), false)
    assert.strictEqual(stackA.valueEqualTo(stack), false)
  })
})
