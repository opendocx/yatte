const yatte = require("../index");
const assert = require('assert');

describe('Compiling expressions via exported API', function() {

    it('should reuse a compiled expression rather than re-compiling it', function() {
        const evaluator = yatte.Engine.compileExpr('A + B')
        const evaluator2 = yatte.Engine.compileExpr('A + B')
        assert.strictEqual(evaluator, evaluator2)
    })

    it('should correctly categorize the outcomes of a conditional expression', function() {
        const evaluator = yatte.Engine.compileExpr('test ? consequent : alternative')
        const data = { test: true, consequent: 'consequent', alternative: 'alternative'}
        assert.deepStrictEqual(evaluator(data), 'consequent')
        assert.deepStrictEqual(evaluator.normalized, 'test?consequent:alternative')
        assert.deepStrictEqual(evaluator.ast, {
            type: "ConditionalExpression",
            test: {
                type: "Identifier",
                name: "test",
                constant: false
            },
            fixed: true,
            consequent: {
                type: "Identifier",
                name: "consequent",
                constant: false
            },
            alternate: {
                type: "Identifier",
                name: "alternative",
                constant: false
            },
            constant: false,
        })
    })

})

describe('Compiling text templates via exported API', function() {

    it('should reuse a compiled text template rather than re-compiling it', function() {
        const evaluator = yatte.compileText('{[FirstName]} {[LastName]}')
        const evaluator2 = yatte.compileText('{[FirstName]} {[LastName]}')
        assert.strictEqual(evaluator, evaluator2)
    })

})

describe('Assembly of text template via exported API', function() {
    it('should assemble the oceans template', function() {
        const template = "Oceans are:\n\n{[list Oceans]}\n * {[Name]} (Average depth {[AverageDepth]} m)\n{[endlist]}";
        const evaluator = yatte.compileText(template);
        const data = {
            "Planet":"Earth",
            "Continents":["Africa","Asia","Europe","North America","South America","Antarctica","Australia/Oceania"],
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
            "IsHome":true,
            "Lifeless":false
        };
        const result = evaluator(data);
        assert.equal(result, "Oceans are:\n\n * Pacific (Average depth 3970 m)\n * Atlantic (Average depth 3646 m)\n * Indian (Average depth 3741 m)\n * Southern (Average depth 3270 m)\n * Arctic (Average depth 1205 m)\n");
    });
    it('should assemble a template with a list containing a non-repeated field', function() {
        const template = "{[Planet]}'s oceans are:\n\n{[list Oceans]}\n{[Planet]} > {[Name]}\n{[endlist]}";
        const evaluator = yatte.compileText(template);
        const data = {
            "Planet":"Earth",
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ]
        };
        const result = evaluator(data);
        assert.equal(result, "Earth's oceans are:\n\nEarth > Pacific\nEarth > Atlantic\nEarth > Indian\nEarth > Southern\nEarth > Arctic\n");
    });
    it('should assemble a punctuated list template', function() {
        const template = 'The oceans are {[list Oceans|punc:"1, 2 and 3."]}{[Name]}{[endlist]}'
        const evaluator = yatte.compileText(template);
        const data = {
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ]
        };
        const result = evaluator(data);
        assert.equal(result, "The oceans are Pacific, Atlantic, Indian, Southern and Arctic.");
    });
    it('should assemble a punctuated list template with oxford comma', function() {
        const template = 'My favorite colors are {[list Colors|punc:"1, 2, and 3"]}{[Name]}{[endlist]}.'
        const evaluator = yatte.compileText(template);
        const data = {
            "Colors":[
                {"Name":"Red"},
                {"Name":"Blue"},
                {"Name":"Green"}
            ]
        };
        const result = evaluator(data);
        assert.equal(result, "My favorite colors are Red, Blue, and Green.");
    });
    it('should assemble a punctuated list template with only two items', function() {
        const template = 'My favorite colors are {[list Colors|punc:"1, 2, and 3"]}{[Name]}{[endlist]}.'
        const evaluator = yatte.compileText(template);
        const data = {
            "Colors":[
                {"Name":"Red"},
                {"Name":"Blue"}
            ]
        };
        const result = evaluator(data);
        assert.equal(result, "My favorite colors are Red and Blue.");
    });
    it('should assemble a punctuated list template with three items and a suffix', function() {
        const template = 'My favorite colors are\n{[list Colors|punc:"1;2; and3."]}\n - {[Name]}\n{[endlist]}\nThat is all.'
        const evaluator = yatte.compileText(template);
        const data = {
            "Colors":[
                {"Name":"Red"},
                {"Name":"Yellow"},
                {"Name":"Blue"}
            ]
        };
        const result = evaluator(data);
        assert.equal(result, "My favorite colors are\n - Red;\n - Yellow; and\n - Blue.\nThat is all.");
    });
    it('should assemble the (simple) full name template, then another template which uses that one', function() {
        const fullName = '{[FirstName]} {[MiddleName?MiddleName + " ":""]}{[LastName]}';
        const evaluator = yatte.compileText(fullName);
        const data = {
            "FirstName":"John",
            "MiddleName":"Jacob",
            "LastName":"Smith"
        };
        Object.defineProperty(data, 'FullName', {
            get () {
                return evaluator(this)
            }
        })
        const template2 = "Who is {[FullName]}?"
        const result = yatte.assembleText(template2, data);
        assert.equal(result, "Who is John Jacob Smith?");
    })
    it('should assemble a template using local AND global contexts', function() {
        const fullName = '{[First]} {[Middle ? Middle + " ":""]}{[Last]}';
        const evaluator = yatte.compileText(fullName);
        const data = {
            "Last":"Smith",
            "First": "Gerald"
        };
        const localData = {
            "First":"John",
        };
        Object.defineProperty(data, 'FullName', {
            get () {
                return evaluator(data, localData)
            }
        })
        const template2 = "Who is {[FullName]}?"
        const result = yatte.assembleText(template2, data, localData);
        assert.equal(result, "Who is John Smith?");
    })
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

})

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

