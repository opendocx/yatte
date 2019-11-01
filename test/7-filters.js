const assert = require('assert')
const yatte = require('../src/index')

describe('text formatting', function () {
  it('upper', function () {
    const evaluator = yatte.Engine.compileExpr('text|upper')
    assert.equal(evaluator({text: 'hello World'}), 'HELLO WORLD')
  })
  it('lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|lower')
    assert.equal(evaluator({text: 'hello World'}), 'hello world')
  })
  it('initcap', function () {
    const evaluator = yatte.Engine.compileExpr('text|initcap')
    assert.equal(evaluator({text: 'hello World'}), 'Hello World')
  })
  it('initcap forced lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|initcap:true')
    assert.equal(evaluator({text: 'hello World'}), 'Hello world')
  })
  it('titlecaps', function () {
    const evaluator = yatte.Engine.compileExpr('text|titlecaps')
    assert.equal(evaluator({text: 'HELLO world'}), 'HELLO World')
  })
  it('titlecaps forced lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|titlecaps:true')
    assert.equal(evaluator({text: 'hello World'}), 'Hello World')
  })
})

describe('number formatting', function () {
  it('cardinal', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.equal(evaluator({num: 123}), 'one hundred twenty-three')
  })

  it('cardinal - over one thousand', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.equal(evaluator({num: 1234}), 'one thousand two hundred thirty-four')
  })
})

describe('contains filter', function () {
  it('string array contains string', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:"Joe"')
    const evaluator2 = yatte.Engine.compileExpr('array|contains:"John"')
    const data = { array: ['Margot', null, 'Joe', 'Lou'] }
    assert.equal(evaluator(data), true)
    assert.equal(evaluator2(data), false)
  })
  it('number array contains number', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:3')
    const data = { array: [NaN, null, undefined, 4, 3, 2, 1] }
    assert.equal(evaluator(data), true)
    data.array.splice(4,1)
    assert.equal(evaluator(data), false)
  })
  it('object array contains object', function () {
    const data = { array: [{name:'Joel'},{name:'Joe',lastName:'Schmoe'},null,undefined,{name:'Joe'}] }
    const evaluator = yatte.Engine.compileExpr('array|contains:{name:"Joe"}')
    assert.equal(evaluator(data), true)
    data.array.pop()
    assert.equal(evaluator(data), false)
  })
  it('array of string wrappers contains string', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:"Joe"')
    const evaluator2 = yatte.Engine.compileExpr('array|contains:"John"')
    const data = { array: [new String('Margot'), null, new String('Joe'), new String('Lou')] }
    data.array[0].First = 'Margot'
    data.array[0].Last = 'Hemingway'
    data.array[2].First = 'Joe',
    data.array[2].Last = 'Schmoe',
    data.array[3].First = 'Lou'
    assert.equal(evaluator(data), true)
    assert.equal(evaluator2(data), false)
  })
  it('string contains substring', function () {
    const data = { str: 'Quick brown fox jumps over the lazy dog' }
    const evaluator = yatte.Engine.compileExpr('str|contains:"fox"')
    const evaluator2 = yatte.Engine.compileExpr('str|contains:"Fox"')
    assert.equal(evaluator(data), true)
    assert.equal(evaluator2(data), false)
  })
  // array of strings contains wrapped primitive String
  // array of wrapped primitive string contains object???
})

const data_Children = {
  Children: [
    { Name: 'John', Birth: new Date(1970, 8, 5) },
    { Name: 'Alice', Birth: new Date(1970, 8, 5) },
    { Name: 'Eric', Birth: new Date(2007, 9, 24) },
    { Name: 'Ted', Birth: new Date(2007, 9, 24) },
    { Name: 'Mark', Birth: new Date(2007, 9, 24) },
    { Name: 'Yolanda', Birth: new Date(2000, 1, 1) },
    { Name: 'Beth', Birth: new Date(2000, 1, 1) }
  ]
}

