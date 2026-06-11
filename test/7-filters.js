/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle, no-multi-spaces */
const { describe, it } = require('mocha')
const assert = require('assert')
const yatte = require('../src/index')
const Scope = yatte.Scope

function assert_almostEqual(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) < epsilon, `Expected ${expected}, but got ${actual}`);
}

describe('text formatting', function () {
  it('upper', function () {
    const evaluator = yatte.Engine.compileExpr('text|upper')
    assert.strictEqual(evaluator({ text: 'hello World' }), 'HELLO WORLD')
  })
  it('lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|lower')
    assert.strictEqual(evaluator({ text: 'hello World' }), 'hello world')
  })
  it('initcap', function () {
    const evaluator = yatte.Engine.compileExpr('text|initcap')
    assert.strictEqual(evaluator({ text: 'hello World' }), 'Hello World')
  })
  it('initcap forced lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|initcap:true')
    assert.strictEqual(evaluator({ text: 'hello World' }), 'Hello world')
  })
  it('titlecaps', function () {
    const evaluator = yatte.Engine.compileExpr('text|titlecaps')
    assert.strictEqual(evaluator({ text: 'HELLO world' }), 'HELLO World')
  })
  it('titlecaps forced lower', function () {
    const evaluator = yatte.Engine.compileExpr('text|titlecaps:true')
    assert.strictEqual(evaluator({ text: 'HELLO world' }), 'Hello World')
  })
  it('titlecaps with punctuation', function () {
    const evaluator = yatte.Engine.compileExpr('text|titlecaps')
    const text = `RegExr's creator is gskinner.com.
Edit the Expression & Text willy-nilly to see y'all's matches.
"does john-doe know him," she said
¿que?
«oi!»
Em dashes—what?
it’d be okay
there'dn't've been a problem
“what about when he said, 'dude!'? or ‘whoa.’?”
oh ’tis a fine morning
's wonderful
änders wäre besser
šaha
удачи тебе`
    const expected = `RegExr's Creator Is Gskinner.Com.
Edit The Expression & Text Willy-Nilly To See Y'all's Matches.
"Does John-Doe Know Him," She Said
¿Que?
«Oi!»
Em Dashes—What?
It’d Be Okay
There'dn't've Been A Problem
“What About When He Said, 'Dude!'? Or ‘Whoa.’?”
Oh ’Tis A Fine Morning
'S Wonderful
Änders Wäre Besser
Šaha
Удачи Тебе`
    assert.strictEqual(evaluator({ text }), expected)
  })
  it('keepsections should be no-op', function () {
    const evaluator = yatte.Engine.compileExpr('text|keepsections')
    assert.strictEqual(evaluator({ text: 'HELLO world' }), 'HELLO world')
  })
})

