const textTemplater = require('./text-templater');
const textEvaluator = require('./text-evaluator');
const expressions= require('angular-expressions');
const format = require('date-fns/format');
exports.ContextStack = require('./context-stack');
exports.FieldTypes = require('./fieldtypes');
exports.Table = require('./table');

// define built-in filters (todo: more needed)
expressions.filters.upper = function(input) {
    if(!input) return input;
    return input.toUpperCase();
}
expressions.filters.lower = function(input) {
    if(!input) return input;
    return input.toLowerCase();
}
expressions.filters.initcap = function(input, forceLower = false) {
    if(!input) return input;
    if (forceLower) input = input.toLowerCase();
    return input.charAt(0).toUpperCase() + input.slice(1);
}
expressions.filters.titlecaps = function(input, forceLower = false) {
    if(!input) return input;
    if (forceLower) input = input.toLowerCase();
    return input.replace(/(^| )(\w)/g, s => s.toUpperCase());
}
expressions.filters.date = function(input, fmtStr) {
    // This condition should be used to make sure that if your input is undefined, your output will be undefined as well and will not throw an error
    if(!input) return input;
    return format(input, fmtStr);
}
expressions.filters.ordsuffix = function(input) {
    if(!input) return input;
    switch (input % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

const compile = function(expr) {
    if (expr == ".") expr = "this";
    return expressions.compile(expr);
}

var templateCache = {};
var fieldCache;

const parseField = function(fieldObj, callback) {
    // fieldObj is an object with two properties:
    //   type (string): the field type
    //   expr (string): the expression within the field that wants to be parsed
    let error = null;
    let compiledExpr;
    try {
        compiledExpr = compile(fieldObj.expr);
    } catch (err) {
        error = err;
    }
    fieldCache[fieldObj.expr] = error ? error : compiledExpr;
    if (callback) { // async
        callback(error, compiledExpr);
    } else { // synchronous
        if (error) throw error;
        return compiledExpr;
    }
};
exports.parseFieldCallback = parseField;

exports.compileText = function (template) {
    fieldCache = {};
    let result = textTemplater.parseTemplate(template, parseField);
    templateCache[template] = fieldCache;
    fieldCache = void 0;
    return {
        TemplateAST: result,
        HasErrors: null
    };
}

exports.assembleText = function (template, data) {
    let compiled = textTemplater.parseTemplate(template); // this fetches result out of a cache if it's already been called
    let result = textEvaluator.assembleText(data, compiled);
    return result;
}
