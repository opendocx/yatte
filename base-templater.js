const expressions= require('angular-expressions');
require('./filters'); // ensure filters are loaded into (shared) expressions object
const OD = require('./fieldtypes');

const parseContentArray = function(contentArray, bIncludeExpressions = true) {
    // contentArray can be either an array of strings (as from a text template split via regex)
    // or an array of objects with field text and field IDs (as extracted from a DOCX template)
    let astBody = [];
    let i = 0;
    while (i < contentArray.length) {
        const parsedContent = parseField(contentArray, i, bIncludeExpressions);
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
    return astBody;
}
exports.parseContentArray = parseContentArray;

const simplifyLogic = function(astBody) {
    // TODO: return a copy of astBody with all logically insignificant nodes pruned out
    return astBody;
}
exports.simplifyLogic = simplifyLogic;

const compileExpr = function(expr) {
    if (expr == ".") expr = "this";
    return expressions.compile(expr);
}
exports.compileExpr = compileExpr;

const parseField = function(contentArray, idx = 0, bIncludeExpressions = true) {
    const contentArrayItem = contentArray[idx];
    let content, fieldId;
    if (typeof contentArrayItem == 'string') {
        if (contentArrayItem.length == 0) return null; // empty string == ignore (== null)
        content = getFieldContent(contentArrayItem);
        if (content === null) return contentArrayItem; // not a field means it's static text
        fieldId = void 0;
    } else {
        // field object, e.g. extracted from DOCX
        content = contentArrayItem.content;
        fieldId = contentArrayItem.id;
    }

    if (content === null)
        throw `Unrecognized field text: '${contentArrayItem}'`
    
    // parse the field
    let match, node;
    if ((match = _ifRE.exec(content)) !== null) {
        node = createNode(OD.If, match[1], fieldId);
        if (bIncludeExpressions) parseFieldExpr(node);
        node.contentArray = parseContentUntil(contentArray, idx + 1, OD.EndIf, bIncludeExpressions);
    }
    else if ((match = _elseifRE.exec(content)) !== null) {
        node = createNode(OD.ElseIf, match[1], fieldId);
        if (bIncludeExpressions) parseFieldExpr(node);
        node.contentArray = [];
    }
    else if (_elseRE.test(content)) {
        node = createNode(OD.Else, void 0, fieldId, []);
    }
    else if (_endifRE.test(content)) {
        node = createNode(OD.EndIf, void 0, fieldId);
    }
    else if ((match = _listRE.exec(content)) !== null) {
        node = createNode(OD.List, match[1], fieldId);
        if (bIncludeExpressions) {
            parseFieldExpr(node);
            node.exprAst.expectarray = true;
        } 
        node.contentArray = parseContentUntil(contentArray, idx + 1, OD.EndList, bIncludeExpressions);
    }
    else if (_endlistRE.test(content)) {
        node = createNode(OD.EndList, void 0, fieldId);
    }
    else
    {
        node = createNode(OD.Content, content.trim(), fieldId);
        if (bIncludeExpressions) parseFieldExpr(node);
    }
    return node;
}

const createNode = function(type, expr, id, contentArray) {
    const newNode = {type: type};
    if (typeof expr == 'string') newNode.expr = expr;
    if (typeof id == 'string') newNode.id = id;
    if (Array.isArray(contentArray)) newNode.contentArray = contentArray;
    return newNode;
}

const parseFieldExpr = function(fieldObj) {
    // fieldObj is an object with two properties:
    //   type (string): the field type
    //   expr (string): the expression within the field that wants to be parsed
    let error = null;
    let compiledExpr;
    try {
        compiledExpr = compileExpr(fieldObj.expr);
        fieldObj.exprAst = reduceAstNode(compiledExpr.ast.body[0].expression);
        fieldObj.exprN = serializeAstNode(fieldObj.exprAst);
    } catch (err) {
        error = err;
    }
    if (error) throw error;
    return compiledExpr;
};

const parseContentUntil = function(contentArray, startIdx, targetType, bIncludeExpressions) {
    let idx = startIdx;
    let result = [];
    let parentContent = result;
    let elseEncountered = false;
    while (true) {
        const parsedContent = parseField(contentArray, idx, bIncludeExpressions);
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
    // remove (consume) all parsed items from the contentArray before returning
    contentArray.splice(startIdx, idx - startIdx);
    return result;
}

const _ifRE      = /^(?:if\b|\?)\s*(.*)$/;
const _elseifRE  = /^(?:elseif\b|\:\?)\s*(.*)$/;
const _elseRE    = /^(?:else|\:)$/;
const _endifRE   = /^(?:endif|\/\?)(?:.*)$/;
const _listRE    = /^(?:list\b|\#)\s*(.*)$/;
const _endlistRE = /^(?:endlist|\/\#)(?:.*)$/;

const getFieldContent = function(text) {
    if (text.slice(0,1) == '[' && text.slice(-1) == ']') {
        return text.slice(1,-1);
    }
    return null;
}

const reduceAstNode = function(astNode) {
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
                simplified[prop] = reduceAstNode(simplified[prop]);
                break;
            case 'arguments':
            case 'elements':
            case 'properties':
                // recurse into nodes containing arrays of items that can contain expressions
                let thisArray = simplified[prop];
                if (thisArray && thisArray.length > 0) {
                    for (let i = 0; i++; i < thisArray.length) {
                        thisArray[i] = reduceAstNode(thisArray[i]);
                    }
                }
                break;
            default:
                // should not need to do anything else
        }
    }
    return simplified;
}

const serializeAstNode = function(astNode) {
    switch(astNode.type) {
        case 'Program':
            return serializeAstNode(astNode.body[0]);
        case 'ExpressionStatement':
            return serializeAstNode(astNode.expression);
        case 'Literal':
            if (typeof astNode.value == 'string')
                return '"' + astNode.value + '"';
            return astNode.value.toString();
        case 'Identifier':
            return astNode.name;
        case 'MemberExpression':
            return serializeAstNode(astNode.object) + (astNode.computed ? ('[' + serializeAstNode(astNode.property) + ']') : ('.' + serializeAstNode(astNode.property)));
        case 'CallExpression':
            let str;
            if (astNode.filter) {
                str = serializeAstNode(astNode.arguments[0]) + '|' + serializeAstNode(astNode.callee);
                for (let i = 1; i < astNode.arguments.length; i++) {
                    str += ':' + _serializeAstNode(astNode.arguments[i]);
                }
            } else {
                str = serializeAstNode(astNode.callee) + '(' + astNode.arguments.map(argObj => serializeAstNode(argObj)).join(',') + ')';
            }
            return str;
        case 'ArrayExpression':
            return '[' + astNode.elements.map(elem => serializeAstNode(elem)).join(',') + ']';
        case 'ObjectExpression':
            return '{' + astNode.properties.map(prop => serializeAstNode(prop)).join(',') + '}';
        case 'Property':
            return serializeAstNode(astNode.key) + ':' + serializeAstNode(astNode.value);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return astNode.left + astNode.operator + astNode.right;
        case 'UnaryExpression':
            return astNode.prefix ? (astNode.operator + serializeAstNode(astNode.argument)) : (serializeAstNode(astNode.argument) + astNode.operator);
        case 'ConditionalExpression':
            let s = serializeAstNode(astNode.test) + '?' + serializeAstNode(astNode.alternate);
            if (astNode.consequent) s += ':' + serializeAstNode(astNode.consequent);
            return s;
        case 'ThisExpression':
            return 'this';
        default:
            throw 'Unsupported expression type';
    }
}