describe('number formatting', function () {
  it('cardinal', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.strictEqual(evaluator({ num: 1 }), 'one')
    assert.strictEqual(evaluator({ num: 2 }), 'two')
    assert.strictEqual(evaluator({ num: 3 }), 'three')
    assert.strictEqual(evaluator({ num: 4 }), 'four')
    assert.strictEqual(evaluator({ num: 5 }), 'five')
    assert.strictEqual(evaluator({ num: 6 }), 'six')
    assert.strictEqual(evaluator({ num: 7 }), 'seven')
    assert.strictEqual(evaluator({ num: 8 }), 'eight')
    assert.strictEqual(evaluator({ num: 9 }), 'nine')
    assert.strictEqual(evaluator({ num: 10 }), 'ten')
    assert.strictEqual(evaluator({ num: 11 }), 'eleven')
    assert.strictEqual(evaluator({ num: 12 }), 'twelve')
    assert.strictEqual(evaluator({ num: 13 }), 'thirteen')
    assert.strictEqual(evaluator({ num: 14 }), 'fourteen')
    assert.strictEqual(evaluator({ num: 15 }), 'fifteen')
    assert.strictEqual(evaluator({ num: 16 }), 'sixteen')
    assert.strictEqual(evaluator({ num: 17 }), 'seventeen')
    assert.strictEqual(evaluator({ num: 18 }), 'eighteen')
    assert.strictEqual(evaluator({ num: 19 }), 'nineteen')
    assert.strictEqual(evaluator({ num: 20 }), 'twenty')
    assert.strictEqual(evaluator({ num: 21 }), 'twenty-one')
    assert.strictEqual(evaluator({ num: 22 }), 'twenty-two')
    assert.strictEqual(evaluator({ num: 23 }), 'twenty-three')
    assert.strictEqual(evaluator({ num: 24 }), 'twenty-four')
    assert.strictEqual(evaluator({ num: 123 }), 'one hundred twenty-three')
  })

  it('cardinal - over one thousand', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.strictEqual(evaluator({ num: 1234 }), 'one thousand two hundred thirty-four')
  })

  it('cardinal - null input', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.strictEqual(evaluator({ num: null }), null)
  })

  it('cardinal - NaN input', function () {
    const evaluator = yatte.Engine.compileExpr('num|cardinal')
    assert.strictEqual(evaluator({ num: NaN }), null)
  })

  it('cardinaldec', function () {
    const eval1 = yatte.Engine.compileExpr('num|cardinaldec:places:zpad:sep')
    assert.strictEqual(eval1({ num: 12.3456 }), "twelve") // 12.3456|cardinaldec
    assert.strictEqual(eval1({ num: 12.3456, places: 2 }), "twelve point three five") // 12.3456|cardinaldec:2
    assert.strictEqual(eval1({ num: 12.99 }), "thirteen") // 12.99|cardinaldec
    assert.strictEqual(eval1({ num: 12.99, places: 2 }), "twelve point nine nine") // 12.99|cardinaldec:2
    assert.strictEqual(eval1({ num: 12.99, places: 1 }), "thirteen") // 12.99|cardinaldec:1
    assert.strictEqual(eval1({ num: 12.99, places: 1, zpad: true }), "thirteen point zero") // 12.99|cardinaldec:1:true
    assert.strictEqual(eval1({ num: 12.3456, places: 3, zpad: false, sep: "mark" }), "twelve mark three four six") // 12.3456|cardinaldec:3:false:"mark"
    assert.strictEqual(eval1({ num: 12.3456, places: 5, zpad: true, sep: "" }), "twelve three four five six zero") // 12.3456|cardinaldec:5:true:""
  })

  it('cardinalcur', function () {
    const eval1 = yatte.Engine.compileExpr('num|cardinalcur:dname:cname:exact:sep')
    assert.strictEqual(eval1({ num: 12.3456, dname: "dollars", cname: "cents" }), "twelve dollars and thirty-five cents")
    assert.strictEqual(eval1({ num: 12.3456, dname: "dollars" }), "twelve dollars")
    assert.strictEqual(eval1({ num: 12.999, dname: "pounds", cname: "pence" }), "thirteen pounds")
    assert.strictEqual(eval1({ num: 12.999, dname: "pounds" }), "thirteen pounds")
    assert.strictEqual(eval1({ num: 12.999, dname: "pounds", cname: "pence", exact: "only" }), "thirteen pounds only")
    assert.strictEqual(eval1({ num: 1.01, dname: "dollars", cname: "cents" }), "one dollar and one cent") // ("dollar" derived from "dollars" by dropping the "s", same for "cent")
    assert.strictEqual(eval1({ num: 1.01, dname: "pounds", cname: "pence" }), "one pound and one pence") // ("pound" derived from "pounds", "pence" used as-is)
    assert.strictEqual(eval1({ num: 2.01, dname: "złote/złoty", cname: "grosze/grosz" }), "two złote and one grosz") // (plural and singular units can be specified together using / separator)
    assert.strictEqual(eval1({ num: 12, dname: "dollars", cname: "cents" }), "twelve dollars")
    assert.strictEqual(eval1({ num: 12, dname: "dollars", cname: "cents", exact: "and no cents" }), "twelve dollars and no cents")
    assert.strictEqual(eval1({ num: 12, dname: "dollars", cname: "cents", exact: "exactly", sep: "+" }), "twelve dollars exactly")
    assert.strictEqual(eval1({ num: 12.01, dname: "dollars", cname: "cents", exact: "exactly", sep: "+" }), "twelve dollars + one cent")
    assert.strictEqual(eval1({ num: 12.01, dname: "pounds", cname: "pence", exact: "exactly", sep: "" }), "twelve pounds one pence")
  })

  it('ordinal', function () {
    const evaluator = yatte.Engine.compileExpr('num|ordinal')
    assert.strictEqual(evaluator({ num: 1 }), 'first')
    assert.strictEqual(evaluator({ num: 2 }), 'second')
    assert.strictEqual(evaluator({ num: 3 }), 'third')
    assert.strictEqual(evaluator({ num: 4 }), 'fourth')
    assert.strictEqual(evaluator({ num: 5 }), 'fifth')
    assert.strictEqual(evaluator({ num: 6 }), 'sixth')
    assert.strictEqual(evaluator({ num: 7 }), 'seventh')
    assert.strictEqual(evaluator({ num: 8 }), 'eighth')
    assert.strictEqual(evaluator({ num: 9 }), 'ninth')
    assert.strictEqual(evaluator({ num: 10 }), 'tenth')
    assert.strictEqual(evaluator({ num: 11 }), 'eleventh')
    assert.strictEqual(evaluator({ num: 12 }), 'twelfth')
    assert.strictEqual(evaluator({ num: 13 }), 'thirteenth')
    assert.strictEqual(evaluator({ num: 14 }), 'fourteenth')
    assert.strictEqual(evaluator({ num: 15 }), 'fifteenth')
    assert.strictEqual(evaluator({ num: 16 }), 'sixteenth')
    assert.strictEqual(evaluator({ num: 17 }), 'seventeenth')
    assert.strictEqual(evaluator({ num: 18 }), 'eighteenth')
    assert.strictEqual(evaluator({ num: 19 }), 'nineteenth')
    assert.strictEqual(evaluator({ num: 20 }), 'twentieth')
    assert.strictEqual(evaluator({ num: 21 }), 'twenty-first')
    assert.strictEqual(evaluator({ num: 22 }), 'twenty-second')
    assert.strictEqual(evaluator({ num: 23 }), 'twenty-third')
    assert.strictEqual(evaluator({ num: 24 }), 'twenty-fourth')
    assert.strictEqual(evaluator({ num: 123 }), 'one hundred twenty-third')
  })

  it('ordSuffix', function () {
    const evaluator = yatte.Engine.compileExpr('num|ordsuffix')
    assert.strictEqual(evaluator({ num: 1 }), 'st')
    assert.strictEqual(evaluator({ num: 2 }), 'nd')
    assert.strictEqual(evaluator({ num: 3 }), 'rd')
    assert.strictEqual(evaluator({ num: 4 }), 'th')
    assert.strictEqual(evaluator({ num: 5 }), 'th')
    assert.strictEqual(evaluator({ num: 6 }), 'th')
    assert.strictEqual(evaluator({ num: 7 }), 'th')
    assert.strictEqual(evaluator({ num: 8 }), 'th')
    assert.strictEqual(evaluator({ num: 9 }), 'th')
    assert.strictEqual(evaluator({ num: 10 }), 'th')
    assert.strictEqual(evaluator({ num: 11 }), 'th')
    assert.strictEqual(evaluator({ num: 12 }), 'th')
    assert.strictEqual(evaluator({ num: 13 }), 'th')
    assert.strictEqual(evaluator({ num: 14 }), 'th')
    assert.strictEqual(evaluator({ num: 15 }), 'th')
    assert.strictEqual(evaluator({ num: 16 }), 'th')
    assert.strictEqual(evaluator({ num: 17 }), 'th')
    assert.strictEqual(evaluator({ num: 18 }), 'th')
    assert.strictEqual(evaluator({ num: 19 }), 'th')
    assert.strictEqual(evaluator({ num: 20 }), 'th')
    assert.strictEqual(evaluator({ num: 21 }), 'st')
    assert.strictEqual(evaluator({ num: 22 }), 'nd')
    assert.strictEqual(evaluator({ num: 23 }), 'rd')
    assert.strictEqual(evaluator({ num: 24 }), 'th')
    assert.strictEqual(evaluator({ num: 111 }), 'th')
    assert.strictEqual(evaluator({ num: 123 }), 'rd')
  })

