const textTemplater = require('./text-templater');
const TextEvaluator = require('./text-evaluator');
const base = require('./base-templater');
exports.Engine = base;

exports.extractLogic = function (template) {
    // returns a 'logic tree' for this template -- a filtered, optimized AST representing the logical structure of the template
    return base.buildLogicTree(textTemplater.parseTemplate(template)); // note: parseTemplate uses caching for performance
}

exports.compileText = function (template) {
    // returns curried function that will assemble the text template (given the data context as input)
    return function(context) {
        return (new TextEvaluator(context)).assemble(textTemplater.parseTemplate(template)); // note: parseTemplate uses caching for performance
    }
}

exports.assembleText = function (template, context) {
    // non-curried version of assembly: pass in a template AND a context
    return (new TextEvaluator(context)).assemble(textTemplater.parseTemplate(template)); // note: parseTemplate uses caching for performance
}

exports.FieldTypes = require('./fieldtypes');
exports.ContextStack = require('./context-stack');
exports.Table = require('./table');
exports.TestHelperTypes = require('./test/types-test');
