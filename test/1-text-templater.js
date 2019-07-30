const textTemplater = require("../text-templater");
var assert = require('assert');

describe('Field parsing of simple conditionals', function() {
    it('should parse the FullName template', function() {
        const template = "{[First]} {[if Middle]}{[Middle]} {[endif]}{[Last]}{[if Suffix]} {[Suffix]}{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "Content", expr: "First"},
            " ",
            {type: "If",expr: "Middle", contentArray: [{type: "Content", expr: "Middle"}, " ", {type: "EndIf"}]},
            {type: "Content", expr: "Last"},
            {type: "If", expr: "Suffix", contentArray: [" ", {type: "Content", expr: "Suffix"}, {type: "EndIf"}]}
        ]);
    });
    it('should parse the if/endif template', function() {
        const template = "{[if true]}A{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "true", contentArray: ["A", {type: "EndIf"}]},
        ]);
    });
    it('should parse the if/else/endif template', function() {
        const template = "{[if false]}A{[else]}B{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                "A",
                {type: "Else", contentArray: ["B", {type: "EndIf"}]}
            ]},
        ]);
    });
    it('should parse the if/elseif/endif template', function() {
        const template = "{[if false]}A{[elseif true]}B{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                "A",
                {type: "ElseIf", expr: "true", contentArray: ["B", {type: "EndIf"}]}
            ]},
        ]);
    });
    it('should parse the if/elseif/else/endif template', function() {
        const template = "{[if false]}A{[elseif false]}B{[else]}C{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                "A",
                {type: "ElseIf", expr: "false", contentArray: [
                    "B",
                    {type: "Else", contentArray: ["C", {type: "EndIf"}]}
                ]}
            ]},
        ]);
    });
    it('should parse the if/elseif/elseif/else/endif template', function() {
        const template = "{[if false]}A{[elseif false]}B{[elseif false]}C{[else]}D{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                "A",
                {type: "ElseIf", expr: "false", contentArray: [
                    "B",
                    {type: "ElseIf", expr: "false", contentArray: [
                        "C",
                        {type: "Else", contentArray: ["D", {type: "EndIf"}]}
                    ]}
                ]}
            ]},
        ]);
    });
    it('should reject the if/else/elseif/endif template', function() {
        const template = "{[if false]}A{[else]}B{[elseif false]}C{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "ElseIf cannot follow an Else");
        }
    });
    it('should reject the if/else/else/endif template', function() {
        const template = "{[if false]}A{[else]}B{[else]}C{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Else cannot follow an Else");
        }
    });
    it('should reject the if template (no endif)', function() {
        const template = "{[if true]}A";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "EndIf not found");
        }
    });
    it('should reject the if/else template (no endif)', function() {
        const template = "{[if true]}A{[else]}B";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "EndIf not found");
        }
    });
    it('should reject the if/endif/endif template', function() {
        const template = "{[if true]}A{[endif]}{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndIf");
        }
    });
    it('should reject the if/endif/else template', function() {
        const template = "{[if true]}A{[endif]}{[else]}B";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched Else");
        }
    });
    it('should reject the if/endif/elseif template', function() {
        const template = "{[if true]}A{[endif]}{[elseif false]}B";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched ElseIf");
        }
    });
})

describe('new-and-improved text template parsing', function() {
    it('should parse fields out of a multi-line template', function() {
        const template = "what\nhappens when {[IDontKnow]}{[WhatWillHappen]}\nnow"
        let result = textTemplater.parseText(template, true, false)
    })
})

describe('Field parsing of nested conditionals', function() {
    it('should parse the if/if/endif/elseif/if/endif/else/if/endif/endif template', function() {
        const template = "{[if false]}{[if true]}A{[endif]}{[elseif false]}{[if true]}B{[endif]}{[else]}{[if true]}C{[endif]}{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                {type: "If", expr: "true", contentArray: ["A", {type: "EndIf"}]},
                {type: "ElseIf", expr: "false", contentArray: [
                    {type: "If", expr: "true", contentArray: ["B", {type: "EndIf"}]},
                    {type: "Else", contentArray: [
                        {type: "If", expr: "true", contentArray: ["C", {type: "EndIf"}]},
                        {type: "EndIf"}
                    ]}
                ]}
            ]}
        ]);
    });
    it('should parse the if/if/elseif/else/endif/elseif/if/elseif/else/endif/else/if/elseif/else/endif/endif template', function() {
        const template = "{[if false]}{[if false]}A{[elseif false]}B{[else]}C{[endif]}{[elseif false]}{[if true]}D{[elseif false]}E{[else]}F{[endif]}{[else]}{[if false]}G{[elseif false]}H{[else]}I{[endif]}{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                {type: "If", expr: "false", contentArray: [
                    "A",
                    {type: "ElseIf", expr: "false", contentArray: [
                        "B",
                        {type: "Else", contentArray: ["C", {type: "EndIf"}]}
                    ]}
                ]},
                {type: "ElseIf", expr: "false", contentArray: [
                    {type: "If", expr: "true", contentArray: [
                        "D",
                        {type: "ElseIf", expr: "false", contentArray: [
                            "E",
                            {type: "Else", contentArray: ["F", {type: "EndIf"}]}
                        ]}
                    ]},
                    {type: "Else", contentArray: [
                        {type: "If", expr: "false", contentArray: [
                            "G",
                            {type: "ElseIf", expr: "false", contentArray: [
                                "H",
                                {type: "Else", contentArray: ["I", {type: "EndIf"}]}
                            ]}
                        ]},
                        {type: "EndIf"}
                    ]}
                ]}
            ]}
        ]);
    });
})

