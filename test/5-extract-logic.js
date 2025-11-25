/* eslint-disable no-unused-vars, no-new-wrappers, object-property-newline, camelcase, comma-dangle */
const { describe, it } = require('mocha')
const yatte = require('../src/index')
const assert = require('assert')

/*
{[if x]}
    {[list []]}
        {[test]}
    {[endlist]}
{[elseif y]}
    {[A]}
    {[list outer]}
        {[z?B:B2]}
        {[list inner]}
            {[C]}
        {[endlist]}
        {[D]}
    {[endlist]}
    {[E]}
{[else]}
    {[F]}
    {[list another]}
        {[G]}
    {[endlist]}
    {[H]}
{[endif]}
*/

describe('Extracting logic from text templates', function () {
  it('should retrieve a unified AST for the TestNest text template', function () {
    const template = '{[if x]}{[list []]}{[test]}{[endlist]}{[elseif y]}{[A]}{[list outer]}{[z?B:B2]}{[list inner]}{[C]}{[endlist]}{[D]}{[endlist]}{[E]}{[else]}{[F]}{[list another]}{[G]}{[endlist]}{[H]}{[endif]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, TestNestLogicTree)
  })

  it('should retrieve a unified AST for the redundant_if text template', function () {
    const template = `Redundant Ifs
Well, all I can say is “{[?x]}Something {[adjective]}{[:]}nothing{[/?]}.”
{[name]}, do you think {[if x]}about it much{[else]}anything{[endif]}?
        
The logic tree should include the if twice, but should call for the data only once.`
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, redundant_if_logic_tree)
  })

  it('should re-emit an expression used in content after the same expression appears in an If', function () {
    const template = '{[if x]}{[x]}{[endif]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, [
      {
        type: 'If',
        expr: 'x',
        id: '1',
        contentArray: [{
          type: 'Content',
          expr: 'x',
          id: '2'
        }]
      }
    ])
  })

  // it('should not filter out less-conditional (or unconditional) usage following more-conditional usage', function() {
  //     const template = "{[if a]}{[if b]}{[x]}{[endif]}{[x]}{[endif]}{[x]}";
  //     let logic = yatte.extractLogic(template);
  //     assert.deepStrictEqual(logic, [
  //         {
  //             type: 'If',
  //             expr: "a",
  //             contentArray: [
  //                 {
  //                     "type": 'If',
  //                     "expr": "b",
  //                     "contentArray": [
  //                         {
  //                             "type": 'Content',
  //                             "expr": "x",
  //                         }
  //                     ]
  //                 },{
  //                     "type": 'Content',
  //                     "expr": "x",
  //                 }
  //             ]
  //         },
  //         {
  //             "type": 'Content',
  //             "expr": "x",
  //         }
  //     ]);
  // });

  it('SHOULD filter out more-conditional usage that PRECEDES less-conditional (or unconditional) usage', function () {
    // either we need to do this (A), or we need to (B) change OpenDocx so it ignores the more-conditional usages as its outputting XML,
    // or we need to (C) change OpenDocx so the XPath query it sends to OXPT specifies to only take the first node that comes back ([1]).
    // Note: it's not possible, under the current approach (A), to completely optimize out redundant fields.  We will address this in a
    // rewrite.  In the meantime, we have a partial approach for A (that this case illustrates) and we are also doing (C).
    const template = '{[if a]}{[if b]}{[x]}{[endif]}{[x]}{[endif]}{[x]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, [
      {
        type: 'If',
        expr: 'a',
        id: '1',
        contentArray: [
          {
            type: 'If',
            expr: 'b',
            id: '2',
            contentArray: []
          }
        ]
      },
      {
        type: 'Content',
        expr: 'x',
        id: '7',
        idd: ['5', '3'],
      }
    ])
  })

  it('should filter out conditional usage that follows unconditional usage', function () {
    const template = '{[x]}{[if a]}{[x]}{[endif]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, [
      {
        type: 'Content',
        expr: 'x',
        id: '1',
        idd: ['3'],
      }, {
        type: 'If',
        expr: 'a',
        id: '2',
        contentArray: []
      }
    ])
  })

  it('should NOT filter out usage in an If field that follows unconditional usage in a Content field', function () {
    const template = '{[x]}{[if x]}{[y]}{[endif]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, [
      {
        type: 'Content',
        expr: 'x',
        id: '1',
      }, {
        type: 'If',
        expr: 'x',
        id: '2',
        contentArray: [{
          type: 'Content',
          expr: 'y',
          id: '3',
        }]
      }
    ])
  })

  it('should not omit a content node when the same expression was used earlier in a conditional!', function () {
    const template = '{[if x]}{[x]}{[elseif y]}{[y]}{[else]}{[z]}{[endif]}'
    const logic = yatte.extractLogic(template)
    assert.deepStrictEqual(logic, XYZLogicTree)
  })

  it('correctly parses & extracts logic from the ugly nested if/elseif template', function () {
    const result = yatte.extractLogic(ugly_nested_template)
    assert.deepStrictEqual(result, ugly_nested_contentArray)
  })
})

