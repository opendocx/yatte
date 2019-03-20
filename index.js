const textTemplater = require('./text-templater');
const textEvaluator = require('./text-evaluator');
const expressions= require('angular-expressions');
const format = require('date-fns/format');
exports.ContextStack = require('./context-stack');
exports.FieldTypes = require('./fieldtypes');
exports.Table = require('./table');
exports.TestHelperTypes = require('./test/types-test');

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
exports.compileField = compile;

// fieldCache is a cache of parsed fields for the template that is currently being compiled.
// When a template has been compiled, the collection of all parsed fields in that template gets cached in templateCache.
// These caches are NOT CURRENTLY USED, but they will be soon.
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

const initFieldParsing = function(templateId) {
    fieldCache = {};
}
exports.initFieldParsing = initFieldParsing;

const finalizeFieldParsing = function(templateId) {
    templateCache[templateId] = fieldCache;
    fieldCache = void 0;
}
exports.finalizeFieldParsing = finalizeFieldParsing;

exports.compileText = function (template) {
    initFieldParsing(template);
    let result = textTemplater.parseTemplate(template, parseField);
    finalizeFieldParsing(template);
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

exports.extractFields = function(template) {
    let compiled = textTemplater.parseTemplate(template); // this fetches result out of a cache if it's already been called
    let extractedFields = textTemplater.extractFields(compiled);
    _parseExpressions(extractedFields);
    return extractedFields;
}

const _parseExpressions = function(contentArray) {
    for (const obj of contentArray) {
        if (typeof obj.expr == 'string') {
            obj.exprAst = _reduceAstNode(compile(obj.expr).ast.body[0].expression);
        }
        if (obj.type == 'List') {
            obj.exprAst.expectarray = true;
        }
        if (obj.contentArray) {
            _parseExpressions(obj.contentArray);
        }
    }
}
exports._parseExpressions = _parseExpressions;

const _reduceAstNode = function(astNode) {
    // prune endlessly recursive property
    const {toWatch, ...simplified} = astNode; 
    for (let prop in simplified) {
        switch (prop) {
            case 'object':
            case 'property':
            case 'callee':
            case 'key':
            case 'valule':
            case 'left':
            case 'right':
            case 'argument':
            case 'test':
            case 'alternate':
            case 'consequent':
                // recurse into nodes that can contain expressions of their own
                simplified[prop] = _reduceAstNode(simplified[prop]);
                break;
            case 'arguments':
            case 'elements':
            case 'properties':
                // recurse into nodes containing arrays of items that can contain expressions
                let thisArray = simplified[prop];
                if (thisArray && thisArray.length > 0) {
                    for (let i = 0; i++; i < thisArray.length) {
                        thisArray[i] = _reduceAstNode(thisArray[i]);
                    }
                }
                break;
            default:
                // should not need to do anything else
        }
    }
    return simplified;
}
exports._reduceAstNode = _reduceAstNode;