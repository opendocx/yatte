const textTemplater = require('./text-templater');
const TextEvaluator = require('./text-evaluator');
const base = require('./base-templater');
const EvaluationResult = require('./eval-result');
exports.Engine = base;
exports.EvaluationResult = EvaluationResult;

var compiledTemplateCache = new Map()

exports.extractLogic = function (template) {
    // returns a 'logic tree' for this template -- a filtered, optimized AST representing the logical structure of the template
    return base.buildLogicTree(textTemplater.parseTemplate(template)); // note: parseTemplate uses caching for performance
}

exports.compileText = function (template) {
    // returns curried function that will assemble the text template (given the data context as input)
    // (this method currently throws if the template contains an error!)
    const contentArray = textTemplater.parseTemplate(template) // uses caching -- will return same content array for same template string
    let func = compiledTemplateCache.get(contentArray)
    if (!func) {
        func = (context, locals) => new EvaluationResult((new TextEvaluator(context, locals)).assemble(contentArray), [], []) // TODO: populate the missing & errors collections!!
        compiledTemplateCache.set(contentArray, func)
    }
    return func
}

exports.assembleText = function (template, context, locals) {
    // non-curried version of assembly: pass in a template AND a context
    try {
        const contentArray = textTemplater.parseTemplate(template)
        const value = (new TextEvaluator(context, locals)).assemble(contentArray);
        return new EvaluationResult(value, [], []) // TODO: populate the missing & errors collections!!
    } catch (err) {
        return new EvaluationResult(null, [], [err.message]) // TODO: populate the missing & errors collections!!
    }
}

exports.FieldTypes = require('./fieldtypes');
exports.ContextStack = require('./context-stack');