/*
Now... at runtime, we would like to be able to extract from the above AST a function which,
when executed against the current data context, and optionally given some kind of a path into that context to resolve questions of array indices,
can quickly & optimally determine the relevance and requiredness of any property.

{[if x]}                x is relevant (always)
    {[list []]}         [] is relevant IF: x
        {[test]}        test is relevant AND required IF: x && i < [].length    (test's relevance does not depend on [] because test is not in that context)
    {[endlist]}
{[elseif y]}            y is relevant (always -- or should it be if x is relevant?)
    {[A]}               A is relevant AND required IF: !x && y
    {[list outer]}      outer itself is relevant IF: !x && y
        {[z?B:B2]}      z is relevant IF: (z is part of outer && outer is relevant) || (outer.length > 0)
                        B is relevant IF: !x && y && outer is relevant && z; B is REQUIRED IF: !x && y && outer.length > 0 && z
                        B2 is relevant IF: !x && y && outer is relevant && !z; B2 is REQUIRED IF: !x && y && outer.length > 0 && !z
        {[list inner]}  inner is relevant IF: !x && y && outer.length > 0
            {[C]}       C is relevant IF: inner is relevant; C is REQUIRED IF: !x && y && outer.length > 0 && inner.length > 0
        {[endlist]}
        {[D]}           D is relevant IF: outer is relevant; D is REQUIRED IF: !x && y && outer.length > 0
    {[endlist]}
    {[E]}               E is relevant AND required IF: !x && y
{[else]}
    {[F]}               F is relevant AND required IF: !x && !y
    {[list another]}    another is relevant IF: !x && !y
        {[G]}           G is relevant IF: another is relevant; G is REQUIRED IF: !x && !y && another.length > 0
    {[endlist]}
    {[H]}               H is relevant AND required IF: !x && !y
{[endif]}
*/

/*
    way to recursively process logic tree to accumulate two lists:
     - a list of logical conditions for when each identifier is relevant (i.e., the user must have the opportunity to provide a value for it)
     - a list of logical conditions for when each identifier should be required (i.e., the user is required to provide a value for it before finishing)

    * an If node imposes on its expression, that the constituents of that expression are relevant so its Truthiness can be assessed
        * also on its contentArray, that they are relevant if that expression evaluates to Truthy (&&'ed with whatever relevance conditions were present from the If's own context)
    * an ElseIf node imposes on its expression, that the constituents of that expression are relevant (so its Truthiness can be assessed, regardless of whether the If's expression or preceding ElseIf's evaluate to Truthy or not)
        * also on its content array, that they are relvant if the proceeding If is Falsy, and all preceding ElseIfs are also Falsy, and this one evaluates to Truthy (&&'ed with whatever relevance conditions were present from the If's own context)
    * an Else node imposes on its content array, that they are relevant if all preceeding If and ElseIf nodes are Falsy (&&'ed with whatever relevance conditions were present from the If's own context)
    * a List node imposes on its expression, that the constituents of that expression are relevant so the list can be answered in the app
        * also on everything in its contentArray, that they are relevant only if _index0 < _count
    * a Content node imposes on the components of its expression, that they are relevant according to the relevance of the Context node
    * Inside expressions:
        * ConditionalExpression:
            * test: imposes that the constituents of that expression are relevant so its Truthiness can be assessed -- && true
            * alternate: imposes that the constituents of that expression are relevant if test evaluates to Truthy -- && test
            * consequent: imposes that the constituents of that expression are relevant if test evaluates to Falsy -- && !test
        * LogicalExpression and BinaryExpression:
            * left: always relevant -- && true
            * right: always relevant -- && true
        * Unary Expression: no impact -- always relevant -- && true
        * MemberExpression, CallExpression, etc. -- always relevant

    * a Content node imposes on the components of its expression, that they are REQUIRED according to the relevance of the Context node

 */

