const yatte = require("../index");
const assert = require('assert');

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


describe('AST Experimentation', function() {
    it('should retrieve a unified AST for a text template', async function() {
        const template = "{[if x]}{[list []]}{[test]}{[endlist]}{[elseif y]}{[A]}{[list outer]}{[z?B:B2]}{[list inner]}{[C]}{[endlist]}{[D]}{[endlist]}{[E]}{[else]}{[F]}{[list another]}{[G]}{[endlist]}{[H]}{[endif]}";
        let result = yatte.extractFields(template);
        assert.deepEqual(result, [
            {
                type: "If",
                expr: "x",
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
                        ]
                    },
                    {
                        type: "ElseIf",
                        expr: "y",
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
                                            alternate: {
                                                type: "Identifier",
                                                name: "B",
                                                constant: false
                                            },
                                            consequent: {
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
        ]);
    });
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
