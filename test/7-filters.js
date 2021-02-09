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

  it('cardinal - null input', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.equal(evaluator({num: null}), null)
  })

  it('cardinal - NaN input', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.equal(evaluator({num: NaN}), null)
  })

  it('base 26 - under 26', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.equal(evaluator({num: 3}), 'c')
  })

  it('base 26 - over 26', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"A"')
    assert.equal(evaluator({num: 30}), 'AD')
  })

  it('base 26 - null input', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.equal(evaluator({num: null}), null)
  })

  it('base 26 - NaN input', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.equal(evaluator({num: NaN}), null)
  })
})

describe('date formatting', function () {
  it('MM/dd/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MM/dd/yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '01/02/2019')
  })

  it('MM/DD/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MM/DD/YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '01/02/2019')
  })

  it('M/d/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"M/d/yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '1/2/2019')
  })

  it('M/D/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"M/D/YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '1/2/2019')
  })

  it('dd/MM/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"dd/MM/yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '02/01/2019')
  })

  it('DD/MM/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"DD/MM/YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '02/01/2019')
  })

  it('d/M/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"d/M/yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '2/1/2019')
  })

  it('D/M/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"D/M/YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '2/1/2019')
  })

  it('do \'day of\' MMMM yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"do \'day of\' MMMM yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '2nd day of January 2019')
  })

  it('Do [day of] MMMM YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"Do [day of] MMMM YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), '2nd day of January 2019')
  })

  it('MMMM d, yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MMMM d, yyyy"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), 'January 2, 2019')
  })

  it('MMMM D, YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MMMM D, YYYY"')
    assert.equal(evaluator({d: new Date(2019, 0, 2)}), 'January 2, 2019')
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

// for purposes of the group filter's _key, wrapped strings must be simplified, so include wrapped strings...
const surnameData = {
  surnames: [
    'Jones',
    'McGillicutty',
    'Jones',
    new String('Jones'),
    'Smith',
    new String('Jones'),
    'Smith',
    'Johnson'
  ]
}
// give one of the string objects a property (to test whether it is correctly ignored)
surnameData.surnames[5].firstName = 'Ken'

describe('group filter', function () {
  it('groups a list of strings', function () {
    const evaluator = yatte.Engine.compileExpr('surnames|group:this')
    const value = evaluator(surnameData, surnameData)
    const v = surnameData.surnames
    assert.deepEqual(value, [
      { _key: 'Jones',        _values: [v[0], v[2], v[3], v[5]] },
      { _key: 'McGillicutty', _values: [v[1]] },
      { _key: 'Smith',        _values: [v[4], v[6]] },
      { _key: 'Johnson',      _values: [v[7]] },
    ])
  })

  it('simplifies a list of strings to unique values and alphabetizes them', function () {
    const evaluator = yatte.Engine.compileExpr('surnames|group:this|map:_key|sort:this')
    const value = evaluator(surnameData, surnameData)
    assert.deepEqual(value, ['Johnson', 'Jones', 'McGillicutty', 'Smith'])
  })
})

describe('reduce filter', function () {
  it('sums a series of numbers (no initial value)', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result+this')
    const data = { array: [0, 1, 2, 3, 4] }
    const value = evaluator(data, data)
    assert.strictEqual(value, 10)
  })
  it('sums a series of numbers (with initial value)', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result+this:10')
    const data = { array: [0, 1, 2, 3, 4] }
    const value = evaluator(data, data)
    assert.strictEqual(value, 20)
  })
  it('flattens a nested array (no initial value)', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result.concat(this)')
    const data = { array: [[0], [1, 2], [3, 4]] }
    const value = evaluator(data, data)
    assert.deepEqual(value, [0, 1, 2, 3, 4])
  })
  it('flattens a nested array (with initial value)', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result.concat(this):[]')
    const data = { array: [[0], [1, 2], [3, 4]] }
    const value = evaluator(data, data)
    assert.deepEqual(value, [0, 1, 2, 3, 4])
  })
  it('flattens a nested array in an object array', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result.concat(nested):[]')
    const data = { array: [ { nested: [0] }, { nested: [1, 2] }, { nested: [3, 4] } ] }
    let value = evaluator(data)
    // todo: figure out how not to have to do this massaging prior to testing the value:
    value = value.map(item => (item && ('__value' in item)) ? (item.__value && item.__value.valueOf()) : item)
    assert.deepEqual(value, [0, 1, 2, 3, 4])
  })
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