describe('Field parsing of lists and nested lists', function() {
    it('should parse the list/endlist template', function() {
        const template = "{[list []]}{[.]}{[endlist]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "List", expr: "[]", contentArray: [
                {type: "Content", expr: "."},
                {type: "Content", expr: "_punc"},
                {type: "EndList"}
            ]}
        ]);
    });
    it('should parse the list/list/endlist/endlist template', function() {
        const template = "{[list []]}A: {[list inner]}{[.]}{[endlist inner]}{[endlist []]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "List", expr: "[]", contentArray: [
                "A: ",
                {type: "List", expr: "inner", contentArray: [
                    {type: "Content", expr: "."},
                    {type: "Content", expr: "_punc"},
                    {type: "EndList"}
                ]},
                {type: "Content", expr: "_punc"},
                {type: "EndList"}
            ]}
        ]);
    });
    it('should reject the list template (missing endlist)', function() {
        const template = "{[list []]}A";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "EndList not found");
        }
    });
    it('should reject the endlist template (missing list)', function() {
        const template = "A{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndList");
        }
    });
    it('should reject the list/list/endlist template (missing endlist)', function() {
        const template = "{[list []]}A{[list inner}B{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "EndList not found");
        }
    });
    it('should (for now) reject the list/else/endlist template', function() {
        const template = "{[list []]}{[.]}{[else]}None{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Else cannot be in a List");
        }
    });
})

describe('Parsing nested conditionals and lists', function() {
    it('should parse the list/if/elseif/else/endif/endlist template', function() {
        const template = "{[list []]}{[if false]}A{[elseif .]}{[.]}{[else]}C{[endif]}, {[endlist]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "List", expr: "[]", contentArray: [
                {type: "If", expr: "false", contentArray: [
                    "A",
                    {type: "ElseIf", expr: ".", contentArray: [
                        {type: "Content", expr: "."},
                        {type: "Else", contentArray: ["C", {type: "EndIf"}]}
                    ]}
                ]},
                ", ",
                {type: "Content", expr: "_punc"},
                {type: "EndList"}
            ]}
        ]);
    });
    it('should parse the if/list/endlist/elseif/list/list/endlist/endlist/else/list/endlist/endif template', function() {
        const template = "{[if false]}{[list []]}{[test]}{[endlist]}{[elseif false]}A{[list outer]}B{[list inner]}C{[endlist]}D{[endlist]}E{[else]}F{[list another]}G{[endlist]}H{[endif]}";
        const result = textTemplater.parseTemplate(template, false);
        assert.deepEqual(result, [
            {type: "If", expr: "false", contentArray: [
                {type: "List", expr: "[]", contentArray: [
                    {type: "Content", expr: "test"},
                    {type: "Content", expr: "_punc"},
                    {type: "EndList"}
                ]},
                {type: "ElseIf", expr: "false", contentArray: [
                    "A",
                    {type: "List", expr: "outer", contentArray: [
                        "B",
                        {type: "List", expr: "inner", contentArray: [
                            "C",
                            {type: "Content", expr: "_punc"},
                            {type: "EndList"}
                        ]},
                        "D",
                        {type: "Content", expr: "_punc"},
                        {type: "EndList"}
                    ]},
                    "E",
                    {type: "Else", contentArray: [
                        "F",
                        {type: "List", expr: "another", contentArray: [
                            "G",
                            {type: "Content", expr: "_punc"},
                            {type: "EndList"}
                        ]},
                        "H",
                        {type: "EndIf"}
                    ]}
                ]}
            ]}
        ]);
    });
    it('should reject the list/endlist/endif template', function() {
        const template = "{[list []]}A{[endlist]}{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndIf");
        }
    });
    it('should reject the list/endif template', function() {
        const template = "{[list []]}A{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndIf");
        }
    });
    it('should reject the list/endif/endlist template', function() {
        const template = "{[list []]}A{[endif]}{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndIf");
        }
    });
    it('should reject the list/elseif/endlist template', function() {
        const template = "{[list []]}A{[elseif false]}{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "ElseIf cannot be in a List");
        }
    });
    it('should reject the if/list/endif/endlist template', function() {
        const template = "{[if true]}A{[list source]}B{[endif]}C{[endlist]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndIf");
        }
    });
    it('should reject the list/if/else/endlist/endif template', function() {
        const template = "{[list source]}A{[if true]}B{[else]}C{[endlist]}{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Unmatched EndList");
        }
    });
    it('should (for now) reject the if/list/endlist/elseif/list/else/endlist/endif template', function() {
        const template = "{[if false]}{[list source]}A{[endlist]}{[elseif true]}{[list second]}B{[else]}C{[endlist]}{[endif]}";
        try {
            const result = textTemplater.parseTemplate(template, false);
            assert.fail("expected error not thrown");
        } catch(err) {
            assert.equal(err.message, "Else cannot be in a List");
        }
    });
})