/*  it('integer', function () {
    const Integer = yatte.Engine.compileExpr('num|integer')
    assert.strictEqual(Integer({ num: 12.3456  }), 12)
    assert.strictEqual(Integer({ num: "99.999" }), 99)
    // failure cases
    assert.strictEqual(Integer({ num: "abc"    }), null)
    assert.strictEqual(Integer({ num: Infinity }), null)
  })

  it('fractional', function () {
    const evaluator = yatte.Engine.compileExpr('num|fractional:d')
    assert_almostEqual(evaluator({ num: 12.3456          }), 0.3456)
    assert_almostEqual(evaluator({ num: 12.3456, d: null }), 0.3456)
    assert_almostEqual(evaluator({ num: 12.3456, d: 1000 }), 345.6)
    assert_almostEqual(evaluator({ num: "99.999", d: 100 }), 99.9)
    assert.strictEqual(evaluator({ num: 42               }), 0)
    // failure cases
    assert.strictEqual(evaluator({ num: "abc",    d: 2   }), null)
    assert.strictEqual(evaluator({ num: 12.34,    d: -5  }), null)
    assert.strictEqual(evaluator({ num: Infinity, d: 10  }), null)
  })
*/
  it('truncate', function () {
    const Truncate = yatte.Engine.compileExpr('num|truncate:p')
    assert.strictEqual(Truncate({ num: 12.3456,  p: 2 }), 12.34)
    assert.strictEqual(Truncate({ num: 12.3456        }), 12)
    assert.strictEqual(Truncate({ num: "99.999", p: 1 }), 99.9)
    assert.strictEqual(Truncate({ num: -12.3456, p: 2 }), -12.34) // truncates toward zero
    assert.strictEqual(Truncate({ num: 12.3456,  p: "2" }), 12.34) // numeric-string places allowed
    assert.strictEqual(Truncate({ num: null,     p: 2 }), null) // null/undefined passthrough
    // failure cases
    assert.strictEqual(Truncate({ num: "abc",    p: 2 }), null)
    assert.strictEqual(Truncate({ num: 12.3456, p: -1 }), null)
    assert.strictEqual(Truncate({ num: 12.3456, p: "abc" }), null)
    assert.strictEqual(Truncate({ num: Infinity, p: 2 }), null)
  })

  it('round', function () {
    const Round = yatte.Engine.compileExpr('num|round:p')
    assert.strictEqual(Round({ num: 12.3456,  p: 2 }), 12.35)
    assert.strictEqual(Round({ num: 12.3456        }), 12)
    assert.strictEqual(Round({ num: "99.999", p: 1 }), 100.0)
    assert.strictEqual(Round({ num: -12.5,    p: 0 }), -12) // mirrors Math.round semantics
    assert.strictEqual(Round({ num: 12.3456,  p: "2" }), 12.35) // numeric-string places allowed
    assert.strictEqual(Round({ num: null,     p: 2 }), null) // null/undefined passthrough
    // failure cases
    assert.strictEqual(Round({ num: "abc",    p: 2 }), null)
    assert.strictEqual(Round({ num: 12.3456, p: -1 }), null)
    assert.strictEqual(Round({ num: 12.3456, p: "abc" }), null)
    assert.strictEqual(Round({ num: Infinity, p: 2 }), null)
  })

  it('round matches cardinalcur numeric rounding behavior', function () {
    const cardinalWithCents = yatte.Engine.compileExpr('num|cardinalcur:"dollars":"cents"')
    const cardinalNoCents = yatte.Engine.compileExpr('num|cardinalcur:"dollars"')
    const round2 = yatte.Engine.compileExpr('num|round:2')
    const round0 = yatte.Engine.compileExpr('num|round:0')
    const samples = [12.3456, 12.999, 12.994, 1.005, -12.5]

    for (const num of samples) {
      const rounded2 = round2({ num })
      assert.strictEqual(
        cardinalWithCents({ num }),
        cardinalWithCents({ num: rounded2 }),
        `cardinalcur cents should match pre-round:2 for ${num}`
      )
      const rounded0 = round0({ num })
      assert.strictEqual(
        cardinalNoCents({ num }),
        cardinalNoCents({ num: rounded0 }),
        `cardinalcur dollars-only should match pre-round:0 for ${num}`
      )
    }
  })

  it('base 26 - under 26', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.strictEqual(evaluator({ num: 3 }), 'c')
  })

  it('base 26 - over 26', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"A"')
    assert.strictEqual(evaluator({ num: 30 }), 'AD')
  })

  it('base 26 - null input', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.strictEqual(evaluator({ num: null }), null)
  })

  it('base 26 - NaN input', function () {
    const evaluator = yatte.Engine.compileExpr('num|format:"a"')
    assert.strictEqual(evaluator({ num: NaN }), null)
  })
})

