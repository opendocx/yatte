const yatte = require('../src/index')
const Scope = require('../src/yobj')
const assert = require('assert')
const { TV_Family_Data, createKeyedObject } = require('./test-data')

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

  it('prelim: this._parent yields appropriate object (in object list with virtualized stack)', function () {
    const sol = { star: 'Sol', planets: [{name: 'Mercury'}, {name: 'Venus'}, {name: 'Earth'}, {name: 'Mars'}] }
    const context1 = Scope.pushObject(sol)
    const link1 = () => context1
    const context2 = Scope.pushList(sol.planets, link1)
    const link2 = () => context2
    const context3 = Scope.pushListItem(2, link2)
    const compiled = yatte.Engine.compileExpr('this._parent')
    const parent = context3.evaluate(compiled)
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

  it('prelim: _parent._parent yields appropriate object on virtualized stack', function () {
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
    let context1 = Scope.pushObject(sol)
    let link1 = () => context1
    let context2 = Scope.pushList(sol.planets, link1)
    let link2 = () => context2
    let context3 = Scope.pushListItem(2, link2)
    let link3 = () => context3
    let context4 = Scope.pushList(sol.planets[2].oceans, link3)
    let link4 = () => context4
    let context5 = Scope.pushListItem(1, link4)
    const compiled1 = yatte.Engine.compileExpr('_parent._index')
    const test1 = context5.evaluate(compiled1)
    assert.strictEqual(test1, 3)
    // add some data, which will result in a new Sol system but with the existing planets
    const newSol = {
      ...sol,
      planets: [...sol.planets, {name: 'Jupiter'}],
    }
    assert.strictEqual(sol.planets[2], newSol.planets[2])
    assert.notStrictEqual(sol.planets, newSol.planets)
    context1 = Scope.pushObject(newSol)
    context2 = Scope.pushList(newSol.planets, link1)
    const compiled2 = yatte.Engine.compileExpr('_parent._parent')
    const test2 = context5.evaluate(compiled2)
    assert.strictEqual(test2.star, 'Sol')
    assert.strictEqual(test2.planets[2].oceans.length, 2)
    assert.strictEqual(test2.planets.length, 5)
  })

  it('should correctly categorize the outcomes of a conditional expression', function () {
    const evaluator = yatte.Engine.compileExpr('test ? consequent : alternative')
    const data = { test: true, consequent: 'consequent', alternative: 'alternative' }
    let stack = Scope.pushObject(data)
    assert.deepStrictEqual(evaluator(stack.scopeProxy, stack.proxy), 'consequent')
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
    // console.log(str1)
    let stack = Scope.pushObject({ currentDate: new Date(2019, 11, 13) })
    stack = Scope.pushObject(TV_Family_Data, stack)
    const result1 = evaluator1(stack.scopeProxy, stack.proxy)
    const result2 = evaluator2(stack.scopeProxy, stack.proxy)
    assert.strictEqual(result1, result2, 'result1/result2 mismatch')
    // console.log('' + result1 + '==' + result2)
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
    const result = evaluator(stack.scopeProxy, stack.proxy)
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
    const result = evaluator(stack.scopeProxy, stack.proxy)
    assert.strictEqual(result.length, 2)
    assert.equal(result[0].__value, 'Lucy')
    assert.equal(result[1].__value, 'Ed')
  })

  it('allow chaining of "any" filter (and/or its "some" alias)', function () {
    const evaluator = yatte.Engine.compileExpr('Families | some: Children | any: Birthdate > currentDate')
    let stack = Scope.pushObject({ currentDate: new Date() })
    stack = Scope.pushObject(TV_Family_Data, stack)
    const result = evaluator(stack.scopeProxy, stack.proxy)
    assert.strictEqual(result, true)
  })

  it('allows lookup of/access to an object in a list using the find filter', function () {
    const evaluator = yatte.Engine.compileExpr('(table|find:col1==value).col2')
    const data = {
      value: 'b',
      table: [
        { col1: 'a', col2: 'A' },
        { col1: 'b', col2: 'B' },
        { col1: 'c', col2: 'C' },
      ],
    }
    const scope = Scope.pushObject(data)
    const result = scope.evaluate(evaluator)
    assert.strictEqual(result, 'B')
  })

  it('allows fetching of hybrid objects (directly)', function () {
    const evaluator = yatte.Engine.compileExpr('MyObject.NewYork')
    const states = [
      createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
      createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
      createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
      createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
    ]
    const data1 = Scope.pushObject({ states })
    const data2 = Scope.pushObject({ MyObject: { NewYork: yatte.Engine.compileExpr('states[2]') } }, data1)
    const result = evaluator(data2.scopeProxy, data2.proxy)
    assert.equal(result, 'New York')
    assert.notStrictEqual(result, 'New York')
  })

  it('allows fetching of hybrid objects (indirectly)', function () {
    const states = [
      createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
      createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
      createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
      createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
    ]
    const data1 = Scope.pushObject({ states })
    const evaluator1 = yatte.Engine.compileExpr('states|find:Name=="New York"')
    const result1 = evaluator1(data1.scopeProxy, data1.proxy)
    const data2 = Scope.pushObject({ MyObject: { State: result1 } }, data1)
    const evaluator2 = yatte.Engine.compileExpr('MyObject.State')
    const result2 = evaluator2(data2.scopeProxy, data2.proxy)
    assert.equal(result2, 'New York')
    assert.notStrictEqual(result2, 'New York')
  })

  it('allows fetching chained values from hybrid objects (directly)', function () {
    const states = [
      createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
      createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
      createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
      createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
    ]
    const data1 = Scope.pushObject({ states })
    const data2 = Scope.pushObject({ MyObject: { Michigan: yatte.Engine.compileExpr('states[1]') } }, data1)
    const evaluator = yatte.Engine.compileExpr('MyObject.Michigan.Abbreviation')
    const result = evaluator(data2.scopeProxy, data2.proxy)
    assert.strictEqual(result, 'MI')
  })

  it('allows fetching chained values from hybrid objects (indirectly)', function () {
    const states = [
      createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
      createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
      createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
      createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
    ]
    const data1 = Scope.pushObject({ states })
    const evaluator1 = yatte.Engine.compileExpr('states|find:Name=="Michigan"')
    const result1 = evaluator1(data1.scopeProxy, data1.proxy)
    const data2 = Scope.pushObject({ MyObject: { State: result1 } }, data1)
    const evaluator2 = yatte.Engine.compileExpr('MyObject.State.Abbreviation')
    const result2 = evaluator2(data2.scopeProxy, data2.proxy)
    assert.strictEqual(result2, 'MI')
  })

  it('preserve child context when fetching a list from a parent context for evaluation', function () {
    const states = [
      createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
      createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
      createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
      createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
    ]
    const data1 = Scope.pushObject({ states })
    const data2 = Scope.pushObject({ State: 'Michigan' }, data1)
    const evaluator = yatte.Engine.compileExpr('states|filter:Name==State')
    const result = evaluator(data2.scopeProxy, data2.proxy)
    assert.strictEqual(result.length, 1)
  })

  it('returns undefined when unbounded recursion occurs in an expression', function () {
    const obj = {
      SingleEntity: {
        FirstName: "J",
        LastName: "Smith",
        FullName: yatte.Engine.compileExpr('FirstName + " " + FullName')
      },
    }
    const scope = Scope.pushObject(obj)
    const evaluator = yatte.Engine.compileExpr('SingleEntity.FullName')
    const result = evaluator(scope.scopeProxy, scope.proxy)
    assert.strictEqual(result, undefined)
    // it seems like it should probably throw a RecursionError instead of returning undefined??
  })

  // it('throws when unbounded recursion occurs in a template', function () {
  //   const obj = {
  //     SingleEntity: {
  //       FirstName: "John",
  //       LastName: "Smith",
  //       FullName: yatte.compileText('{[FirstName]} {[FullName]}')
  //     },
  //   }
  //   const scope = Scope.pushObject(obj)
  //   const template = '{[SingleEntity.FullName]}'
  //   try {
  //     const result = yatte.assembleText(template, scope)
  //     assert.fail('expected error not thrown')
  //   } catch (err) {
  //     assert.equal(err.name, 'RecursionError')
  //   }
  // })

  // it('throws when list filters have no arguments', function () {
  //   const states = [
  //     createKeyedObject({Name: 'Illinois', Abbreviation: 'IL'}, 'Name'),
  //     createKeyedObject({Name: 'Michigan', Abbreviation: 'MI'}, 'Name'),
  //     createKeyedObject({Name: 'New York', Abbreviation: 'NY'}, 'Name'),
  //     createKeyedObject({Name: 'Utah', Abbreviation: 'UT'}, 'Name'),
  //   ]
  //   const scope = Scope.pushObject({ states })
  //   const evaluator = yatte.Engine.compileExpr('states|any')
  //   assert.throws(() => evaluator(scope.scopeProxy, scope.proxy), // no argument on filter
  //     {
  //       name: 'Error',
  //       message: 'Invalid argument passed to the Any filter: undefined'
  //     })
  // })

  // it('correctly compiles & executes expressions using the flat() function', function () {
  //   const evaluator = yatte.Engine.compileExpr('(Families | map: (Children | map: Name)).flat()') // .flat only works for Node 11 or later
  //   let stack = Scope.pushObject(TV_Family_Data)
  //   const result = evaluator(stack.scopeProxy, stack.proxy)
  //   assert.deepEqual(result.length, 27)
  // })

})
