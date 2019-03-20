const util = require('util');
const OD = require('./fieldtypes');
const templateCache = {};

/* parseTemplate parses a text template (passed in as a string)
   into an object tree structure -- essentially a high-level AST for the template.
*/
exports.parseTemplate = function(template, parseFieldCallback)
{
    if (templateCache.hasOwnProperty(template))
        return templateCache[template];
    // if any fields are on a lines by themselves, remove the CR/LF following those fields
    template = template.replace(_blockFieldRE, `{$1}`);
    let templateSplit = template.split(_fieldRE);
    let astBody = [];
    if (templateSplit.length < 2) {  // no fields
        return template;
    }

    let i = 0;
    while (i < templateSplit.length) {
        const parsedContent = ParseContent(templateSplit, i, parseFieldCallback);
        if (parsedContent !== null) {
            if (typeof parsedContent == "object"
                && (    parsedContent.type == OD.EndList
                        || parsedContent.type == OD.EndIf
                        || parsedContent.type == OD.Else
                        || parsedContent.type == OD.ElseIf
                    )
                )
            {
                throw "Unmatched " + parsedContent.type;
            }
            astBody.push(parsedContent);
        }
        i++;
    }
    templateCache[template] = astBody;
    return astBody;
}

// CRLF handling:
// any field that's alone on a line of text (preceded by either a CRLF or the beginning of the string, and followed by a CRLF),
// needs to (during parsing) "consume" the CRLF that follows it, to avoid unexpected lines in the assembled output.

const _blockFieldRE = /(?<=\n|\r|^)\{\s*(\[[^{}]*?\])\s*\}(?:\r\n|\n|\r)/g;
const _fieldRE   = /\{\s*(\[.*?\])\s*\}/;
const _ifRE      = /\[\s*(?:if\b|\?)\s*(.*)\s*\]/;
const _elseifRE  = /\[\s*(?:elseif\b|\:\?)\s*(.*)\s*\]/;
const _elseRE    = /\[\s*(?:else|\:)\s*\]/;
const _endifRE   = /\[\s*(?:endif|\/\?)(?:.*)\]/;
const _listRE    = /\[\s*(?:list\b|\#)\s*(.*)\s*\]/;
const _endlistRE = /\[\s*(?:endlist|\/\#)(?:.*)\]/;

function ParseContentUntil(contentArray, startIdx, targetType, parseFieldCallback) {
    let idx = startIdx;
    let result = [];
    let parentContent = result;
    let elseEncountered = false;
    while (true) {
        const parsedContent = ParseContent(contentArray, idx, parseFieldCallback);
        const isObj = (typeof parsedContent == "object" && parsedContent !== null);
        idx++;
        if (isObj && parsedContent.type == targetType)
            break;
        if (parsedContent)
            parentContent.push(parsedContent);
        if (isObj && (parsedContent.type == OD.ElseIf || parsedContent.type == OD.Else))
        {
            if (targetType == OD.EndIf) {
                if (elseEncountered)
                    throw parsedContent.type + " cannot follow an Else";
                if (parsedContent.type == OD.Else)
                    elseEncountered = true;
                parentContent = parsedContent.contentArray;
            }
            else if (targetType == OD.EndList) {
                throw parsedContent.type + " cannot be in a List";
            }
        }
        if (isObj && (parsedContent.type == OD.EndIf || parsedContent.type == OD.EndList))
        {
            throw "Unmatched " + parsedContent.type;
        }
        if (idx >= contentArray.length)
            throw (targetType + " not found");
    };
    // remove all parsed items from the contentArray before returning
    contentArray.splice(startIdx, idx - startIdx);
    return result;
}

function ParseContent(contentArray, idx = 0, parseFieldCallback) {
    const content = contentArray[idx];
    if (content.length == 0)
        return null;
    if (content[0] == "[")
    {
        // parse the field
        let match, parsed;
        if ((match = _ifRE.exec(content)) !== null) {
            parsed = {type: OD.If, expr: match[1]};
            if (parseFieldCallback) parseFieldCallback(parsed);
            parsed.contentArray = ParseContentUntil(contentArray, idx + 1, OD.EndIf, parseFieldCallback);
        }
        else if ((match = _elseifRE.exec(content)) !== null) {
            parsed = {type: OD.ElseIf, expr: match[1]};
            if (parseFieldCallback) parseFieldCallback(parsed);
            parsed.contentArray = [];
        }
        else if (_elseRE.test(content)) {
            parsed = {type: OD.Else, contentArray: []};
        }
        else if (_endifRE.test(content)) {
            parsed = {type: OD.EndIf};
        }
        else if ((match = _listRE.exec(content)) !== null) {
            parsed = {type: OD.List, expr: match[1]};
            if (parseFieldCallback) parseFieldCallback(parsed);
            parsed.contentArray = ParseContentUntil(contentArray, idx + 1, OD.EndList, parseFieldCallback);
        }
        else if (_endlistRE.test(content)) {
            parsed = {type: OD.EndList};
        }
        else if (content[0] == "[" && content[content.length - 1] == "]")
        {
            parsed = {type: OD.Content, expr: content.substr(1, content.length-2).trim()};
        }
        else
            throw "Unrecognized field delimiters?";
        return parsed;
    }
    // else 
    return content; 
}

const extractFields = function (contentArray) {
    return contentArray
        .filter(obj => obj != null && typeof obj == "object")
        .map(obj => {
            const newObj = { type: obj.type };
            if (typeof obj.expr == 'string')
                newObj.expr = obj.expr;
            if (obj.contentArray && obj.contentArray.length > 0)
                newObj.contentArray = extractFields(obj.contentArray);
            return newObj;
        });
}
exports.extractFields = extractFields;