describe('date formatting', function () {
  it('MM/dd/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MM/dd/yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '01/02/2019')
  })

  it('MM/DD/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MM/DD/YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '01/02/2019')
  })

  it('M/d/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"M/d/yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '1/2/2019')
  })

  it('M/D/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"M/D/YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '1/2/2019')
  })

  it('dd/MM/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"dd/MM/yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '02/01/2019')
  })

  it('DD/MM/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"DD/MM/YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '02/01/2019')
  })

  it('d/M/yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"d/M/yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '2/1/2019')
  })

  it('D/M/YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"D/M/YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '2/1/2019')
  })

  it('do \'day of\' MMMM yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"do \'day of\' MMMM yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '2nd day of January 2019')
  })

  it('Do [day of] MMMM YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"Do [day of] MMMM YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), '2nd day of January 2019')
  })

  it('MMMM d, yyyy', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MMMM d, yyyy"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), 'January 2, 2019')
  })

  it('MMMM D, YYYY (compat)', function () {
    const evaluator = yatte.Engine.compileExpr('d|format:"MMMM D, YYYY"')
    assert.strictEqual(evaluator({ d: new Date(2019, 0, 2) }), 'January 2, 2019')
  })
})

describe('contains filter', function () {
  it('string array contains string', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:"Joe"')
    const evaluator2 = yatte.Engine.compileExpr('array|contains:"John"')
    const data = { array: ['Margot', null, 'Joe', 'Lou'] }
    assert.strictEqual(evaluator(data), true)
    assert.strictEqual(evaluator2(data), false)
  })
  it('number array contains number', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:3')
    const data = { array: [NaN, null, undefined, 4, 3, 2, 1] }
    assert.strictEqual(evaluator(data), true)
    data.array.splice(4, 1)
    assert.strictEqual(evaluator(data), false)
  })
  it('object array contains object', function () {
    const data = { array: [{ name: 'Joel' }, { name: 'Joe', lastName: 'Schmoe' }, null, undefined, { name: 'Joe' }] }
    const evaluator = yatte.Engine.compileExpr('array|contains:{ name:"Joe" }')
    assert.strictEqual(evaluator(data), true)
    data.array.pop()
    assert.strictEqual(evaluator(data), false)
  })
  it('array of string wrappers contains string', function () {
    const evaluator = yatte.Engine.compileExpr('array|contains:"Joe"')
    const evaluator2 = yatte.Engine.compileExpr('array|contains:"John"')
    const data = { array: [new String('Margot'), null, new String('Joe'), new String('Lou')] }
    data.array[0].First = 'Margot'
    data.array[0].Last = 'Hemingway'
    data.array[2].First = 'Joe'
    data.array[2].Last = 'Schmoe'
    data.array[3].First = 'Lou'
    assert.strictEqual(evaluator(data), true)
    assert.strictEqual(evaluator2(data), false)
  })
  it('string contains substring', function () {
    const data = { str: 'Quick brown fox jumps over the lazy dog' }
    const evaluator = yatte.Engine.compileExpr('str|contains:"fox"')
    const evaluator2 = yatte.Engine.compileExpr('str|contains:"Fox"')
    assert.strictEqual(evaluator(data), true)
    assert.strictEqual(evaluator2(data), false)
  })
  // array of strings contains wrapped primitive String
  // array of wrapped primitive string contains object???
})

