/* eslint-disable no-unused-vars, object-property-newline */
const { describe, it } = require('mocha')
const textTemplater = require('../src/text-templater')
var assert = require('assert')

describe('Field parsing of simple conditionals', function () {
  it('should parse the FullName template', function () {
    const template = '{[First]} {[if Middle]}{[Middle]} {[endif]}{[Last]}{[if Suffix]} {[Suffix]}{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'Content', expr: 'First', id: '1' },
      ' ',
      { type: 'If', expr: 'Middle', id: '2', contentArray: [
        { type: 'Content', expr: 'Middle', id: '3' }, ' ', { type: 'EndIf', id: '4' }
      ] },
      { type: 'Content', expr: 'Last', id: '5' },
      { type: 'If', expr: 'Suffix', id: '6', contentArray: [
        ' ', { type: 'Content', expr: 'Suffix', id: '7' }, { type: 'EndIf', id: '8' }] }
    ])
  })
  it('should parse the if/endif template', function () {
    const template = '{[if true]}A{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If', expr: 'true', id: '1', contentArray: ['A', { type: 'EndIf', id: '2' }] }
    ])
  })
  it('should parse the if/else/endif template', function () {
    const template = '{[if false]}A{[else]}B{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          'A',
          { type: 'Else', id: '2', contentArray: ['B', { type: 'EndIf', id: '3' }] }
        ] }
    ])
  })
  it('should parse the if/elseif/endif template', function () {
    const template = '{[if false]}A{[elseif true]}B{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          'A',
          { type: 'ElseIf', expr: 'true', id: '2', contentArray: ['B', { type: 'EndIf', id: '3' }] }
        ] }
    ])
  })
  it('should parse the if/elseif/else/endif template', function () {
    const template = '{[if false]}A{[elseif false]}B{[else]}C{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          'A',
          { type: 'ElseIf',
            expr: 'false',
            id: '2',
            contentArray: [
              'B',
              { type: 'Else', id: '3', contentArray: ['C', { type: 'EndIf', id: '4' }] }
            ] }
        ] }
    ])
  })
  it('should parse the if/elseif/elseif/else/endif template', function () {
    const template = '{[if false]}A{[elseif false]}B{[elseif false]}C{[else]}D{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          'A',
          { type: 'ElseIf',
            expr: 'false',
            id: '2',
            contentArray: [
              'B',
              { type: 'ElseIf',
                expr: 'false',
                id: '3',
                contentArray: [
                  'C',
                  { type: 'Else', id: '4', contentArray: ['D', { type: 'EndIf', id: '5' }] }
                ] }
            ] }
        ] }
    ])
  })
  it('should reject the if/else/elseif/endif template', function () {
    const template = '{[if false]}A{[else]}B{[elseif false]}C{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'Encountered an ElseIf (after an Else) when expecting an EndIf')
    }
  })
  it('should reject the if/else/else/endif template', function () {
    const template = '{[if false]}A{[else]}B{[else]}C{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'Encountered an Else (after an Else) when expecting an EndIf')
    }
  })
  it('should reject the if template (no endif)', function () {
    const template = '{[if true]}A'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The If has no matching EndIf')
    }
  })
  it('should reject the if/else template (no endif)', function () {
    const template = '{[if true]}A{[else]}B'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The If has no matching EndIf')
    }
  })
  it('should reject the if/endif/endif template', function () {
    const template = '{[if true]}A{[endif]}{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndIf has no matching If')
    }
  })
  it('should reject the if/endif/else template', function () {
    const template = '{[if true]}A{[endif]}{[else]}B'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The Else has no matching If')
    }
  })
  it('should reject the if/endif/elseif template', function () {
    const template = '{[if true]}A{[endif]}{[elseif false]}B'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The ElseIf has no matching If')
    }
  })
})

describe('new-and-improved text template parsing', function () {
  it('should parse fields out of a multi-line template', function () {
    const template = 'what\nhappens when {[IDontKnow]}{[WhatWillHappen]}\nnow'
    const result = textTemplater.parseText(template, true, false)
  })
})