// it('should always allow access to the top of the stack using the _ identifier', function() {
//     const data = {
//         name: 'Xenia',
//         surname: 'Onatopp',
//         children: [
//             {
//                 name: 'Celia',
//                 surname: 'Smith',
//                 children: [
//                     {
//                         name: 'Susan',
//                         surname: 'Stamford'
//                     }
//                 ]
//             }
//         ]
//     }
//     const template = "{[name]}'s children:\n{[list children]}\n   {[name]}'s children:\n{[list children]}\n      {[name]} {[surname]} knows her mother's surname is {[_parent.surname]} and grandma is {[_.surname]}\n{[endlist]}\n{[endlist]}\n"
//     const result = yatte.assembleText(template, {}, data);
//     assert.equal(result.value, "Xenia's children:\n   Celia's children:\n      Susan Stamford knows her mother's surname is Smith and grandma is Onatopp\n");
//     assert(!data.hasOwnProperty('_')) // data did not get the _ because it was passed as locals, but _ still works because it was added to the global scope

//     const result2 = yatte.assembleText(template, data);
//     assert.equal(result2.value, "Xenia's children:\n   Celia's children:\n      Susan Stamford knows her mother's surname is Smith and grandma is Onatopp\n");
//     assert(data.hasOwnProperty('_')) // because we passed it as the scope object rather than locals
// })

// 1{[if x]}2{[list []]}3{[test]}4{[endlist]}5{[elseif y]}6{[A]}7{[list outer]}8{[z?B:B2]}9{[list inner]}10{[C]}11{[endlist]}12{[D]}13{[endlist]}14{[E]}15{[else]}16{[F]}17{[list another]}18{[G]}19{[endlist]}20{[H]}21{[endif]}
const TestNestLogicTree = [
  {
    type: 'If',
    expr: 'x',
    id: '1',
    contentArray: [
      {
        type: 'List',
        expr: '[]',
        id: '2',
        contentArray: [
          {
            type: 'Content',
            expr: 'test',
            id: '3'
          },
        ]
      },
      {
        type: 'ElseIf',
        expr: 'y',
        id: '5',
        contentArray: [
          {
            type: 'Content',
            expr: 'A',
            id: '6'
          },
          {
            type: 'List',
            expr: 'outer',
            id: '7',
            contentArray: [
              {
                type: 'Content',
                expr: 'z?B:B2',
                id: '8'
              },
              {
                type: 'List',
                expr: 'inner',
                id: '9',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'C',
                    id: '10'
                  },
                ]
              },
              {
                type: 'Content',
                expr: 'D',
                id: '12'
              },
            ]
          },
          {
            type: 'Content',
            expr: 'E',
            id: '14'
          },
          {
            type: 'Else',
            id: '15',
            contentArray: [
              {
                type: 'Content',
                expr: 'F',
                id: '16'
              },
              {
                type: 'List',
                expr: 'another',
                id: '17',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'G',
                    id: '18',
                  },
                ]
              },
              {
                type: 'Content',
                expr: 'H',
                id: '20',
              }
            ]
          }
        ]
      }
    ]
  }
]