describe('Parsing and normalization of list filters', function() {
    it('should parse a filtered list template', function() {
        const template = "{[list Oceans | filter: AverageDepth > 3500]}\n * {[Name]}\n{[endlist]}";
        const compiled = textTemplater.parseTemplate(template);
        assert.deepStrictEqual(compiled, [
            {
                type: 'List',
                expr: 'Oceans|filter:this:"AverageDepth>3500"',
                exprAst: {
                    type: "ListFilterExpression",
                    rtl: false,
                    filter: {
                        name: "filter",
                        type: "Identifier"
                    },
                    input: {
                        name: "Oceans",
                        type: "Identifier",
                        constant: false
                    },
                    arguments: [{
                        constant: false,
                        left: {
                            constant: false,
                            name: "AverageDepth",
                            type: "Identifier",
                        },
                        operator: ">",
                        right: {
                            constant: true,
                            type: "Literal",
                            value: 3500,
                        },
                        "type": "BinaryExpression"
                    }],
                    constant: false,
                    expectarray: true
                },
                contentArray: [
                    " * ",
                    {
                        type: "Content",
                        expr: "Name",
                        exprAst: {
                            constant: false,
                            name: "Name",
                            type: "Identifier",
                        }
                    },
                    {
                        type: "Content",
                        expr: "_punc",
                        exprAst: {
                            constant: false,
                            name: "_punc",
                            type: "Identifier",
                        }
                    },
                    "\n",
                    {type: "EndList"}
                ]
            }
        ])
    });
})

describe('Parsing and normalization of expressions', function() {
    it('should parse and cache an expression with no fields', function() {
        const template = "static text";
        const result = textTemplater.parseTemplate(template);
        assert.deepEqual(result, ["static text"]);
        const result2= textTemplater.parseTemplate(template);
        assert.deepEqual(result2, ["static text"]);
        assert(result === result2);
    });
    it('should correctly normalize conditional and binary expressions', function() {
        const template = '{[a]} {[b ? b + " " : ""]}{[c]}'
        const result = textTemplater.parseTemplate(template);
        assert.deepStrictEqual(result, [
            {
                "type": "Content",
                "expr": "a",
                "exprAst": {
                    "type": "Identifier",
                    "name": "a",
                    "constant": false
                },
            }, 
            " ",
            {
                "type": "Content",
                "expr": 'b?b+" ":""',
                "exprAst": {
                    "type": "ConditionalExpression",
                    "test": {
                        "type": "Identifier",
                        "name": "b",
                        "constant": false
                    },
                    "fixed": true,
                    "consequent": {
                        "type": "BinaryExpression",
                        "left": {
                            "type": "Identifier",
                            "name": "b",
                            "constant": false
                        },
                        "operator": "+",
                        "right": {
                            "type": "Literal",
                            "value": " ",
                            "constant": true
                        },
                        "constant": false
                    },
                    "alternate": {
                        "type": "Literal",
                        "value": "",
                        "constant": true
                    },
                    "constant": false
                }
            },
            {
                "type": "Content",
                "expr": "c",
                "exprAst": {
                    "type": "Identifier",
                    "name": "c",
                    "constant": false
                },
            }
        ])
    });
})