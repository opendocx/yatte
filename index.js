const textTemplater = require('./text-templater');
const textEvaluator = require('./text-evaluator');
exports.Engine = require('./base-templater');
exports.ContextStack = require('./context-stack');
exports.FieldTypes = require('./fieldtypes');
exports.Table = require('./table');
exports.TestHelperTypes = require('./test/types-test');

exports.compileText = function (template) {
    let result = textTemplater.parseTemplate(template, parseField);
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
    return extractedFields;
}