describe('Field parsing of nested conditionals', function () {
  it('should parse the if/if/endif/elseif/if/endif/else/if/endif/endif template', function () {
    const template = '{[if false]}{[if true]}A{[endif]}{[elseif false]}{[if true]}B{[endif]}{[else]}{[if true]}C{[endif]}{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          { type: 'If', expr: 'true', id: '2', contentArray: ['A', { type: 'EndIf', id: '3' }] },
          { type: 'ElseIf',
            expr: 'false',
            id: '4',
            contentArray: [
              { type: 'If', expr: 'true', id: '5', contentArray: ['B', { type: 'EndIf', id: '6' }] },
              { type: 'Else',
                id: '7',
                contentArray: [
                  { type: 'If', expr: 'true', id: '8', contentArray: ['C', { type: 'EndIf', id: '9' }] },
                  { type: 'EndIf', id: '10' }
                ] }
            ] }
        ] }
    ])
  })
  it('should parse the if/if/elseif/else/endif/elseif/if/elseif/else/endif/else/if/elseif/else/endif/endif template', function () {
    const template = '{[if false]}{[if false]}A{[elseif false]}B{[else]}C{[endif]}{[elseif false]}{[if true]}D{[elseif false]}E{[else]}F{[endif]}{[else]}{[if false]}G{[elseif false]}H{[else]}I{[endif]}{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          { type: 'If',
            expr: 'false',
            id: '2',
            contentArray: [
              'A',
              { type: 'ElseIf',
                expr: 'false',
                id: '3',
                contentArray: [
                  'B',
                  { type: 'Else', id: '4', contentArray: ['C', { type: 'EndIf', id: '5' }] }
                ] }
            ] },
          { type: 'ElseIf',
            expr: 'false',
            id: '6',
            contentArray: [
              { type: 'If',
                expr: 'true',
                id: '7',
                contentArray: [
                  'D',
                  { type: 'ElseIf',
                    expr: 'false',
                    id: '8',
                    contentArray: [
                      'E',
                      { type: 'Else', id: '9', contentArray: ['F', { type: 'EndIf', id: '10' }] }
                    ] }
                ] },
              { type: 'Else',
                id: '11',
                contentArray: [
                  { type: 'If',
                    expr: 'false',
                    id: '12',
                    contentArray: [
                      'G',
                      { type: 'ElseIf',
                        expr: 'false',
                        id: '13',
                        contentArray: [
                          'H',
                          { type: 'Else', id: '14', contentArray: ['I', { type: 'EndIf', id: '15' }] }
                        ] }
                    ] },
                  { type: 'EndIf', id: '16' }
                ] }
            ] }
        ] }
    ])
  })
})

describe('Field parsing of lists and nested lists', function () {
  it('should parse the list/endlist template', function () {
    const template = '{[list []]}{[.]}{[endlist]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'List',
        expr: '[]',
        id: '1',
        contentArray: [
          { type: 'Content', expr: '.', id: '2' },
          { type: 'Content', expr: '_punc' },
          { type: 'EndList', id: '3' }
        ] }
    ])
  })
  it('should parse the list/list/endlist/endlist template', function () {
    const template = '{[list []]}A: {[list inner]}{[.]}{[endlist inner]}{[endlist []]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'List',
        expr: '[]',
        id: '1',
        contentArray: [
          'A: ',
          { type: 'List',
            expr: 'inner',
            id: '2',
            contentArray: [
              { type: 'Content', expr: '.', id: '3' },
              { type: 'Content', expr: '_punc' },
              { type: 'EndList', id: '4' }
            ] },
          { type: 'Content', expr: '_punc' },
          { type: 'EndList', id: '5' }
        ] }
    ])
  })
  it('should reject the list template (missing endlist)', function () {
    const template = '{[list []]}A'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The List has no matching EndList')
    }
  })
  it('should reject the endlist template (missing list)', function () {
    const template = 'A{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndList has no matching List')
    }
  })
  it('should reject the list/list/endlist template (missing endlist)', function () {
    const template = '{[list []]}A{[list inner}B{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The List has no matching EndList')
    }
  })
  it('should reject the list/else/endlist template', function () {
    const template = '{[list []]}{[.]}{[else]}None{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'Encountered an Else when expecting an EndList')
    }
  })
})

