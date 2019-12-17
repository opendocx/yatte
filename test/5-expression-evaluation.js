const yatte = require('../src/index')
const Scope = require('../src/yobj')
const assert = require('assert')
const { TV_Family_Data } = require('./test-data')

describe('Executing expressions compiled via exported API', function () {

  it('prelim: this._parent yields appropriate object (in object list)', function () {
    const sol = { star: 'Sol', planets: [{name: 'Mercury'}, {name: 'Venus'}, {name: 'Earth'}, {name: 'Mars'}] }
    let context = Scope.pushObject(sol)
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    const compiled = yatte.Engine.compileExpr('this._parent')
    const parent = context.evaluate(compiled)
    assert.strictEqual(parent.__value, sol)
  })

  it('prelim: this._parent yields appropriate object (in primitive list)', function () {
    const sol = { star: 'Sol', planets: ['Mercury', 'Venus', 'Earth', 'Mars'] }
    let context = Scope.pushObject(sol)
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    const proxy = context.scopeProxy
    const prelimTest = proxy.valueOf()
    assert.strictEqual(prelimTest, 'Earth')
    const compiled = yatte.Engine.compileExpr('this._parent')
    const parent = context.evaluate(compiled)
    assert.strictEqual(parent.__value, sol)
  })

  it('prelim: this._parent yields appropriate object (when parent is primitive?)', function () {
    const sol = { star: 'Sol', planets: ['Mercury', 'Venus', 'Earth', 'Mars'] }
    const unrelatedList = [{name: 'Greg'}, {name: 'Marsha'}, {name: 'Jan'}, {name: 'Cindy'}]
    let context = Scope.pushObject(sol)
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    context = Scope.pushList(unrelatedList, context)
    context = Scope.pushListItem(0, context)
    const proxy = context.scopeProxy
    const prelimTest1 = proxy.valueOf()
    assert.strictEqual(prelimTest1, unrelatedList[0])
    const prelimTest2 = proxy._parent.valueOf()
    assert.strictEqual(prelimTest2, sol.planets[2])
    const compiled = yatte.Engine.compileExpr('this._parent')
    const parent = context.evaluate(compiled)
    assert.strictEqual(parent.valueOf(), 'Earth')
  })

  it('prelim: this._parent yields appropriate object (in primitive list with unrelated parent primitive)', function () {
    const sol = { star: 'Sol', planets: ['Mercury', 'Venus', 'Earth', 'Mars'] }
    const unrelatedList = ['Greg', 'Marsha', 'Jan', 'Cindy']
    let context = Scope.pushObject(sol)
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    context = Scope.pushList(unrelatedList, context)
    context = Scope.pushListItem(0, context)
    const proxy = context.scopeProxy
    const prelimTest1 = proxy.valueOf()
    assert.strictEqual(prelimTest1, unrelatedList[0])
    const prelimTest2 = proxy._parent.valueOf()
    assert.strictEqual(prelimTest2, sol.planets[2])
    const compiled = yatte.Engine.compileExpr('this._parent')
    const parent = context.evaluate(compiled)
    assert.strictEqual(parent.valueOf(), 'Earth')
  })

  // test removed because it is not useful... you never *need* to be able to use _parent as a property of a known
  // object, because if you know what the object is, you know what its parent is. The only exception is _parent._parent.
  // it('prelim: child._parent yields appropriate object', function () {
  //   const sol = { star: 'Sol', planets: [{name: 'Mercury'}, {name: 'Venus'}, {name: 'Earth'}, {name: 'Mars'}] }
  //   let context = Scope.pushObject(sol)
  //   const compiled = yatte.Engine.compileExpr('planets[1]._parent')
  //   const parent = context.evaluate(compiled)
  //   assert.strictEqual(parent.__value, sol)
  // })
  
  it('prelim: _parent._parent yields appropriate object', function () {
    const sol = {
      star: 'Sol',
      planets: [
        {name: 'Mercury'},
        {name: 'Venus'},
        {
          name: 'Earth',
          oceans: ['Atlantic', 'Pacific'],
        },
        {name: 'Mars'}
      ]
    }
    let context = Scope.pushObject(sol)
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    context = Scope.pushList(sol.planets[2].oceans, context)
    context = Scope.pushListItem(1, context)
    const compiled1 = yatte.Engine.compileExpr('_parent._index')
    const test1 = context.evaluate(compiled1)
    assert.strictEqual(test1, 3)
    const compiled2 = yatte.Engine.compileExpr('_parent._parent')
    const test2 = context.evaluate(compiled2)
    assert.strictEqual(test2.star, 'Sol')
    assert.strictEqual(test2.planets.length, 4)
  })

  it('should correctly categorize the outcomes of a conditional expression', function () {
    const evaluator = yatte.Engine.compileExpr('test ? consequent : alternative')
    const data = { test: true, consequent: 'consequent', alternative: 'alternative' }
    let stack = Scope.pushObject(data)
    assert.deepStrictEqual(evaluator(stack.scopeProxy), 'consequent')
  })

  it('re-compiling a normalized list filter expression produces the same normalization and compilation', function () {
    // note: compiling a normalized list filter expression shoulod produce the same AST as the original (non-normalized) list filter expression
    // we do this so downline features that depend on the AST can reliably know what they're going to get.
    yatte.Engine.compileExpr.cache = {}
    const evaluator1 = yatte.Engine.compileExpr('Families | any: Children | any: Birthdate > currentDate')
    yatte.Engine.compileExpr.cache = {}
    const evaluator2 = yatte.Engine.compileExpr(' Families|any:"Children|any:&quot;Birthdate>currentDate&quot;"')
    const str1 = evaluator1.toString()
    const str2 = evaluator2.toString()
    assert.strictEqual(str1, str2)
    console.log(str1)
    let stack = Scope.pushObject({ currentDate: new Date(2019, 11, 13) })
    stack = Scope.pushObject(TV_Family_Data, stack)
    const result1 = evaluator1(stack.scopeProxy)
    const result2 = evaluator2(stack.scopeProxy)
    assert.strictEqual(result1, result2, 'result1/result2 mismatch')
    console.log('' + result1 + '==' + result2)
    assert.strictEqual(result1, true, 'evaluation result was incorrect')
    assert.strictEqual(result2, true, 'evaluation result2 was incorrect')
  })

  it('correctly evaluates array concatenation and filtering out falsy values', function () {
    const evaluator = yatte.Engine.compileExpr('[].concat(Client, Spouse, Children)|filter:this')
    const data = {
      Client: { name: 'John Smith' },
      Children: [
        { name: 'Ken Smith' },
        null,
        { name: 'Susan Smith' }
      ]
    }
    let stack = Scope.pushObject(data)
    const result = evaluator(stack.scopeProxy)
    assert.strictEqual(result.length, 3)
    assert.deepStrictEqual(result[0].__value, { name: 'John Smith' })
    assert.deepStrictEqual(result[1].__value, { name: 'Ken Smith' })
    assert.deepStrictEqual(result[2].__value, { name: 'Susan Smith' })
  })

  // list Children|filter:this.LastName == _parent.LastName
  // list Children|filter:LastName == _parent.LastName
  // list WitnessNames|filter:this != Spouse.Name
  it('handles list filters that refer both to "this" and stuff in the broader scope/context', function () {
    const evaluator = yatte.Engine.compileExpr('WitnessNames|filter:this != Spouse.Name')
    const data = {
      Client: { Name: 'Jane' },
      Spouse: { Name: 'Kevin' },
      WitnessNames: ['Lucy', 'Kevin', 'Ed']
    }
    let stack = Scope.pushObject(data)
    const result = evaluator(stack.scopeProxy)
    assert.strictEqual(result.length, 2)
    assert.equal(result[0].__value, 'Lucy')
    assert.equal(result[1].__value, 'Ed')
  })

  it('allow chaining of "any" filter (and/or its "some" alias)', function () {
    const evaluator = yatte.Engine.compileExpr('Families | some: Children | any: Birthdate > currentDate')
    let stack = Scope.pushObject({ currentDate: new Date() })
    stack = Scope.pushObject(TV_Family_Data, stack)
    const result = evaluator(stack.scopeProxy)
    assert.strictEqual(result, true)
  })

  // it('correctly compiles & executes expressions using the flat() function', function () {
  //   const evaluator = yatte.Engine.compileExpr('(Families | map: (Children | map: Name)).flat()') // .flat only works for Node 11 or later
  //   let stack = Scope.pushObject(TV_Family_Data)
  //   const result = evaluator(stack.scopeProxy)
  //   assert.deepEqual(result.length, 27)
  // })

})
