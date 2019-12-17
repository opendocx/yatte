const assert = require('assert')
const yatte = require('../src/index')
const templater = require('../src/text-templater')
const TextEvaluator = require('../src/text-evaluator')
const Scope = require('../src/yobj')
const { TV_Family_Data } = require('./test-data')

describe('Assembling text templates', function () {
  it('prelim: call valueOf() on a scope proxy', function () {
    const data = new String('Testing 1... 2... 3...')
    const context = Scope.pushObject(data)
    const proxy = context.scopeProxy
    const value = proxy.valueOf()
    assert.equal(value, 'Testing 1... 2... 3...')
  })
  it('prelim: call toString() on a scope proxy', function () {
    const data = new String('Testing 1... 2... 3...')
    const context = Scope.pushObject(data)
    const proxy = context.scopeProxy
    const value = proxy.toString()
    assert.equal(value, 'Testing 1... 2... 3...')
  })
  it('prelim: call valueOf() on a property of an object proxy', function () {
    const data = { test: new String('Testing 1... 2... 3...') }
    const context = Scope.pushObject(data)
    const proxy = context.scopeProxy
    const value = proxy.test.valueOf()
    assert.equal(value, 'Testing 1... 2... 3...')
  })
  it('prelim: call toString() on a property of an object proxy', function () {
    const data = { test: new String('Testing 1... 2... 3...') }
    const context = Scope.pushObject(data)
    const proxy = context.scopeProxy
    const value = proxy.test.toString()
    assert.equal(value, 'Testing 1... 2... 3...')
  })
  it('prelim: unqualified _parent yields appropriate object (non list)', function () {
    const earth = { hello: 'earth' }
    const mars = { hello: 'mars' }
    let context = Scope.pushObject(earth)
    context = Scope.pushObject(mars, context)
    const proxy = context.scopeProxy
    const parent = proxy._parent
    assert.strictEqual(parent.__value, earth)
  })
  it('prelim: unqualified _parent yields appropriate object (in list)', function () {
    const sol = { star: 'Sol', planets: [{name: 'Mercury'}, {name: 'Venus'}, {name: 'Earth'}, {name: 'Mars'}] }
    let context = Scope.pushObject(sol)
    // const proxy = context.scopeProxy
    // const earth = proxy.planets[2]
    // assert.strictEqual(earth.__value, sol.planets[2])
    context = Scope.pushList(sol.planets, context)
    context = Scope.pushListItem(2, context)
    const proxy = context.scopeProxy
    const prelimTest = proxy.name + ' orbits ' + proxy.star
    assert.strictEqual(prelimTest, 'Earth orbits Sol')
    const parent = proxy._parent
    assert.strictEqual(parent.__value, sol)
  })
  it('should assemble a simple template', function () {
    const template = 'Hello {[planet]}!'
    const compiled = templater.parseTemplate(template)
    const data = { planet: 'World' }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Hello World!')
  })
  it('should assemble the FullName template', function () {
    const template = '{[First]} {[if Middle]}{[Middle]} {[endif]}{[Last]}{[if Suffix]} {[Suffix]}{[endif]}'
    const compiled = templater.parseTemplate(template)
    const data = { First: 'John', Last: 'Smith', Suffix: 'Jr.' }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'John Smith Jr.')
  })
  it('should assemble the if/endif template', function () {
    const template = '{[if true]}A{[endif]}'
    const compiled = templater.parseTemplate(template)
    const data = {}
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'A')
  })
  it('should assemble the if/else/endif template', function () {
    const template = '{[if false]}A{[else]}B{[endif]}'
    const compiled = templater.parseTemplate(template)
    const data = {}
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'B')
  })
  it('should assemble the if/elseif/endif template', function () {
    const template = '{[if false]}A{[elseif true]}B{[endif]}'
    const compiled = templater.parseTemplate(template)
    const data = {}
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'B')
  })
  it('should assemble the if/elseif/else/endif template', function () {
    const template = '{[if false]}A{[elseif false]}B{[else]}C{[endif]}'
    const compiled = templater.parseTemplate(template)
    const data = {}
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'C')
  })
  it('should assemble the oceans template', function () {
    const template = 'Oceans are:\n\n{[list Oceans]}\n * {[Name]} (Average depth {[AverageDepth]} m)\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
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
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Oceans are:\n\n * Pacific (Average depth 3970 m)\n * Atlantic (Average depth 3646 m)\n * Indian (Average depth 3741 m)\n * Southern (Average depth 3270 m)\n * Arctic (Average depth 1205 m)\n')
  })
  it('should assemble a filtered list', function () {
    const template = 'Continents containing u:\n\n{[list ContinentsWithU]}\n * {[.]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
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
      Lifeless: false,
    }
    //Object.defineProperty(data.Continents, 'WithU', { get: function () { return this.filter(item => item.includes('u')) } })
    data._virtuals = {
      ContinentsWithU: yatte.Engine.compileExpr('Continents|filter:this.includes("u")')
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Continents containing u:\n\n * Europe\n * South America\n * Australia/Oceania\n')
  })
  it('should assemble a dynamically filtered list', function () {
    const template = '{[list Oceans | filter: AverageDepth < 3500]}\n * {[Name]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, ' * Southern\n * Arctic\n')
  })
  it('should assemble a dynamically sorted list (ascending by name)', function () {
    const template = '{[list Oceans | sort: Name]}\n*{[Name]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, '*Arctic\n*Atlantic\n*Indian\n*Pacific\n*Southern\n')
  })
  it('should assemble a dynamically sorted list (descending by AverageDepth)', function () {
    const template = '{[list Oceans | sort: -AverageDepth]}\n{[Name]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Pacific\nIndian\nAtlantic\nSouthern\nArctic\n')
  })
  it('should assemble a dynamically filtered list of wrapped strings', function () {
    const template = '{[list Oceans | filter: AverageDepth < 3500]}\n * {[this]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Oceans: [
        new String('Pacific'),
        new String('Atlantic'),
        new String('Indian'),
        new String('Southern'),
        new String('Arctic'),
      ]
    }
    data.Oceans[0].AverageDepth = 3970
    data.Oceans[1].AverageDepth = 3646
    data.Oceans[2].AverageDepth = 3741
    data.Oceans[3].AverageDepth = 3270
    data.Oceans[4].AverageDepth = 1205
    const scope = Scope.pushObject(data)
    const result = (new TextEvaluator(scope)).assemble(compiled)
    assert.equal(result, ' * Southern\n * Arctic\n')
  })
  it('should assemble a dynamically filtered list of wrapped strings WITH filters', function () {
    const template = '{[list Oceans | filter: AverageDepth < 3500]}\n * {[this|upper]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Oceans: [
        new String('Pacific'),
        new String('Atlantic'),
        new String('Indian'),
        new String('Southern'),
        new String('Arctic'),
      ]
    }
    data.Oceans[0].AverageDepth = 3970
    data.Oceans[1].AverageDepth = 3646
    data.Oceans[2].AverageDepth = 3741
    data.Oceans[3].AverageDepth = 3270
    data.Oceans[4].AverageDepth = 1205
    const scope = Scope.pushObject(data)
    const result = (new TextEvaluator(scope)).assemble(compiled)
    assert.equal(result, ' * SOUTHERN\n * ARCTIC\n')
  })
  it('should assemble a dynamically sorted list (descending by birth date, then ascending by name)', function () {
    const template = '{[list Children | sort:-Birth:+Name]}\n{[Name]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children)).assemble(compiled)
    assert.equal(result, 'Eric\nMark\nTed\nBeth\nYolanda\nAlice\nJohn\n')
  })
  it('should assemble a dynamically sorted THEN filtered list', function () {
    const template = "{[list Children | sort:-Birth:+Name | filter:Group=='A']}\n*{[Name]}\n{[endlist]}"
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, '*Beth\n*Yolanda\n*Alice\n*John\n')
  })
  it('should assemble a dynamically filtered THEN sorted list', function () {
    const template = "{[list Children | filter:Group=='A' | sort:-Birth:+Name]}\n*{[Name]}\n{[endlist]}"
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, '*Beth\n*Yolanda\n*Alice\n*John\n')
  })
  it('check if an item is in a list using the "any" filter', function () {
    const template = "{[if Children|any:Name == 'Yolanda']}We found Yolanda!{[else]}No luck.{[endif]}"
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'We found Yolanda!')
  })
  it('check if any nested lists meet a qualification by chaining the "any" filter', function () {
    const compiled = templater.parseTemplate('Future families: {[Families|any:Children|any:Birthdate>testDate]}')
    // "Any family has any children with a birthdate in the future" ... true for our data set (at least until 2050 or so)
    const testDate = new Date(2019, 11, 6)
    let scope = Scope.pushObject({ testDate })
    scope = Scope.pushObject(TV_Family_Data, scope)
    const result = (new TextEvaluator(scope)).assemble(compiled)
    assert.equal(result, 'Future families: true')
    const compiled2 = templater.parseTemplate('Past families: {[Families|filter:Surname!="Robinson"|any:Children|any:Birthdate>testDate]}')
    // "Any family (other than the Robinsons!) has any children with a birthdate in the future"... false for our data set, since the Robinsons are the only future-family included.
    const result2 = (new TextEvaluator(Scope.pushObject(TV_Family_Data, scope))).assemble(compiled2)
    assert.equal(result2, 'Past families: false')
  })
  it('check if all items in a list meet a criteria using the "every" filter', function () {
    const template = "{[if Children|every:Group == 'A' || Group == 'B']}Either A or B{[endif]}"
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'Either A or B')
  })
  it('recognize that NOT all items in a list meet a criteria (using "every" filter)', function () {
    const template = "{[if Children|every:Group == 'A']}All A{[else]}Not all A{[endif]}"
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'Not all A')
  })
  it('should find a specific item in a list', function () {
    const template = 'First child with a d in their name is {[(Children|find:Name.includes("d")).Name]}'
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'First child with a d in their name is Ted')
  })
  it('should use grouping to find unique items in a list', function () {
    const template = 'Children were born in the years {[list Children|group:Birth.getFullYear()|sort:_key|punc:\'1, 2 and 3\']}{[_key]}{[endlist]}.'
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'Children were born in the years 1970, 2000 and 2007.')
  })
  it('should use grouping to create nested lists from a flat list', function () {
    const template = 'Children were born in the years {[list Children|group:Birth.getFullYear()|sort:_key|punc:"1; 2; and 3"]}{[_key]} ({[list _values|sort:Name|punc:"1, 2 and 3"]}{[Name]}{[endlist]}){[endlist]}.'
    const compiled = templater.parseTemplate(template)
    const result = (new TextEvaluator(data_Children2)).assemble(compiled)
    assert.equal(result, 'Children were born in the years 1970 (Alice and John); 2000 (Beth and Yolanda); and 2007 (Eric, Mark and Ted).')
  })
  it('should assemble a document with a primitive list, _index', function () {
    const template = 'Continents:\n\n{[list Continents]}\n * {[this]} (#{[_index]} on {[Planet]})\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Planet: 'Earth',
      Continents: ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Antarctica', 'Australia/Oceania']
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Continents:\n\n * Africa (#1 on Earth)\n * Asia (#2 on Earth)\n * Europe (#3 on Earth)\n * North America (#4 on Earth)\n * South America (#5 on Earth)\n * Antarctica (#6 on Earth)\n * Australia/Oceania (#7 on Earth)\n')
  })
  it('should assemble a document with a list of wrapped primitives', function () {
    const template = '{[list Continents|sort:-SurfaceArea]}\n{[.]}\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      ContinentData: [{
        Name: 'Africa',
        SurfaceArea: 30370000
      }, {
        Name: 'Asia',
        SurfaceArea: 44579000
      }, {
        Name: 'Europe',
        SurfaceArea: 10180000
      }, {
        Name: 'North America',
        SurfaceArea: 24709000
      }, {
        Name: 'South America',
        SurfaceArea: 17840000
      }, {
        Name: 'Antarctica',
        SurfaceArea: 14000000
      }, {
        Name: 'Australia/Oceania',
        SurfaceArea: 8600000
      }
      ]
    }
    data.Continents = data.ContinentData.map(obj => {
      const newObj = new String(obj.Name)
      newObj.Name = obj.Name
      newObj.SurfaceArea = obj.SurfaceArea
      return newObj
    })

    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Asia\nAfrica\nNorth America\nSouth America\nAntarctica\nEurope\nAustralia/Oceania\n')
  })
  it('should assemble a document with a filtered primitive list and an UNRELATED nested + filtered list, and then vice versa', function () {
    // const originalObjectPrototype = Object.prototype;
    // const originalStringPrototype = String.prototype;
    const template = 'Continents:\n{[list Continents|filter:!this.startsWith("A")]}\n * {[.]} ({[list Oceans|filter:Name.startsWith("A")]}{[_index]}. {[Name]} in {[_parent]}, {[endlist]})\n{[endlist]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      Planet: 'Earth',
      Continents: ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Antarctica', 'Australia/Oceania'],
      Oceans: [
        { Name: 'Pacific', AverageDepth: 3970 },
        { Name: 'Atlantic', AverageDepth: 3646 },
        { Name: 'Indian', AverageDepth: 3741 },
        { Name: 'Southern', AverageDepth: 3270 },
        { Name: 'Arctic', AverageDepth: 1205 }
      ]
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'Continents:\n * Europe (1. Atlantic in Europe, 2. Arctic in Europe, )\n * North America (1. Atlantic in North America, 2. Arctic in North America, )\n * South America (1. Atlantic in South America, 2. Arctic in South America, )\n')
    // ensure data context prototypes have not been messed with!
    // assert.strictEqual(String.prototype, originalStringPrototype, 'String.prototype has changed') // I doubt this works anyway
    // assert.strictEqual(data.Continents[0].prototype, String.prototype, 'primitive\'s prototype has beem modified in the data context')
    // assert.strictEqual(Object.prototype, originalObjectPrototype, 'String.prototype has changed') // I doubt this works anyway
    // assert.strictEqual(data.Oceans[0].prototype, Object.prototype, 'object\'s prototype has beem modified in the data context')

    const template2 = 'Oceans:\n{[list Oceans|filter:Name.startsWith("A")]}\n * {[Name]} ({[list Continents|filter:!this.startsWith("A")]}{[_index]}. {[.]} in {[_parent.Name]}, {[endlist]})\n{[endlist]}'
    const compiled2 = templater.parseTemplate(template2)
    const result2 = (new TextEvaluator(data)).assemble(compiled2)
    assert.equal(result2, 'Oceans:\n * Atlantic (1. Europe in Atlantic, 2. North America in Atlantic, 3. South America in Atlantic, )\n * Arctic (1. Europe in Arctic, 2. North America in Arctic, 3. South America in Arctic, )\n')
    // ensure data context prototypes have not been messed with!
    // assert.strictEqual(String.prototype, originalStringPrototype, 'String.prototype has changed (#2)') // I doubt this works anyway
    // assert.strictEqual(data.Continents[0].prototype, String.prototype, 'primitive\'s prototype has beem modified in the data context (#2)')
    // assert.strictEqual(Object.prototype, originalObjectPrototype, 'String.prototype has changed (#2)') // I doubt this works anyway
    // assert.strictEqual(data.Oceans[0].prototype, Object.prototype, 'object\'s prototype has beem modified in the data context (#2)')
  })
  it('should assemble a (simple) full name template', function () {
    const template = '{[ClientFirstName]} {[ClientMiddleName?ClientMiddleName + " ":""]}{[ClientLastName]}'
    const compiled = templater.parseTemplate(template)
    const data = {
      ClientFirstName: 'John',
      ClientMiddleName: 'Jacob',
      ClientLastName: 'Smith'
    }
    const result = (new TextEvaluator(data)).assemble(compiled)
    assert.equal(result, 'John Jacob Smith')
  })
  it('should assemble a simple template with local and global scopes', function () {
    const template = '{[First]} {[Middle ? Middle + " " : ""]}{[Last]}'
    const compiled = templater.parseTemplate(template)
    const globalData = Scope.pushObject({
      Last: 'Smith'
    })
    const localData = Scope.pushObject({
      First: 'John'
    }, globalData)
    const result = (new TextEvaluator(localData)).assemble(compiled)
    assert.equal(result, 'John Smith')
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

const data_Children2 = {
  Children: [
    { Name: 'John', Birth: new Date(1970, 8, 5), Group: 'A' },
    { Name: 'Alice', Birth: new Date(1970, 8, 5), Group: 'A' },
    { Name: 'Eric', Birth: new Date(2007, 9, 24), Group: 'B' },
    { Name: 'Ted', Birth: new Date(2007, 9, 24), Group: 'B' },
    { Name: 'Mark', Birth: new Date(2007, 9, 24), Group: 'B' },
    { Name: 'Yolanda', Birth: new Date(2000, 1, 1), Group: 'A' },
    { Name: 'Beth', Birth: new Date(2000, 1, 1), Group: 'A' }
  ]
}
