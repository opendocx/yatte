const yatte = require('../src/index')
const Scope = yatte.Scope
const assert = require('assert')
const TestData = require('./test-data')

describe('Assembly of text template via exported API', function () {

  it('should assemble the oceans template', function () {
    const template = 'Oceans are:\n\n{[list Oceans]}\n * {[Name]} (Average depth {[AverageDepth]} m)\n{[endlist]}'
    const evaluator = yatte.compileText(template)
    const data = {
      Planet: 'Earth',
      Continents: ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Antarctica', 'Australia/Oceania'],
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ],
      IsHome: true,
      Lifeless: false
    }
    const result = evaluator(data)
    assert.equal(result, 'Oceans are:\n\n * Pacific (Average depth 3970 m)\n * Atlantic (Average depth 3646 m)\n * Indian (Average depth 3741 m)\n * Southern (Average depth 3270 m)\n * Arctic (Average depth 1205 m)\n')
  })

  it('should assemble a template with a list containing a non-repeated field', function () {
    const template = "{[Planet]}'s oceans are:\n\n{[list Oceans]}\n{[Planet]} > {[Name]}\n{[endlist]}"
    const evaluator = yatte.compileText(template)
    const data = {
      Planet: 'Earth',
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, "Earth's oceans are:\n\nEarth > Pacific\nEarth > Atlantic\nEarth > Indian\nEarth > Southern\nEarth > Arctic\n")
  })

  it('should assemble a punctuated list template', function () {
    const template = 'The oceans are {[list Oceans|punc:"1, 2 and 3."]}{[Name]}{[endlist]}'
    const evaluator = yatte.compileText(template)
    const data = {
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, 'The oceans are Pacific, Atlantic, Indian, Southern and Arctic.')
  })

  it('should assemble a punctuated list template with oxford comma', function () {
    const template = 'My favorite colors are {[list Colors|punc:"1, 2, and 3"]}{[Name]}{[endlist]}.'
    const evaluator = yatte.compileText(template)
    const data = {
      Colors: [
        { Name: 'Red' },
        { Name: 'Blue' },
        { Name: 'Green' }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, 'My favorite colors are Red, Blue, and Green.')
  })

  it('should assemble a punctuated list template with only two items', function () {
    const template = 'My favorite colors are {[list Colors|punc:"1, 2, and 3"]}{[Name]}{[endlist]}.'
    const evaluator = yatte.compileText(template)
    const data = {
      Colors: [
        { Name: 'Red' },
        { Name: 'Blue' }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, 'My favorite colors are Red and Blue.')
  })

  it('should assemble a punctuated list template with three items and a suffix', function () {
    const template = 'My favorite colors are\n{[list Colors|punc:"1;2; and3."]}\n - {[Name]}\n{[endlist]}\nThat is all.'
    const evaluator = yatte.compileText(template)
    const data = {
      Colors: [
        { Name: 'Red' },
        { Name: 'Yellow' },
        { Name: 'Blue' }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, 'My favorite colors are\n - Red;\n - Yellow; and\n - Blue.\nThat is all.')
  })

  it('should assemble the same list twice, with the punctuation from the first not interfering with the second', function () {
    const template = 'My favorite colors are {[list Colors|punc:"1, 2, and 3."]}{[Name]}{[endlist]}\n\nOnce again that was:\n{[list Colors]}\n - {[Name]}\n{[endlist]}\n'
    const evaluator = yatte.compileText(template)
    const data = {
      Colors: [
        { Name: 'Red' },
        { Name: 'Yellow' },
        { Name: 'Blue' }
      ]
    }
    const result = evaluator(data)
    assert.equal(result, 'My favorite colors are Red, Yellow, and Blue.\n\nOnce again that was:\n - Red\n - Yellow\n - Blue\n')
  })

  it('should assemble the (simple) full name template, then another template which uses that one', function () {
    const fullName = '{[FirstName]} {[MiddleName?MiddleName + " ":""]}{[LastName]}'
    const evaluator = yatte.compileText(fullName)
    const data = {
      FirstName: 'John',
      MiddleName: 'Jacob',
      LastName: 'Smith'
    }
    const virtuals = {
      FullName: evaluator
    }
    const template2 = 'Who is {[FullName]}?'
    const result = yatte.assembleText(template2, Scope.pushObject(data, null, virtuals))
    assert.equal(result, 'Who is John Jacob Smith?')
  })

  it('should assemble a template using local AND global contexts', function () {
    const FullNameCompiled = yatte.compileText('{[First]} {[Middle ? Middle + " ":""]}{[Last]}')
    let virtuals = {
      FullName: FullNameCompiled
    }
    let data = Scope.pushObject(
      {
        Last: 'Smith',
        First: 'Gerald'
      },
      null,
      virtuals
    )
    data = Scope.pushObject(
      {
        First: 'John'
      },
      data,
      virtuals
    )
    const template2 = 'Who is {[FullName]}?'
    const result = yatte.assembleText(template2, data)
    assert.equal(result, 'Who is John Smith?')
  })

  it('should assemble a punctuated list based on an array of keyed objects', function () {
    const template = 'My favorite colors are {[list Colors|punc:"1, 2 and 3"]}{[Description]}{[endlist]}.'
    const evaluator = yatte.compileText(template)
    const data = { Colors: [] }
    data.Colors.push(CreateKeyedObject({Name: 'RGB(255,0,0)', Description: 'Red'}, 'Name'))
    data.Colors.push(CreateKeyedObject({Name: 'RGB(255,255,0)', Description: 'Yellow'}, 'Name'))
    data.Colors.push(CreateKeyedObject({Name: 'RGB(0,0,255)', Description: 'Blue'}, 'Name'))

    const result = evaluator(data)
    assert.equal(result, 'My favorite colors are Red, Yellow and Blue.')
  })

  it('should assemble object list that explicitly refers to _parent', function () {
    const template = '{[list items|punc:"1, 2"]}{[FieldName]} plus {[_parent.FieldName]}{[endlist]}.'
    const data = {
      FieldName: "ZERO",
      items: [ { FieldName: "ONE" }, { FieldName: "TWO" }, { FieldName: "THREE" } ]
    }
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'ONE plus ZERO, TWO plus ZERO, THREE plus ZERO.')
  })

  it('should assemble primitive list that filters on _index0', function () {
    const template = 'The first item is {[Names[0]]}, followed by {[list Names|filter:_index0>0|punc:"1, 2, and 3"]}{[this]}{[endlist]}.'
    const data = { Names: [ 'ONE', 'TWO', 'THREE', 'FOUR' ] }
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'The first item is ONE, followed by TWO, THREE, and FOUR.')
  })

  it('should assemble object lists that filter on _index and .length', function () {
    const template = '{[list items|filter:_index == 1]}The first item is {[FieldName]}{[endlist]}{[list items|filter:_index > 1 && _index < items.length]}, followed by {[FieldName]}{[endlist]}{[if items.length > 1]}, and lastly {[items[items.length-1].FieldName]}{[endif]}.'
    const data = { items: [ { FieldName: "ONE" }, { FieldName: "TWO" }, { FieldName: "THREE" }, { FieldName: "FOUR" } ] }
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'The first item is ONE, followed by TWO, followed by THREE, and lastly FOUR.')
  })

  it('should assemble LOCAL object lists that filter on _index and .length', function () {
    const template = '{[list items|filter:_index == 1]}The first item is {[FieldName]}{[endlist]}{[list items|filter:_index > 1 && _index < items.length]}, followed by {[FieldName]}{[endlist]}{[if items.length > 1]}, and lastly {[items[items.length-1].FieldName]}{[endif]}.'
    let data = Scope.pushObject({ neverMind: true })
    data = Scope.pushObject({ items: [ { FieldName: "ONE" }, { FieldName: "TWO" }, { FieldName: "THREE" }, { FieldName: "FOUR" } ] }, data)
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'The first item is ONE, followed by TWO, followed by THREE, and lastly FOUR.')
  })

  it('should assemble object lists that filter on an item in the list', function () {
    const template = '{[list children | filter: Age >= 18 | punc:"1, 2"]}{[Name]}{[endlist]}'
    let data = Scope.pushObject({ neverMind: true })
    data = Scope.pushObject({ children: [ { Name: "John", Age: 20 }, { Name: "Mary", Age: 18 }, { Name: "Carl", Age: 16 } ] }, data)
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'John, Mary')

    const template2 = '{[list children | filter: Age < 18 | punc:"1, 2"]}{[Name]}{[endlist]}'
    const result2 = yatte.assembleText(template2, data).value
    assert.equal(result2, 'Carl')
  })

  it('should assemble object lists that filter on a computed value', function () {
    const template = '{[list Children|filter:Birthdate<=Date.parse("01/01/1960")]}{[Name]} was born on {[Birthdate|format:"MM/DD/YYYY"]}.\n{[endlist]}'
    let scope = Scope.pushObject({ Date })
    scope = Scope.pushObject(TestData.TV_Family_Data.Families[0], scope)
    const result = yatte.assembleText(template, scope).value
    assert.equal(result, 'Greg was born on 09/30/1954.\nMarcia was born on 08/05/1956.\nPeter was born on 11/07/1957.\nJan was born on 04/29/1958.\n')
  })

  it('should assemble object lists that filter on a computed value (2)', function () {
    const template = '{[list Children|filter:Age<60]}{[Name]} was born on {[Birthdate|format:"MM/DD/YYYY"]}.\n{[endlist]}'
    let data = Scope.pushObject({ neverMind: true })
    data = Scope.pushObject({ Children: TestData.TV_Family_Data.Families[0].Children.map(c => new Child(c)) }, data)
    const result = yatte.assembleText(template, data).value
    assert.equal(result, 'Bobby was born on 12/19/1960.\nCindy was born on 08/14/1961.\n')
  })

  it('should assemble template based on nested objects', function () {
    const template = '{[B.B2.B52]} is {[B.B2.B52.length]} characters long'
    const global = Scope.pushObject(nested_object)
    const result = yatte.assembleText(template, global).value
    assert.equal(result, 'awesome is 7 characters long')
  })

  it('should assemble references to _index, _parent, and _parent._index', function () {
    const template = '{[list D]}{[list D3]}{[_parent.D1]}\'s D3 no. {[_index]} is {[d4]} ({[_parent._index]}.{[_index]})\n{[endlist]}{[endlist]}'
    const global = Scope.pushObject(nested_object)
    const result = yatte.assembleText(template, global).value
    assert.equal(result, 'd1\'s D3 no. 1 is d3-0 (1.1)\nd1\'s D3 no. 2 is d3-1 (1.2)\nd1\'s D3 no. 3 is d3-2 (1.3)\nd3\'s D3 no. 1 is d5-0 (2.1)\nd3\'s D3 no. 2 is d5-1 (2.2)\n')
  })

  it('should assemble template based on nested objects with virtuals', function () {
    const template = '{[SingleEntity.FullName]} is {[SingleEntityLength1]} characters long (yes {[SingleEntityLength2]})'
    const obj = {
      SingleEntity: {
        FirstName: "John",
        LastName: "Smith",
        _virtuals: {
          FullName: yatte.compileText('{[FirstName]} {[LastName]}')
        }
      },
      _virtuals: {
        SingleEntityLength1: yatte.Engine.compileExpr('SingleEntity.FirstName.length + SingleEntity.LastName.length + 1'),
        SingleEntityLength2: yatte.Engine.compileExpr('SingleEntity.FullName.length'),
      }
    }
    const scope = Scope.pushObject(obj, null, obj._virtuals)
    const result = yatte.assembleText(template, scope).value
    assert.equal(result, 'John Smith is 10 characters long (yes 10)')
  })

  it('should assemble a compiled template against a proxied context stack (handle properly)', function () {
    const objContext = { a: 'global' }
    const objLocals = { b: 'local', c: [{ d: 'one' }, { d: 'two' }, { d: 'three' }] }
    let stack = Scope.pushObject(objContext)
    stack = Scope.pushObject(objLocals, stack)
    stack = Scope.pushList(objLocals.c, stack)
    stack = Scope.pushListItem(1, stack)
    const proxy = stack._getScopeProxy()
    const compiledTemplate = yatte.compileText('{[d]} is the {[_index]}{[_index|ordsuffix]} of {[c.length]} in {[a]}')
    const result = compiledTemplate(proxy).value
    assert.strictEqual(result, 'two is the 2nd of 3 in global')
  })

})

function CreateKeyedObject(obj, keyPropName) {
  let result = new String(obj[keyPropName])
  for (const [k, v] of Object.entries(obj)) {
    Object.defineProperty(result, k, { value: v })
  }
  return result
}

class Child {
  constructor (instance) {
    copyProperties(instance, this)
  }

  get Age() {
    var today = new Date();
    var birthDate = this.Birthdate;
    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
  }
}

function copyProperties (fromObj, toObj) {
  Object.getOwnPropertyNames(fromObj).filter(n => isNaN(n)).forEach(name => Object.defineProperty(toObj, name, Object.getOwnPropertyDescriptor(fromObj, name)))
}

const nested_object = {
  A: 'a',
  B: {
    B1: 'b1',
    B2: {
      B52: 'awesome'
    }
  },
  C: [ 'c1', 'c2', 'c3'],
  D: [{
    D1: 'd1',
    D2: 'd2',
    D3: [{d4: 'd3-0'}, {d4: 'd3-1'}, {d4: 'd3-2'}]
  },{
    D1: 'd3',
    D2: 'd4',
    D3: [{d4: 'd5-0'}, {d4: 'd5-1'}]
  }]
}
