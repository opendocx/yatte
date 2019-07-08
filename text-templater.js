const base = require('./base-templater');
const templateCache = {};

/* parseTemplate parses a text template (passed in as a string)
   into an object tree structure -- essentially a high-level AST for the template.

   CRLF handling:
   any field that's alone on a line of text (preceded by either a CRLF or the beginning of the string, and followed by a CRLF),
   needs to (during parsing) "consume" the CRLF that follows it, to avoid unexpected lines in the assembled output.
*/
exports.parseTemplate = function(template, bIncludeExpressions = true)
{
    if (templateCache.hasOwnProperty(template))
        return templateCache[template];
    // if any block-level paired fields are on a lines by themselves, remove the CR/LF following those fields
    // (but leave block-level content fields alone)
    let tweaked = template.replace(_blockFieldRE, _blockFieldReplacer);
    let templateSplit = tweaked.split(_fieldRE); // TODO: improve this approach with something that captures & retains each field offset
    if (templateSplit.length < 2) {  // no fields
        templateCache[template] = [template];
        return templateCache[template];
    }
    return templateCache[template] = base.parseContentArray(templateSplit, bIncludeExpressions);
}
const _blockFieldReplacer = function(match, fieldText, eol, offset, string) {
    var cleaned = `{[${fieldText}]}`;
    if (!fieldText.match(/^if|\?|else|\:|list|\#|end|\//)) {
        cleaned += eol; 
    }
    return cleaned;
}
const _blockFieldRE = /(?<=\n|\r|^)\{\s*\[([^{}]*?)\]\s*\}(\r\n|\n|\r)/g;
const _fieldRE   = /\{\s*(\[.*?\])\s*\}/;

const extractFields = function (contentArray) {
    return contentArray
        .filter(obj => obj != null && typeof obj == "object")
        .map(obj => {
            const newObj = { type: obj.type };
            if (typeof obj.expr == 'string')
                newObj.expr = obj.expr;
            if (obj.exprAst)
                newObj.exprAst = obj.exprAst;
            if (obj.contentArray && obj.contentArray.length > 0)
                newObj.contentArray = extractFields(obj.contentArray);
            return newObj;
        });
}
exports.extractFields = extractFields;
