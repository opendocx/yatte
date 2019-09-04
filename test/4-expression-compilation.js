const yatte = require('../src/index')
//const yatte = require('../lib/yatte.min')
const assert = require('assert')
const { TV_Family_Data } = require('./test-data')

describe('Compiling expressions via exported API', function () {
  it('should reuse a compiled expression rather than re-compiling it', function () {
    const evaluator = yatte.Engine.compileExpr('A + B')
    const evaluator2 = yatte.Engine.compileExpr('A + B')
    assert.strictEqual(evaluator, evaluator2)
  })

  it('should correctly categorize the outcomes of a conditional expression', function () {
    const evaluator = yatte.Engine.compileExpr('test ? consequent : alternative')
    const data = { test: true, consequent: 'consequent', alternative: 'alternative' }
    assert.deepStrictEqual(evaluator(data), 'consequent')
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
    const evaluator = yatte.Engine.compileExpr(' Families|any:this:"Children|any:this:&quot;Birthdate.valueOf()>Date.now()&quot;"') // space at beginning is intentional, to avoid cached expression AST
    const result = evaluator({ Date }, TV_Family_Data)
    assert.strictEqual(result, true)
    assert.deepStrictEqual(evaluator.normalized, 'Families|any:this:"Children|any:this:&quot;Birthdate.valueOf()>Date.now()&quot;"')
    assert.deepStrictEqual(evaluator.ast, ListFilterAST)
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

    const data = {
      Client: { name: 'John Smith' },
      Children: [
        { name: 'Ken Smith' },
        null,
        { name: 'Susan Smith' }
      ]
    }
    const result = evaluator(data)
    assert.deepStrictEqual(result, [{ name: 'John Smith' }, { name: 'Ken Smith' }, { name: 'Susan Smith' }])
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
    const result = evaluator(data)
    assert.deepStrictEqual(result, ['Lucy', 'Ed'])
  })

  it('allow chaining of "any" filter (and/or its "some" alias)', function () {
    const evaluator = yatte.Engine.compileExpr('Families | some: Children|any: Birthdate.valueOf() > Date.now()')
    const result = evaluator({ Date }, TV_Family_Data)
    assert.strictEqual(result, true)
    assert.deepStrictEqual(evaluator.normalized, 'Families|any:this:"Children|any:this:&quot;Birthdate.valueOf()>Date.now()&quot;"')
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
            left: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'Birthdate' },
                property: { type: 'Identifier', name: 'valueOf' },
                computed: false
              },
              arguments: [],
              constant: false
            },
            right: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'Date' },
                property: { type: 'Identifier', name: 'now' },
                computed: false
              },
              arguments: [],
              constant: false
            },
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
    assert.deepStrictEqual(evaluator.normalized, 'obj1.list1|any:this:"obj2.list2|any:this:&quot;prop3&quot;"')
    assert.deepStrictEqual(evaluator.ast, nestedAny_AST)
    // ensure the normalized expression produces the same AST but does not get recompiled!
    const evaluator2 = yatte.Engine.compileExpr(' ' + evaluator.normalized)
    assert.deepStrictEqual(evaluator2.ast, evaluator.ast)
    assert.deepStrictEqual(evaluator2.normalized, evaluator.normalized)
    assert.deepStrictEqual(evaluator.toString(), evaluator2.toString())
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
        message: 'Syntax Error: did you refer to a non-existant filter?\nName|UPPER'
      })
  })
})