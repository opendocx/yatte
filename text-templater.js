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
    // if any fields are on a lines by themselves, remove the CR/LF following those fields
    template = template.replace(_blockFieldRE, `{$1}`);
    let templateSplit = template.split(_fieldRE);
    if (templateSplit.length < 2) {  // no fields
        templateCache[template] = template;
        return template;
    }
    return base.parseContentArray(templateSplit, bIncludeExpressions);
}

const _blockFieldRE = /(?<=\n|\r|^)\{\s*(\[[^{}]*?\])\s*\}(?:\r\n|\n|\r)/g;
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
