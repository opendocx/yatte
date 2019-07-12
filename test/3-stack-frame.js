const ContextStack = require('../context-stack')
const Engine = require('../base-templater')
const assert = require('assert')

describe('Proper operation of the context stack', function() {
    it('should assemble a simple template', function() {
        //
        let objContext = {a: "global"}
        let objLocals = {b: "local", c: [{d: "one"},{d: "two"},{d: "three"}]}
        let stack = new ContextStack();
        stack.pushGlobal(objContext, objLocals);

        const frame = stack.peek();
        const evaluator = Engine.compileExpr('c|punc:"1, 2, and 3"');
        let iterable = frame.evaluate(evaluator);
        const indices = stack.pushList('c', iterable);
        assert.notStrictEqual(objLocals.c, iterable)
        assert(!objLocals.punc)
    });
});
