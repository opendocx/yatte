const yatte = require('../src/index')
const assert = require('assert')
const { TV_Family_Data } = require('./test-data')
const AST = yatte.Engine.AST

describe('Compiling expressions via exported API', function () {
  it('should reuse a compiled expression rather than re-compiling it', function () {
    const evaluator = yatte.Engine.compileExpr('A + B')
    const evaluator2 = yatte.Engine.compileExpr('A + B')
    assert.strictEqual(evaluator, evaluator2)
  })

  it('should correctly categorize the outcomes of a conditional expression', function () {
    const evaluator = yatte.Engine.compileExpr('test ? consequent : alternative')
    assert.deepStrictEqual(evaluator.normalized, 'test?consequent:alternative')
    assert.deepStrictEqual(evaluator.ast, {
      type: 'ConditionalExpression',
      test: {
        type: 'Identifier',
        name: 'test',
        constant: false
      },
      fixed: true,
      consequent: {
        type: 'Identifier',
        name: 'consequent',
        constant: false
      },
      alternate: {
        type: 'Identifier',
        name: 'alternative',
        constant: false
      },
      constant: false
    })
  })

  it('re-compiling a normalized list filter expression produces the same normalization but does not go back to original AST', function () {
    // note: compiling a normalized list filter expression shoulod produce the same AST as the original (non-normalized) list filter expression
    // we do this so downline features that depend on the AST can reliably know what they're going to get.
    yatte.Engine.compileExpr.cache = {}
    const evaluator = yatte.Engine.compileExpr(' Families|any:"Children|any:&quot;Birthdate>currentDate&quot;"') // space at beginning is intentional, to avoid cached expression AST
    assert.deepStrictEqual(evaluator.normalized, 'Families|any:"Children|any:&quot;Birthdate>currentDate&quot;"')
    assert.deepStrictEqual(evaluator.ast, ListFilterAST)
  })

  it('correctly normalizes an expression with functions and this', function () {
    const evaluator = yatte.Engine.compileExpr('[].concat(Client, Spouse, Children)|filter:this')
    assert.deepStrictEqual(evaluator.normalized, '[].concat(Client,Spouse,Children)|filter:"this"')
  })

  it('correctly parses and compiles array concatenation and filtering out falsy values', function () {
    const evaluator = yatte.Engine.compileExpr('[].concat(Client, Spouse, Children)|filter:this')
    assert.deepStrictEqual(evaluator.ast, {
      type: 'ListFilterExpression',
      rtl: false,
      constant: false,
      filter: { type: 'Identifier', name: 'filter' },
      input: {
        type: 'CallExpression',
        constant: false,
        callee: {
          type: 'MemberExpression',
          computed: false,
          object: { type: 'ArrayExpression', elements: [] },
          property: { type: 'Identifier', name: 'concat' }
        },
        arguments: [
          { type: 'Identifier', name: 'Client', constant: false },
          { type: 'Identifier', name: 'Spouse', constant: false },
          { type: 'Identifier', name: 'Children', constant: false }
        ]
      },
      arguments: [{ type: 'LocalsExpression', constant: false }]
    })
  })

  it('allow chaining of "any" filter (and/or its "some" alias)', function () {
    const evaluator = yatte.Engine.compileExpr('Families | some: Children|any: Birthdate > currentDate')
    assert.deepStrictEqual(evaluator.normalized, 'Families|any:"Children|any:&quot;Birthdate>currentDate&quot;"')
    assert.deepStrictEqual(evaluator.ast, ListFilterAST)
  })

  const ListFilterAST = {
    type: 'ListFilterExpression',
    rtl: true,
    input: {
      type: 'Identifier',
      name: 'Families',
      constant: false
    },
    filter: { type: 'Identifier', name: 'any' },
    arguments: [
      {
        type: 'ListFilterExpression',
        rtl: true,
        input: {
          type: 'Identifier',
          name: 'Children',
          constant: false
        },
        filter: { type: 'Identifier', name: 'any' },
        arguments: [
          {
            type: 'BinaryExpression',
            operator: '>',
            left: { type: 'Identifier', name: 'Birthdate', constant: false },
            right: { type: 'Identifier', name: 'currentDate', constant: false },
            constant: false
          }
        ],
        constant: false
      }
    ],
    constant: false
  }

  it('allow chaining of the "any" filter with nested objects', function () {
    const evaluator = yatte.Engine.compileExpr('obj1.list1|any:obj2.list2|any:prop3')
    assert.deepStrictEqual(evaluator.normalized, 'obj1.list1|any:"obj2.list2|any:&quot;prop3&quot;"')
    assert.deepStrictEqual(evaluator.ast, nestedAny_AST)
    // ensure the normalized expression produces the same AST but does not get recompiled!
    const evaluator2 = yatte.Engine.compileExpr(' ' + evaluator.normalized)
    assert.deepStrictEqual(evaluator2.ast, evaluator.ast)
    assert.deepStrictEqual(evaluator2.normalized, evaluator.normalized)
    assert.deepStrictEqual(evaluator.toString(), evaluator2.toString())
  })

  it('allows lookup of/access to an object in a list using the find filter', function () {
    const evaluator = yatte.Engine.compileExpr('(table|find:col1=="b").col2')
    const data = {
      table: [
        { col1: 'a', col2: 'A' },
        { col1: 'b', col2: 'B' },
        { col1: 'c', col2: 'C' },
      ],
    }
    const result = evaluator(data)
    assert.strictEqual(result, 'B')
  })

  it('allows lookup of/access to an object in a list with context using the find filter', function () {
    const evaluator = yatte.Engine.compileExpr('(table|find:col1==value).col2')
    const data = {
      value: 'b',
      table: [
        { col1: 'a', col2: 'A' },
        { col1: 'b', col2: 'B' },
        { col1: 'c', col2: 'C' },
      ],
    }
    const scope = require('../src/index').Scope.pushObject(data)
    const result = scope.evaluate(evaluator)
    assert.strictEqual(result, 'B')
  })

  const nestedAny_AST = {
    type: 'ListFilterExpression',
    rtl: true,
    input: {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'obj1', constant: false },
      property: { type: 'Identifier', name: 'list1' },
      computed: false,
      constant: false
    },
    filter: { type: 'Identifier', name: 'any' },
    arguments: [{
      type: 'ListFilterExpression',
      rtl: true,
      input: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'obj2', constant: false },
        property: { type: 'Identifier', name: 'list2' },
        computed: false,
        constant: false
      },
      filter: { type: 'Identifier', name: 'any' },
      arguments: [{ type: 'Identifier', name: 'prop3', constant: false }],
      constant: false
    }
    ],
    constant: false
  }

  it('cleans up parse errors thrown by angular-expressions', function () {
    assert.throws(() => yatte.Engine.compileExpr('members|name!=this.name'), // forgot "filter" filter
      {
        name: 'SyntaxError',
        message: "Syntax Error: '!=' is an unexpected token:\nmembers|name!=this.name\n            ^^"
      })
    assert.throws(() => yatte.Engine.compileExpr('ProbateClient.MaritalStatus == “Married”'), // used curly quotes
      {
        name: 'SyntaxError',
        message: "Lexer Error: Unexpected next character '“':\nProbateClient.MaritalStatus == “Married”\n                               ^" })
    assert.throws(() => yatte.Engine.compileExpr('Name|UPPER'), // non-existing filter
      {
        name: 'SyntaxError',
        message: 'Syntax Error: did you refer to a nonexistent filter?\nName|UPPER'
      })
  })

  it('correctly serializes a simple AST as an expression', function () {
    const evaluator = yatte.Engine.compileExpr('!test')
    assert.deepStrictEqual(evaluator.ast, {
      type: AST.UnaryExpression,
      prefix: true,
      operator: '!',
      argument: {
        type: AST.Identifier,
        name: 'test',
        constant: false
      },
      constant: false
    })
    assert.deepStrictEqual(evaluator.normalized, '!test')
  })

  it('correctly serializes grouping in nested conditionals (grouping needed)', function () {
    const evaluator = yatte.Engine.compileExpr(`a
  ? b
    ? (c|map:C)
    : (d|map:D)
  : e`)
    assert.deepStrictEqual(evaluator.normalized, 'a?b?(c|map:"C"):(d|map:"D"):e')
  })

  it('correctly serializes grouping in nested conditionals (complex)', function () {
    const evaluator = yatte.Engine.compileExpr(`
(a ? b : c)
  ? (
    d
      ? e
      : (
        f
          ? g
          : h
      )
  )
  : i`)
    assert.deepStrictEqual(evaluator.normalized, '(a?b:c)?d?e:f?g:h:i')
  })

  it('correctly serializes grouping in object literals (grouping needed)', function () {
    const evaluator = yatte.Engine.compileExpr('{ a: a, b: (b|map:B) }')
    assert.deepStrictEqual(evaluator.normalized, '{a:a,b:(b|map:"B")}')
  })

  it('correctly serializes grouping in array elements (grouping needed)', function () {
    const evaluator = yatte.Engine.compileExpr('[ a, (b|format:"9") ]')
    assert.deepStrictEqual(evaluator.normalized, '[a,(b|format:"9")]')
  })

  it('correctly serializes grouping in array elements (2)', function () {
    const evaluator = yatte.Engine.compileExpr('[ (b|format:"9") ]')
    assert.deepStrictEqual(evaluator.normalized, '[(b|format:"9")]')
  })

  it('correctly serializes grouping in function calls (grouping needed)', function () {
    const evaluator = yatte.Engine.compileExpr('a.func((b|map: B))')
    assert.deepStrictEqual(evaluator.normalized, 'a.func((b|map:"B"))')
  })

  it('correctly serializes grouping in function calls (2)', function () {
    const evaluator = yatte.Engine.compileExpr('a.func((b|map: B), c)')
    assert.deepStrictEqual(evaluator.normalized, 'a.func((b|map:"B"),c)')
  })

  it('correctly serializes grouping in function calls (3)', function () {
    const evaluator = yatte.Engine.compileExpr('(a|map: A).func(b)')
    assert.deepStrictEqual(evaluator.normalized, '(a|map:"A").func(b)')
  })
})