// 1{[?x]}2{[adjective]}3{[:]}4{[/?]}5{[name]}6{[if x]}7{[else]}8{[endif]}
const redundant_if_logic_tree = [
  {
    type: 'If',
    expr: 'x',
    id: '1',
    contentArray: [{
      type: 'Content',
      expr: 'adjective',
      id: '2',
    }, {
      type: 'Else',
      id: '3',
      contentArray: []
    }
    ]
  }, {
    type: 'Content',
    expr: 'name',
    id: '5',
  }, {
    type: 'If',
    expr: 'x',
    id: '6',
    contentArray: [{
      type: 'Else',
      id: '7',
      contentArray: []
    }
    ]
  }
]

// 1{[if x]}2{[x]}3{[elseif y]}4{[y]}5{[else]}6{[z]}7{[endif]}
const XYZLogicTree = [
  {
    type: 'If',
    expr: 'x',
    id: '1',
    contentArray: [{
      type: 'Content',
      expr: 'x',
      id: '2',
    }, {
      type: 'ElseIf',
      expr: 'y',
      id: '3',
      contentArray: [{
        type: 'Content',
        expr: 'y',
        id: '4',
      }, {
        type: 'Else',
        id: '5',
        contentArray: [{
          type: 'Content',
          expr: 'z',
          id: '6',
        }]
      }
      ]
    }
    ]
  }
]

