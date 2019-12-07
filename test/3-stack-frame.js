const Scope = require('../src/yobject')
const Engine = require('../src/base-templater')
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
    const iterable = frame._evaluate(evaluator)
    stack = Scope.pushList(iterable, stack)
    const indices = stack._indices
    assert.notStrictEqual(objLocals.c, iterable)
    assert(!objLocals.punc)
  })
  it('should build and properly use a nested context stack', function () {
    //
    const objContext = { a: 'global', t: [ 3, 1, 4, 1, 5, 9, 2, 6 ]}
    const virtuals1 = { pi: function (obj) { return obj.t.reduce((prev, curr, idx) => prev + curr * Math.pow(10,-idx), 0)}}
    const objLocals = { b: 'local', c: [{ d: 'one' }, { d: 'two' }, { d: 'three' }] }
    const virtuals2 = { cpi: function (obj) { return (obj.c.length * obj.pi).toFixed(8) } }
    const virtuals3 = { up: function (obj) { return obj.d.toUpperCase() } }
    let stack = Scope.pushObject(objContext, null, virtuals1)
    stack = Scope.pushObject(objLocals, stack, virtuals2)
    stack = Scope.pushList(objLocals.c, stack, virtuals3)
    stack = Scope.pushListItem(1, stack)
    const evaluator = Engine.compileExpr('up + "." + b + "." + a + " + " + cpi')
    const value = stack._evaluate(evaluator)
    assert.strictEqual(value, 'TWO.local.global + ' + (3 * 3.1415926).toFixed(8))
  })
  it('should correctly evaluate an expression that refers to a wrapped string', function () {
    const data = { ClientName: 'John Doe', DPOAType: new String('Contingent') }
    let stack = Scope.pushObject(data)
    const evaluator = Engine.compileExpr('DPOAType=="Contingent"')
    const value = stack._evaluate(evaluator)
    assert.strictEqual(value, true)
  })
})