describe('map filter', function () {
  it('maps a list of objects to strings', function () {
    const evaluator = yatte.Engine.compileExpr('Children|map:Name')
    const value = evaluator(data_Children, data_Children)
    const expected = data_Children.Children.map(c => c.Name)
    assert.deepStrictEqual(value, expected)
  })

  it('maps a list of objects to strings, accessing data from parent scope', function () {
    const evaluator = yatte.Engine.compileExpr('Children|map:Name + " " + Surname')
    const scope = Scope.pushObject(data_Children) // note: this same test case doesn't work if you use POJO directly
    // Scope is required in order to have access to parent scope during list filter predicate evaluation
    const value = evaluator(scope.scopeProxy, scope.proxy)
    const expected = data_Children.Children.map(c => c.Name + ' ' + data_Children.Surname)
    assert.deepStrictEqual(value, expected)
  })

  it('has access to _index during predicate evaluation', function () {
    const evaluator = yatte.Engine.compileExpr('Children|map:_index.toString() + ". " + Name')
    const scope = Scope.pushObject(data_Children) // note: this same test case doesn't work if you use POJO directly!
    // Scope is required in order to have access to _index/_index0 during predicate evaluation
    const value = evaluator(scope.scopeProxy, scope.proxy)
    const expected = data_Children.Children.map((c,i) => `${i+1}. ${c.Name}`)
    assert.deepStrictEqual(value, expected)
  })

  // FAILS... currently only the |reduce filter bothers to call pushList and pushListItem
  // during iteration. All other list filters (such as map) will yeild the UNFILTERED _index and _index0.
  // it('_index is accurate during predicate evaluation for filtered lists', function () {
  //   const evaluator = yatte.Engine.compileExpr('Children|filter:Birth.getFullYear()>2000|map:_index.toString() + ". " + Name')
  //   const scope = Scope.pushObject(data_Children)
  //   const value = evaluator(scope.scopeProxy, scope.proxy)
  //   const expected = data_Children
  //     .Children
  //       .filter(c => c.Birth.getFullYear()>2000)
  //       .map((c,i) => `${i+1}. ${c.Name}`)
  //   assert.deepStrictEqual(value, expected)
  // })
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
    assert.deepStrictEqual(value, [
      { _key: 'Jones',        _values: [v[0], v[2], v[3], v[5]] },
      { _key: 'McGillicutty', _values: [v[1]] },
      { _key: 'Smith',        _values: [v[4], v[6]] },
      { _key: 'Johnson',      _values: [v[7]] },
    ])
  })

  it('simplifies a list of strings to unique values and alphabetizes them', function () {
    const evaluator = yatte.Engine.compileExpr('surnames|group:this|map:_key|sort:this')
    const value = evaluator(surnameData, surnameData)
    assert.deepStrictEqual(value, ['Johnson', 'Jones', 'McGillicutty', 'Smith'])
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
    assert.deepStrictEqual(value, [0, 1, 2, 3, 4])
  })
  it('flattens a nested array (with initial value)', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result.concat(this):[]')
    const data = { array: [[0], [1, 2], [3, 4]] }
    const value = evaluator(data, data)
    assert.deepStrictEqual(value, [0, 1, 2, 3, 4])
  })
  it('flattens a nested array in an object array', function () {
    const evaluator = yatte.Engine.compileExpr('array|reduce:_result.concat(nested):[]')
    const data = { array: [{ nested: [0] }, { nested: [1, 2] }, { nested: [3, 4] }] }
    let value = evaluator(data)
    // todo: figure out how not to have to do this massaging prior to testing the value:
    value = value.map(item => (item && ('__value' in item)) ? (item.__value && item.__value.valueOf()) : item)
    assert.deepStrictEqual(value, [0, 1, 2, 3, 4])
  })
})