const ugly_nested_template = `{[if DocSelect == "SelectAllPlan"]}
  {[EngageLetter]}
  {[DPOA]}
  {[AdvCarePlan]}
  {[SimpleWill]}
  {[FinancialStatement]}
  {[CoverSheet]}
  {[if Married]}
    {[DPOASpouse]}
    {[AdvCarePlanSpouse]}
    {[SimpleWillSpouse]}
  {[endif]}
{[elseif DocSelect == "SelectAllLivingWill"]}
  {[EngageLetter]}
  {[DPOA]}
  {[LivingWill]}
  {[AdvHealthDirective]}
  {[SimpleWill]}
  {[FinancialStatement]}
  {[CoverSheet]}
  {[if Married]}
    {[DPOASpouse]}
    {[LivingWillSpouse]}
    {[AdvHCDirSpouse]}
    {[SimpleWillSpouse]}
  {[endif]}
{[elseif DocSelect == "SelectDocs"]}
  {[if Documents | contains: "Engagement Letter"]}
    {[EngageLetter]}
  {[endif]}
  {[if Documents | contains: "Living Will"]}
    {[LivingWill]}
    {[if Married]}
      {[LivingWillSpouse]}
    {[endif]}
  {[endif]}
  {[if Documents | contains: "Power of Attorney"]}
    {[DPOA]}
    {[if Married]}
      {[DPOASpouse]}
    {[endif]}
  {[endif]}
  {[if Documents | contains: "Advanced Care Plan"]}
    {[AdvCarePlan]}
    {[if Married]}
      {[AdvCarePlanSpouse]}
    {[endif]}
  {[endif]}
  {[if Documents | contains: "Advance Health Care Directive"]}
    {[AdvHealthDirective]}
    {[if Married]}
      {[AdvHCDirSpouse]}
    {[endif]}
  {[endif]}
  {[if Documents | contains: "Financial Statement"]}
    {[FinancialStatement]}
  {[endif]}
  {[if Documents | contains: "Will"]}
    {[SimpleWill]}
    {[if Married]}
      {[SimpleWillSpouse]}
    {[endif]}
  {[endif]}
  {[if Documents | contains: "Cover Sheet"]}
    {[CoverSheet]}
  {[endif]}
{[endif]}
`
const ugly_nested_contentArray = [
  {
    type: 'If',
    expr: 'DocSelect=="SelectAllPlan"',
    id: '1',
    contentArray: [
      {
        type: 'Content',
        expr: 'EngageLetter',
        id: '2',
      }, {
        type: 'Content',
        expr: 'DPOA',
        id: '3',
      }, {
        type: 'Content',
        expr: 'AdvCarePlan',
        id: '4',
      }, {
        type: 'Content',
        expr: 'SimpleWill',
        id: '5',
      }, {
        type: 'Content',
        expr: 'FinancialStatement',
        id: '6',
      }, {
        type: 'Content',
        expr: 'CoverSheet',
        id: '7',
      }, {
        type: 'If',
        expr: 'Married',
        id: '8',
        contentArray: [
          {
            type: 'Content',
            expr: 'DPOASpouse',
            id: '9',
          }, {
            type: 'Content',
            expr: 'AdvCarePlanSpouse',
            id: '10',
          }, {
            type: 'Content',
            expr: 'SimpleWillSpouse',
            id: '11',
          }
        ]
      }, {
        type: 'ElseIf',
        expr: 'DocSelect=="SelectAllLivingWill"',
        id: '13',
        contentArray: [
          {
            type: 'Content',
            expr: 'EngageLetter',
            id: '14',
          }, {
            type: 'Content',
            expr: 'DPOA',
            id: '15',
          }, {
            type: 'Content',
            expr: 'LivingWill',
            id: '16',
          }, {
            type: 'Content',
            expr: 'AdvHealthDirective',
            id: '17',
          }, {
            type: 'Content',
            expr: 'SimpleWill',
            id: '18',
          }, {
            type: 'Content',
            expr: 'FinancialStatement',
            id: '19',
          }, {
            type: 'Content',
            expr: 'CoverSheet',
            id: '20',
          }, {
            type: 'If',
            expr: 'Married',
            id: '21',
            contentArray: [
              {
                type: 'Content',
                expr: 'DPOASpouse',
                id: '22',
              }, {
                type: 'Content',
                expr: 'LivingWillSpouse',
                id: '23',
              }, {
                type: 'Content',
                expr: 'AdvHCDirSpouse',
                id: '24',
              }, {
                type: 'Content',
                expr: 'SimpleWillSpouse',
                id: '25',
              }
            ]
          }, {
            type: 'ElseIf',
            expr: 'DocSelect=="SelectDocs"',
            id: '27',
            contentArray: [
              {
                type: 'If',
                expr: 'Documents|contains:"Engagement Letter"',
                id: '28',
                contentArray: [{
                  type: 'Content',
                  expr: 'EngageLetter',
                  id: '29',
                }]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Living Will"',
                id: '31',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'LivingWill',
                    id: '32',
                  }, {
                    type: 'If',
                    expr: 'Married',
                    id: '33',
                    contentArray: [
                      {
                        type: 'Content',
                        expr: 'LivingWillSpouse',
                        id: '34',
                      }
                    ]
                  }
                ]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Power of Attorney"',
                id: '37',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'DPOA',
                    id: '38',
                  }, {
                    type: 'If',
                    expr: 'Married',
                    id: '39',
                    contentArray: [
                      {
                        type: 'Content',
                        expr: 'DPOASpouse',
                        id: '40',
                      }
                    ]
                  }
                ]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Advanced Care Plan"',
                id: '43',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'AdvCarePlan',
                    id: '44',
                  }, {
                    type: 'If',
                    expr: 'Married',
                    id: '45',
                    contentArray: [
                      {
                        type: 'Content',
                        expr: 'AdvCarePlanSpouse',
                        id: '46',
                      }
                    ]
                  }
                ]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Advance Health Care Directive"',
                id: '49',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'AdvHealthDirective',
                    id: '50',
                  }, {
                    type: 'If',
                    expr: 'Married',
                    id: '51',
                    contentArray: [
                      {
                        type: 'Content',
                        expr: 'AdvHCDirSpouse',
                        id: '52',
                      }
                    ]
                  }
                ]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Financial Statement"',
                id: '55',
                contentArray: [{
                  type: 'Content',
                  expr: 'FinancialStatement',
                  id: '56',
                }]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Will"',
                id: '58',
                contentArray: [
                  {
                    type: 'Content',
                    expr: 'SimpleWill',
                    id: '59',
                  }, {
                    type: 'If',
                    expr: 'Married',
                    id: '60',
                    contentArray: [
                      {
                        type: 'Content',
                        expr: 'SimpleWillSpouse',
                        id: '61',
                      }
                    ]
                  }
                ]
              }, {
                type: 'If',
                expr: 'Documents|contains:"Cover Sheet"',
                id: '64',
                contentArray: [{
                  type: 'Content',
                  expr: 'CoverSheet',
                  id: '65',
                }]
              }
            ]
          }
        ]
      }
    ]
  }
]
