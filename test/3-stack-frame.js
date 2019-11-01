const Scope = require('../src/scope')
const Engine = require('../src/base-templater')
const assert = require('assert')

describe('Proper operation of the context stack', function () {
  it('should assemble a simple template', function () {
    //
    const objContext = { a: 'global' }
    const objLocals = { b: 'local', c: [{ d: 'one' }, { d: 'two' }, { d: 'three' }] }
    let stack = Scope.pushObject(objContext)
    stack = Scope.pushObject(objLocals, stack)

    const frame = stack // .peek()
    const evaluator = Engine.compileExpr('c|punc:"1, 2, and 3"')
    const iterable = frame._evaluate(evaluator)
    stack = Scope.pushList(iterable, stack, 'c')
    const indices = stack._indices
    assert.notStrictEqual(objLocals.c, iterable)
    assert(!objLocals.punc)
  })
})