describe('list filter context behavior', function () {
  const nestedFilterData = {
    top: 'TOP',
    test1: [
      {
        id: 'I1',
        test2: {
          tag2: 'T2',
          x: 'X2',
          test3: [
            {
              tag3: 'A',
              test4: {
                x: 'X4A',
                test5: {
                  x: 'X5A',
                },
                tag4: 'T4A',
              }
            },
            {
              tag3: 'B',
              test4: {
                x: 'X4B',
                test5: {
                  x: 'X5B',
                },
                tag4: 'T4B',
              }
            }
          ]
        }
      }
    ]
  }
  const probe = yatte.Engine.compileExpr('(tag4 || "NO4") + ":" + (tag3 || "NO3") + ":" + (tag2 || "NO2") + ":" + (id || "NO1") + ":" + top')
  const topDesc = yatte.Engine.compileExpr('top')
  const t1Desc = yatte.Engine.compileExpr('id + ":" + _parent.desc')
  const t2Desc = yatte.Engine.compileExpr('tag2 + ":" + _parent.desc')
  const t3Desc = yatte.Engine.compileExpr('tag3 + ":" + _parent.desc')
  const t4Desc = yatte.Engine.compileExpr('tag4 + ":" + _parent.desc')
  const t5Desc = yatte.Engine.compileExpr('x + ":" + _parent.desc')
  nestedFilterData.desc = topDesc
  nestedFilterData.test1[0].desc = t1Desc
  nestedFilterData.test1[0].test2.desc = t2Desc
  nestedFilterData.test1[0].test2.test3[0].desc = t3Desc
  nestedFilterData.test1[0].test2.test3[0].test4.desc = t4Desc
  nestedFilterData.test1[0].test2.test3[0].test4.test5.desc = t5Desc
  nestedFilterData.test1[0].test2.test3[0].test4.test5.probe = probe
  nestedFilterData.test1[0].test2.test3[1].desc = t3Desc
  nestedFilterData.test1[0].test2.test3[1].test4.desc = t4Desc
  nestedFilterData.test1[0].test2.test3[1].test4.test5.desc = t5Desc
  nestedFilterData.test1[0].test2.test3[1].test4.test5.probe = probe

  function scopeOnFirstTest1Item () {
    let scope = Scope.pushObject(nestedFilterData)
    scope = Scope.pushList(nestedFilterData.test1, scope)
    scope = Scope.pushListItem(0, scope)
    return scope
  }

  it('evaluates lambda arguments against each list item with expected ancestor access', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      ['(test2.test3|filter:_parent.tag2=="T2" && id=="I1" && top=="TOP").length', 2],
      ['(test2.test3|find:_parent.tag2=="T2" && id=="I1" && top=="TOP").tag3', 'A'],
      ['test2.test3|any:_parent.tag2=="T2" && id=="I1" && top=="TOP"', true],
      ['test2.test3|every:_parent.tag2=="T2" && id=="I1" && top=="TOP"', true],
      ['(test2.test3|map:tag3 + ":" + _parent.tag2 + ":" + id + ":" + top).join(",")', 'A:T2:I1:TOP,B:T2:I1:TOP'],
      ['(test2.test3|group:_parent.tag2 + ":" + id + ":" + top)[0]._key', 'T2:I1:TOP'],
      ['test2.test3|reduce:_result + this.tag3 + this._parent.tag2 + id + top:""', 'AT2I1TOPBT2I1TOP']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.deepStrictEqual(actual, expected, expr)
    }
  })

  it('characterizes object-result context from map member paths', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      ['(test2.test3|map:test4.test5|map:probe).join(",")', 'T4A:A:T2:I1:TOP,T4B:B:T2:I1:TOP'],
      ['(test2.test3|map:test4.test5|map:x).join(",")', 'X5A,X5B'],
      ['(test2.test3|map:test4.test5|map:test2.x).join(",")', 'X2,X2'],
      ['(test2.test3|map:test4.test5|map:top).join(",")', 'TOP,TOP']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.strictEqual(actual, expected, expr)
    }
  })

  it('characterizes equivalence between member-path map and chained map for context lookup', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      ['(test2.test3|map:test4.test5|map:x).join(",")', 'X5A,X5B'],
      ['(test2.test3|map:test4|map:test5|map:x).join(",")', 'X5A,X5B'],
      ['(test2.test3|map:test4.test5|map:tag4).join(",")', 'T4A,T4B'],
      ['(test2.test3|map:test4|map:test5|map:tag4).join(",")', 'T4A,T4B'],
      ['(test2.test3|map:test4.test5|map:tag3).join(",")', 'A,B'],
      ['(test2.test3|map:test4|map:test5|map:tag3).join(",")', 'A,B'],
      ['(test2.test3|map:test4.test5|map:test2.x).join(",")', 'X2,X2'],
      ['(test2.test3|map:test4|map:test5|map:test2.x).join(",")', 'X2,X2'],
      ['(test2.test3|map:test4.test5|map:id).join(",")', 'I1,I1'],
      ['(test2.test3|map:test4|map:test5|map:id).join(",")', 'I1,I1']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.strictEqual(actual, expected, expr)
    }
  })

  it('resolves desc virtuals directly at each nested object level', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      ['desc', 'I1:TOP'],
      ['test2.desc', 'T2:I1:TOP'],
      ['test2.test3[0].desc', 'A:T2:I1:TOP'],
      ['test2.test3[0].test4.desc', 'T4A:A:T2:I1:TOP'],
      ['test2.test3[0].test4.test5.desc', 'X5A:T4A:A:T2:I1:TOP'],
      ['test2.test3[1].desc', 'B:T2:I1:TOP'],
      ['test2.test3[1].test4.desc', 'T4B:B:T2:I1:TOP'],
      ['test2.test3[1].test4.test5.desc', 'X5B:T4B:B:T2:I1:TOP']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.strictEqual(actual, expected, expr)
    }
  })

  it('keeps desc virtuals aligned with mapped object level across list filters', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      ['(test2.test3|map:desc).join(",")', 'A:T2:I1:TOP,B:T2:I1:TOP'],
      ['(test2.test3|map:test4|map:desc).join(",")', 'T4A:A:T2:I1:TOP,T4B:B:T2:I1:TOP'],
      ['(test2.test3|map:test4.test5|map:desc).join(",")', 'X5A:T4A:A:T2:I1:TOP,X5B:T4B:B:T2:I1:TOP'],
      ['(test2.test3|map:test4|map:test5|map:desc).join(",")', 'X5A:T4A:A:T2:I1:TOP,X5B:T4B:B:T2:I1:TOP']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.strictEqual(actual, expected, expr)
    }
  })
})