describe('Extracting logic from text templates', function() {

    it('should retrieve a unified AST for the TestNest text template', function() {
        const template = "{[if x]}{[list []]}{[test]}{[endlist]}{[elseif y]}{[A]}{[list outer]}{[z?B:B2]}{[list inner]}{[C]}{[endlist]}{[D]}{[endlist]}{[E]}{[else]}{[F]}{[list another]}{[G]}{[endlist]}{[H]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, TestNestLogicTree);
    });

    const TestNestLogicTree = [
        {
            type: "If",
            expr: "x",
            firstRef: true,
            exprAst: {
                type: "Identifier",
                name: "x",
                constant: false
            },
            contentArray: [
                {
                    type: "List",
                    expr: "[]",
                    exprAst: {
                        type: "ArrayExpression",
                        elements: [],
                        expectarray: true,
                        constant: true
                    },
                    contentArray: [
                        {
                            type: "Content",
                            expr: "test",
                            exprAst: {
                                type: "Identifier",
                                name: "test",
                                constant: false
                            },
                        },
                        {
                            type: "Content",
                            expr: "_punc",
                            exprAst: {
                                type: "Identifier",
                                name: "_punc",
                                constant: false
                            },
                        },
                    ]
                },
                {
                    type: "ElseIf",
                    expr: "y",
                    firstRef: true,
                    exprAst: {
                        type: "Identifier",
                        name: "y",
                        constant: false
                    },
                    contentArray: [
                        {
                            type: "Content",
                            expr: "A",
                            exprAst: {
                                type: "Identifier",
                                name: "A",
                                constant: false
                            },
                        },
                        {
                            type: "List",
                            expr: "outer",
                            exprAst: {
                                type: "Identifier",
                                name: "outer",
                                expectarray: true,
                                constant: false
                            },
                            contentArray: [
                                {
                                    type: "Content",
                                    expr: "z?B:B2",
                                    exprAst: {
                                        type: "ConditionalExpression",
                                        test: {
                                            type: "Identifier",
                                            name: "z",
                                            constant: false
                                        },
                                        fixed: true,
                                        consequent: {
                                            type: "Identifier",
                                            name: "B",
                                            constant: false
                                        },
                                        alternate: {
                                            type: "Identifier",
                                            name: "B2",
                                            constant: false
                                        },
                                        constant: false
                                    },
                                },
                                {
                                    type: "List",
                                    expr: "inner",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "inner",
                                        expectarray: true,
                                        constant: false
                                    },
                                    contentArray: [
                                        {
                                            type: "Content",
                                            expr: "C",
                                            exprAst: {
                                                type: "Identifier",
                                                name: "C",
                                                constant: false
                                            },
                                        },
                                        {
                                            type: "Content",
                                            expr: "_punc",
                                            exprAst: {
                                                type: "Identifier",
                                                name: "_punc",
                                                constant: false
                                            },
                                        },
                                    ]
                                },
                                {
                                    type: "Content",
                                    expr: "D",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "D",
                                        constant: false
                                    },
                                },
                                {
                                    type: "Content",
                                    expr: "_punc",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "_punc",
                                        constant: false
                                    },
                                },
                            ]
                        },
                        {
                            type: "Content",
                            expr: "E",
                            exprAst: {
                                type: "Identifier",
                                name: "E",
                                constant: false
                            },
                        },
                        {
                            type: "Else",
                            contentArray: [
                                {
                                    type: "Content",
                                    expr: "F",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "F",
                                        constant: false
                                    },
                                },
                                {
                                    type: "List",
                                    expr: "another",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "another",
                                        expectarray: true,
                                        constant: false
                                    },
                                    contentArray: [
                                        {
                                            type: "Content",
                                            expr: "G",
                                            exprAst: {
                                                type: "Identifier",
                                                name: "G",
                                                constant: false
                                            },
                                        },
                                        {
                                            type: "Content",
                                            expr: "_punc",
                                            exprAst: {
                                                type: "Identifier",
                                                name: "_punc",
                                                constant: false
                                            },
                                        },
                                    ]
                                },
                                {
                                    type: "Content",
                                    expr: "H",
                                    exprAst: {
                                        type: "Identifier",
                                        name: "H",
                                        constant: false
                                    },
                                },
                            ]
                        },
                    ]
                },
            ]
        },
    ];
        
    it('should retrieve a unified AST for the redundant_if text template', function() {
        const template = `Redundant Ifs
Well, all I can say is “{[?x]}Something {[adjective]}{[:]}nothing{[/?]}.”
{[name]}, do you think {[if x]}about it much{[else]}anything{[endif]}?
        
The logic tree should include the if twice, but should call for the data only once.`;
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, redundant_if_logic_tree);
    });

    const redundant_if_logic_tree = [
        {
            "type": "If",
            "expr": "x",
            "firstRef": true,
            "exprAst": {
                "type": "Identifier",
                "name": "x",
                "constant": false
            },
            "contentArray": [{
                    "type": "Content",
                    "expr": "adjective",
                    "exprAst": {
                        "type": "Identifier",
                        "name": "adjective",
                        "constant": false
                    }
                }, {
                    "type": "Else",
                    "contentArray": []
                }
            ]
        }, {
            "type": "Content",
            "expr": "name",
            "exprAst": {
                "type": "Identifier",
                "name": "name",
                "constant": false
            }
        }, {
            "type": "If",
            "expr": "x",
            "firstRef": false,
            "exprAst": {
                "type": "Identifier",
                "name": "x",
                "constant": false
            },
            "contentArray": [{
                    "type": "Else",
                    "contentArray": []
                }
            ]
        }
    ];

    it('should re-emit an expression used in content after the same expression appears in an If', function() {
        const template = "{[if x]}{[x]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, [
            {
                "type": "If",
                "expr": "x",
                "firstRef": true,
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                },
                "contentArray": [{
                    "type": "Content",
                    "expr": "x",
                    "exprAst": {
                        "type": "Identifier",
                        "name": "x",
                        "constant": false
                    }
                }]
            }
        ]);
    });

    // it('should not filter out less-conditional (or unconditional) usage following more-conditional usage', function() {
    //     const template = "{[if a]}{[if b]}{[x]}{[endif]}{[x]}{[endif]}{[x]}";
    //     let logic = yatte.extractLogic(template);
    //     assert.deepStrictEqual(logic, [
    //         {
    //             "type": "If",
    //             "expr": "a",
    //             "firstRef": true,
    //             "exprAst": {
    //                 "type": "Identifier",
    //                 "name": "a",
    //                 "constant": false
    //             },
    //             "contentArray": [
    //                 {
    //                     "type": "If",
    //                     "expr": "b",
    //                     "firstRef": true,
    //                     "exprAst": {
    //                         "type": "Identifier",
    //                         "name": "b",
    //                         "constant": false
    //                     },
    //                     "contentArray": [
    //                         {
    //                             "type": "Content",
    //                             "expr": "x",
    //                             "exprAst": {
    //                                 "type": "Identifier",
    //                                 "name": "x",
    //                                 "constant": false
    //                             }
    //                         }
    //                     ]
    //                 },{
    //                     "type": "Content",
    //                     "expr": "x",
    //                     "exprAst": {
    //                         "type": "Identifier",
    //                         "name": "x",
    //                         "constant": false
    //                     }
    //                 }
    //             ]
    //         },
    //         {
    //             "type": "Content",
    //             "expr": "x",
    //             "exprAst": {
    //                 "type": "Identifier",
    //                 "name": "x",
    //                 "constant": false
    //             }
    //         }            
    //     ]);
    // });

    it('SHOULD filter out more-conditional usage that PRECEDES less-conditional (or unconditional) usage', function() {
        // either we need to do this (A), or we need to (B) change OpenDocx so it ignores the more-conditional usages as its outputting XML,
        // or we need to (C) change OpenDocx so the XPath query it sends to OXPT specifies to only take the first node that comes back ([1]).
        // Note: it's not possible, under the current approach (A), to completely optimize out redundant fields.  We will address this in a
        // rewrite.  In the meantime, we have a partial approach for A (that this case illustrates) and we are also doing (C).
        const template = "{[if a]}{[if b]}{[x]}{[endif]}{[x]}{[endif]}{[x]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, [
            {
                "type": "If",
                "expr": "a",
                "firstRef": true,
                "exprAst": {
                    "type": "Identifier",
                    "name": "a",
                    "constant": false
                },
                "contentArray": [
                    {
                        "type": "If",
                        "expr": "b",
                        "firstRef": true,
                        "exprAst": {
                            "type": "Identifier",
                            "name": "b",
                            "constant": false
                        },
                        "contentArray": []
                    }
                ]
            },
            {
                "type": "Content",
                "expr": "x",
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                }
            }            
        ]);
    });


    it('should filter out conditional usage that follows unconditional usage', function() {
        const template = "{[x]}{[if a]}{[x]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, [
            {
                "type": "Content",
                "expr": "x",
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                }
            },{
                "type": "If",
                "expr": "a",
                "firstRef": true,
                "exprAst": {
                    "type": "Identifier",
                    "name": "a",
                    "constant": false
                },
                "contentArray": []
            }
        ]);
    });

    it('should not filter out usage in an If field that follows unconditional usage in a Content field', function() {
        const template = "{[x]}{[if x]}{[y]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, [
            {
                "type": "Content",
                "expr": "x",
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                }
            },{
                "type": "If",
                "expr": "x",
                "firstRef": false,
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                },
                "contentArray": [{
                    "type": "Content",
                    "expr": "y",
                    "exprAst": {
                        "type": "Identifier",
                        "name": "y",
                        "constant": false
                    }
                }]
            }
        ]);
    });

    it('should not omit a content node when the same expression was used earlier in a conditional!', function() {
        const template = "{[if x]}{[x]}{[elseif y]}{[y]}{[else]}{[z]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, XYZLogicTree);
    });

    const XYZLogicTree = [
        {
            "type": "If",
            "expr": "x",
            "firstRef": true,
            "exprAst": {
                "type": "Identifier",
                "name": "x",
                "constant": false
            },
            "contentArray": [{
                    "type": "Content",
                    "expr": "x",
                    "exprAst": {
                        "type": "Identifier",
                        "name": "x",
                        "constant": false
                    }
                }, {
                    "type": "ElseIf",
                    "expr": "y",
                    "firstRef": true,
                    "exprAst": {
                        "type": "Identifier",
                        "name": "y",
                        "constant": false
                    },
                    "contentArray": [{
                            "type": "Content",
                            "expr": "y",
                            "exprAst": {
                                "type": "Identifier",
                                "name": "y",
                                "constant": false
                            }
                        }, {
                            "type": "Else",
                            "contentArray": [{
                                "type": "Content",
                                "expr": "z",
                                "exprAst": {
                                    "type": "Identifier",
                                    "name": "z",
                                    "constant": false
                                }
                            }]
                        }
                    ]
                }
            ]
        }
    ];
    
})

describe('Emitting appropriate data hints for OpenDocx', function() {
    it('should emit firstRef hints so opendocx-node can assemble proper XML', function() {
        const template = "{[if x]}{[endif]}{[if x]}{[endif]}";
        let logic = yatte.extractLogic(template);
        assert.deepStrictEqual(logic, [
            {
                "type": "If",
                "expr": "x",
                "firstRef": true,
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                },
                "contentArray": []
            }, {
                "type": "If",
                "expr": "x",
                "firstRef": false,
                "exprAst": {
                    "type": "Identifier",
                    "name": "x",
                    "constant": false
                },
                "contentArray": []
            }
        ]);

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