describe('Parsing nested conditionals and lists', function () {
  it('should parse the list/if/elseif/else/endif/endlist template', function () {
    const template = '{[list []]}{[if false]}A{[elseif .]}{[.]}{[else]}C{[endif]}, {[endlist]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'List',
        expr: '[]',
        id: '1',
        contentArray: [
          { type: 'If',
            expr: 'false',
            id: '2',
            contentArray: [
              'A',
              { type: 'ElseIf',
                expr: '.',
                id: '3',
                contentArray: [
                  { type: 'Content', expr: '.', id: '4' },
                  { type: 'Else', id: '5', contentArray: ['C', { type: 'EndIf', id: '6' }] }
                ] }
            ] },
          ', ',
          { type: 'Content', expr: '_punc' },
          { type: 'EndList', id: '7' }
        ] }
    ])
  })
  it('should parse the if/list/endlist/elseif/list/list/endlist/endlist/else/list/endlist/endif template', function () {
    const template = '{[if false]}{[list []]}{[test]}{[endlist]}{[elseif false]}A{[list outer]}B{[list inner]}C{[endlist]}D{[endlist]}E{[else]}F{[list another]}G{[endlist]}H{[endif]}'
    const result = textTemplater.parseTemplate(template, false)
    assert.deepStrictEqual(result, [
      { type: 'If',
        expr: 'false',
        id: '1',
        contentArray: [
          { type: 'List',
            expr: '[]',
            id: '2',
            contentArray: [
              { type: 'Content', expr: 'test', id: '3' },
              { type: 'Content', expr: '_punc' },
              { type: 'EndList', id: '4' }
            ] },
          { type: 'ElseIf',
            expr: 'false',
            id: '5',
            contentArray: [
              'A',
              { type: 'List',
                expr: 'outer',
                id: '6',
                contentArray: [
                  'B',
                  { type: 'List',
                    expr: 'inner',
                    id: '7',
                    contentArray: [
                      'C',
                      { type: 'Content', expr: '_punc' },
                      { type: 'EndList', id: '8' }
                    ] },
                  'D',
                  { type: 'Content', expr: '_punc' },
                  { type: 'EndList', id: '9' }
                ] },
              'E',
              { type: 'Else',
                id: '10',
                contentArray: [
                  'F',
                  { type: 'List',
                    expr: 'another',
                    id: '11',
                    contentArray: [
                      'G',
                      { type: 'Content', expr: '_punc' },
                      { type: 'EndList', id: '12' }
                    ] },
                  'H',
                  { type: 'EndIf', id: '13' }
                ] }
            ] }
        ] }
    ])
  })
  it('should reject the list/endlist/endif template', function () {
    const template = '{[list []]}A{[endlist]}{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndIf has no matching If')
    }
  })
  it('should reject the list/endif template', function () {
    const template = '{[list []]}A{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndIf has no matching If')
    }
  })
  it('should reject the list/endif/endlist template', function () {
    const template = '{[list []]}A{[endif]}{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndIf has no matching If')
    }
  })
  it('should reject the list/elseif/endlist template', function () {
    const template = '{[list []]}A{[elseif false]}{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'Encountered an ElseIf when expecting an EndList')
    }
  })
  it('should reject the if/list/endif/endlist template', function () {
    const template = '{[if true]}A{[list source]}B{[endif]}C{[endlist]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndIf has no matching If')
    }
  })
  it('should reject the list/if/else/endlist/endif template', function () {
    const template = '{[list source]}A{[if true]}B{[else]}C{[endlist]}{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'The EndList has no matching List')
    }
  })
  it('should (for now) reject the if/list/endlist/elseif/list/else/endlist/endif template', function () {
    const template = '{[if false]}{[list source]}A{[endlist]}{[elseif true]}{[list second]}B{[else]}C{[endlist]}{[endif]}'
    try {
      const result = textTemplater.parseTemplate(template, false)
      assert.fail('expected error not thrown')
    } catch (err) {
      assert.strictEqual(err.message, 'Encountered an Else when expecting an EndList')
    }
  })
})

describe('Parsing and normalization of list filters', function () {
  it('should parse a filtered list template', function () {
    const template = '{[list Oceans | filter: AverageDepth > 3500]}\n * {[Name]}\n{[endlist]}'
    const compiled = textTemplater.parseTemplate(template)
    assert.deepStrictEqual(compiled, [
      {
        type: 'List',
        expr: 'Oceans|filter:"AverageDepth>3500"',
        id: '1',
        contentArray: [
          ' * ',
          {
            type: 'Content',
            expr: 'Name',
            id: '2'
          },
          {
            type: 'Content',
            expr: '_punc'
          },
          '\n',
          { type: 'EndList', id: '3' }
        ]
      }
    ])
  })
})

describe('Parsing and normalization of expressions', function () {
  it('should parse and cache an expression with no fields', function () {
    const template = 'static text'
    const result = textTemplater.parseTemplate(template)
    assert.deepStrictEqual(result, ['static text'])
    const result2 = textTemplater.parseTemplate(template)
    assert.deepStrictEqual(result2, ['static text'])
    assert(result === result2)
  })
  it('should correctly normalize conditional and binary expressions', function () {
    const template = '{[a]} {[b ? b + " " : ""]}{[c]}'
    const result = textTemplater.parseTemplate(template)
    assert.deepStrictEqual(result, [
      {
        type: 'Content',
        expr: 'a',
        id: '1'
      },
      ' ',
      {
        type: 'Content',
        expr: 'b?b+" ":""',
        id: '2'
      },
      {
        type: 'Content',
        expr: 'c',
        id: '3'
      }
    ])
  })
})