describe('list filter context behavior - test2.test4', function () {
  const nestedFilterData = {
    top: 'TOP',
    test1: [
      {
        id: 'I1',
        test2: {
          tag2: 'T2',
          x: 'X2',
          test3: [
            {
              tag3: 'A',
            },
            {
              tag3: 'B',
            }
          ],
          test4: {
            x: 'X4A',
            test5: {
              x: 'X5A',
            },
            tag4: 'T4A',
          }
        }
      }
    ]
  }
  const probe = yatte.Engine.compileExpr('(tag4 || "NO4") + ":" + (tag3 || "NO3") + ":" + (tag2 || "NO2") + ":" + (id || "NO1") + ":" + top')
  const topDesc = yatte.Engine.compileExpr('top')
  const t1Desc = yatte.Engine.compileExpr('id + ":" + _parent.desc')
  const t2Desc = yatte.Engine.compileExpr('tag2 + ":" + _parent.desc')
  const t3Desc = yatte.Engine.compileExpr('tag3 + ":" + _parent.desc')
  const t4Desc = yatte.Engine.compileExpr('tag4 + ":" + _parent.desc')
  const t5Desc = yatte.Engine.compileExpr('x + ":" + _parent.desc')
  nestedFilterData.desc = topDesc
  nestedFilterData.test1[0].desc = t1Desc
  nestedFilterData.test1[0].test2.desc = t2Desc
  nestedFilterData.test1[0].test2.test3[0].desc = t3Desc
  nestedFilterData.test1[0].test2.test3[1].desc = t3Desc
  nestedFilterData.test1[0].test2.test4.desc = t4Desc
  nestedFilterData.test1[0].test2.test4.test5.desc = t5Desc
  nestedFilterData.test1[0].test2.test4.test5.probe = probe
  
  function scopeOnFirstTest1Item () {
    let scope = Scope.pushObject(nestedFilterData)
    scope = Scope.pushList(nestedFilterData.test1, scope)
    scope = Scope.pushListItem(0, scope)
    return scope
  }

  it('keeps desc virtuals aligned with mapped object level across list filters', function () {
    const scope = scopeOnFirstTest1Item()
    const checks = [
      // ['(test2.test3|map:test4|map:desc).join(",")', 'T4A:T2:I1:TOP,T4A:T2:I1:TOP'],
      ['(test2.test3|map:test4|map:desc).join(",")', 'T4A:A:T2:I1:TOP,T4A:B:T2:I1:TOP'],
      // ['(test2.test3|map:test4.test5|map:desc).join(",")', 'X5A:T4A:T2:I1:TOP,X5A:T4A:T2:I1:TOP'],
      ['(test2.test3|map:test4.test5|map:desc).join(",")', 'X5A:T4A:A:T2:I1:TOP,X5A:T4A:B:T2:I1:TOP'],
      // ['(test2.test3|map:test4|map:test5|map:desc).join(",")', 'X5A:T4A:T2:I1:TOP,X5A:T4A:T2:I1:TOP']
      ['(test2.test3|map:test4|map:test5|map:desc).join(",")', 'X5A:T4A:A:T2:I1:TOP,X5A:T4A:B:T2:I1:TOP']
    ]
    for (const [expr, expected] of checks) {
      const actual = scope.evaluate(yatte.Engine.compileExpr(expr))
      assert.strictEqual(actual, expected, expr)
    }
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
  ],
  Surname: 'Smith'
}
