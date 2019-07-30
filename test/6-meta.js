const yatte = require("../index");
const assert = require('assert');

describe('Assembly of meta template via exported API', function() {
    it('should assemble a meta template', function() {
        const metaTemplate = "{[ident1]}\n{[ident2.ident3]}\n{[if x]}\n{[ident4]}\n{[if y]}\n{[ident5]}\n{[else]}\n{[ident6]}\n{[endif]}\n{[endif]}\n{[list z]}\n{[ident7]}\n{[endlist]}\n";
        const data = {
            ident1: { description: 'mock template' },
            ident2: { name: 'something',
                      ident3: { description: 'another mock template'}},
            x: true,
            ident4: { description: 'mock template #4'},
            y: false,
            ident5: { description: 'mockk template #5'},
            ident6: { description: 'mock template #6'},
            z: [
                {
                    iter: 1,
                    ident7: { description: 'mock template #7'}
                },{
                    iter: 2,
                    ident7: { description: 'mock template #7'}
                }
            ]
        }
        const result = yatte.assembleMeta(metaTemplate, data, null)
        assert.deepStrictEqual(result.value, {
            type: "Program",
            body: [
                {
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: "ident1", constant: false },
                    text: "ident1",
                    scope: data,
                    locals: null
                },{
                    type: "ExpressionStatement",
                    expression: {
                        type: "MemberExpression",
                        object: { type: "Identifier", name: "ident2", constant: false },
                        property: { type: "Identifier", name: "ident3" },
                        computed: false,
                        constant: false
                    },
                    text: "ident2.ident3",
                    scope: data,
                    locals: null
                },{
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: "ident4", constant: false },
                    text: "ident4",
                    scope: data,
                    locals: null
                },{
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: "ident6", constant: false },
                    text: "ident6",
                    scope: data,
                    locals: null
                },{
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: "ident7", constant: false },
                    text: "ident7",
                    scope: data,
                    locals: data.z[0]
                },{
                    type: "ExpressionStatement",
                    expression: { type: "Identifier", name: "ident7", constant: false },
                    text: "ident7",
                    scope: data,
                    locals: data.z[1]
                }
            ]
        })
    })
})