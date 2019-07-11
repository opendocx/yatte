const expressions= require('angular-expressions');
require('./filters'); // ensure filters are loaded into (shared) expressions object
const OD = require('./fieldtypes');
const { serializeAstNode } = require('./serialize')
exports.serializeAST = serializeAstNode;

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
                throw new Error("Unmatched " + parsedContent.type)
            }
            astBody.push(parsedContent);
        }
        i++;
    }
    return astBody;
}
exports.parseContentArray = parseContentArray;

const buildLogicTree = function(astBody) {
    // return a copy of astBody with all (or at least some) logically insignificant nodes pruned out:
    // remove plain text nodes (non-dynamic)
    // remove EndIf and EndList nodes
    // remove Content nodes that are already defined in the same logical/list scope
    // always process down all if branches & lists
    // ~~~strip field ID metadata (for docx templates) since it no longer applies~~~ revised: leave it in so we know more about error location
    const copy = reduceContentArray(astBody);
    simplifyContentArray2(copy);
    return copy;
}
exports.buildLogicTree = buildLogicTree;

const compiledExprCache = {} // this doesn't seem to do anything... it's always empty? I'm missing something obvious.

const compileExpr = function(expr) {
    if (!expr) {
        throw new Error('Cannot compile invalid (empty or null) expression')
    }
    if (expr == ".") expr = "this";
    const cacheKey = expr;
    let result = compiledExprCache[cacheKey];
    if (!result) {
        result = expressions.compile(expr);
        // check if angular-expressions gave us back a cached copy that is already fixed up!
        if (result.ast.body) {
            let normalizedExpr
            // Yatte adds to the regular "filters" supported by angular-expressions, a new concept: the "list filter".
            // List filters accept as an argument, an expression that will be executed once for each item in the list.
            // To facilitate this, if the compiled expression contains any list filters, we go back in and fix them up
            // to replace the expression-type argument with a normalized string version of the same expression.
            // This allows the evaluation of that expression to be delayed until the list filter itself is executing,
            // rather than having that expression evaluated only one time BEFORE execution reaches the list filter
            // (which is what would happen if we did not make the next call).
            if (doctorListFilters(result.ast)) {
                // list filters had to be fixed up, meaning, we need to REcompile the expression so it will work the new way
                normalizedExpr = serializeAstNode(result.ast)
                result = expressions.compile(normalizedExpr)
            } else {
                normalizedExpr = serializeAstNode(result.ast)
            }
            // strip out the angular 'toWatch' array, etc., from the AST,
            // since I'm not entirely sure how to do anything useful with that stuff outside of Angular itself
            result.ast = reduceAstNode(result.ast.body[0].expression);
            // fix problem with Angular AST -- reversal of terms 'consequent' and 'alternate' in conditionals
            fixConditionalExpressions(result.ast);
            // save the normalized expression as a property of the compiled expression
            result.normalized = normalizedExpr
        }
        // cache the compiled expression under the original string
        compiledExprCache[cacheKey] = result;
        // does it make any sense to also cache the compiled expression under the normalized string?
        // Maybe not, since you have to compile the expression in order to GET a normalized string...
    }
    return result;
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
        throw new Error(`Unrecognized field text: '${contentArrayItem}'`)
    
    // parse the field
    let match, node;
    if ((match = _ifRE.exec(content)) !== null) {
        node = createNode(OD.If, match[1], fieldId);
        if (bIncludeExpressions) parseFieldExpr(node);
        node.contentArray = parseContentUntilMatch(contentArray, idx + 1, OD.EndIf, bIncludeExpressions);
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
        } 
        node.contentArray = parseContentUntilMatch(contentArray, idx + 1, OD.EndList, bIncludeExpressions);
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
    const expectarray = (fieldObj.type == OD.List);
    try {
        let compiledExpr = compileExpr(fieldObj.expr);
        fieldObj.exprAst = compiledExpr.ast;
        if (expectarray) {
            fieldObj.exprAst.expectarray = expectarray;
        }
        fieldObj.expr = compiledExpr.normalized; // normalize all expressions
        return compiledExpr
    } catch (err) {
        // do something here maybe?
        throw err;
    }
};

const parseContentUntilMatch = function(contentArray, startIdx, targetType, bIncludeExpressions) {
    let idx = startIdx;
    let result = [];
    let parentContent = result;
    let elseEncountered = false;
    while (true) {
        const parsedContent = parseField(contentArray, idx, bIncludeExpressions);
        const isObj = (typeof parsedContent == "object" && parsedContent !== null);
        idx++;
        if (isObj && parsedContent.type == targetType) {
            if (parsedContent.type == OD.EndList) {
                // future: possibly inject this only if we're in a list on which the "punc" filter was used
                // (because without the "punc" filter specifying list punctuation, this node will be a no-op)
                // However, that is a little more complicated than it might seem, because this
                // code operates in parallel with OpenDocx, which does the same thing (always inserting
                // a punctuation placeholder at the tail-end of every list) for DOCX templates.
                // See "puncElem" in OpenDocx.Templater\Templater.cs
                injectListPunctuationNode(parentContent, bIncludeExpressions)
            }
            parentContent.push(parsedContent);
            break;
        }
        if (parsedContent)
            parentContent.push(parsedContent);
        if (isObj && (parsedContent.type == OD.ElseIf || parsedContent.type == OD.Else))
        {
            if (targetType == OD.EndIf) {
                if (elseEncountered)
                    throw new Error(parsedContent.type + " cannot follow an Else")
                if (parsedContent.type == OD.Else)
                    elseEncountered = true;
                parentContent = parsedContent.contentArray;
            }
            else if (targetType == OD.EndList) {
                throw new Error(parsedContent.type + " cannot be in a List")
            }
        }
        if (isObj && (parsedContent.type == OD.EndIf || parsedContent.type == OD.EndList))
        {
            throw new Error("Unmatched " + parsedContent.type)
        }
        if (idx >= contentArray.length)
            throw new Error(targetType + " not found")
    };
    // remove (consume) all parsed items from the contentArray before returning
    contentArray.splice(startIdx, idx - startIdx);
    return result;
}

const injectListPunctuationNode = function(contentArray, bIncludeExpressions) {
    // synthesize list punctuation node
    const puncNode = createNode(OD.Content, '_punc', void 0); // id==undefined because there is not (yet) a corresponding field in the template
    if (bIncludeExpressions) parseFieldExpr(puncNode);
    // find last non-empty node in the list
    let i = contentArray.length - 1
    while (i >= 0 && (contentArray[i] === '' || contentArray[i] === null)) {
        i--;
    }
    let priorNode = (i >= 0) ? contentArray[i] : null
    // if it's a text node, place the list punctuation node at its end but PRIOR to any line breaks; otherwise just place the list punctuation at the end
    if (typeof priorNode === 'string') {
        let ix = priorNode.length - 1
        let bInsert = false;
        while (ix >= 0 && '\r\n'.includes(priorNode[ix])) {
            bInsert = true
            ix--
        }
        if (bInsert) { // split text node and insert Content node
            let before = priorNode.slice(0, ix + 1)
            let after = priorNode.slice(ix + 1)
            if (before.length > 0) {
                contentArray[i] = before
                contentArray.splice(i + 1, 0, puncNode, after)
            } else {
                contentArray.splice(i, 1, puncNode, after)
            }
        }
        else {
            contentArray.push(puncNode)
        }  
    }
    else {
        contentArray.push(puncNode)
    }
}

const _ifRE      = /^(?:if\b|\?)\s*(.*)$/;
const _elseifRE  = /^(?:elseif\b|\:\?)\s*(.*)$/;
const _elseRE    = /^(?:else|\:)$/;
const _endifRE   = /^(?:endif|\/\?)(?:.*)$/;
const _listRE    = /^(?:list\b|\#)\s*(.*)$/;
const _endlistRE = /^(?:endlist|\/\#)(?:.*)$/;
const _curlyquotes = /[“”]/g;
const _zws = /[\u{200B}\u{200C}]/gu;

const getFieldContent = function(text) {
    if (text.slice(0,1) == '[' && text.slice(-1) == ']') {
        return text.slice(1,-1).replace(_curlyquotes, '"').replace(_zws, '')
    }
    return null;
}

const reduceContentArray = function(astBody, newBody = null, scope = null, parentScope = null) {
    // prune plain text nodes (non-dynamic, so they don't affect logic)
    // prune EndIf and EndList nodes (only important insofar as we need to match up nodes to fields -- which will not be the case with a reduced logic tree)
    // prune redundant Content nodes that are already defined in the same logical & list scope
    // always process down all if branches & lists
    //    but mark check whether each if expression is the first (in its scope) to refer to the expression, and if so, indicate it on the node
    // future: compare logical & list scopes of each item, and eliminate logical branches and list iterations that are redundant
    if (newBody === null) newBody = [];
    if (scope === null) scope = {};
    for (const obj of astBody) {
        let newObj = reduceContentNode(obj, scope, parentScope);
        if (newObj !== null) {
            newBody.push(newObj);
        }
    }
    return newBody;
}

const reduceContentNode = function(astNode, scope, parentScope = null) {
    if (typeof astNode == 'string') return null; // plain text node -- boilerplate content in a text template (does not occur in other template types)
    if (astNode.type == OD.EndList || astNode.type == OD.EndIf) return null;

    if (astNode.type == OD.Content) {
        if (scope[astNode.expr]) return null; // expression already defined in this scope
        const {id, ...copy} = astNode; // strip field id if it's there // TODO: stop stripping the id!
        scope[astNode.expr] = copy;
        return copy;
    }
    if (astNode.type == OD.List) {
        let existingListNode
        if (existingListNode = scope[astNode.expr]) { // this list has already been added to the parent scope; revisit it to add more content members if necessary
            reduceContentArray(astNode.contentArray, existingListNode.contentArray, existingListNode.scope);
            return null;
        } else {
            const {id, contentArray, ...copy} = astNode; // TODO: stop stripping the id!
            copy.scope = {}; // fresh new wholly separate scope for lists
            copy.contentArray = reduceContentArray(contentArray, null, copy.scope);
            scope[astNode.expr] = copy; // set BEFORE recursion for consistent results?  (or is it intentionally after?)
            return copy;
        }
    }
    if (astNode.type == OD.If || astNode.type == OD.ElseIf || astNode.type == OD.Else) {
            // if's are always left in at this point (because of their importance to the logic;
            // a lot more work would be required to accurately optimize them out.)
            // But we still need to check whether the if expr is in the scope already (or not)
            // so we can place a "firstRef" hint in the node, which is used by opendocx to decide whether
            // this expression should be included in the data as its being transformed into XML (UGLY! improvement planned ASAP!)
            // HOWEVER, we can't add the expr to the parent scope by virtue of it having been referenced in a condition,
            // because it means something different for the same expression to be evaluated in a Content node vs. an If/ElseIf node,
            // and therefore an expression emitted/evaluated as part of a condition still needs to be emitted/evaluated as part of a merge/content node.

            const {id, contentArray, ...copy} = astNode; // TODO: stop stripping the id!
            // this 'parentScope' thing is a bit tricky.  The parentScope argument is only supplied when we're inside an If/ElseIf/Else block within the current scope.
            // If supplied, it INDIRECTLY refers to the actual scope -- basically, successive layers of "if" blocks
            // that each establish a new "mini" scope, that has the parent scope as its prototype.
            // This means, a reference to an identifier in a parent scope, will prevent that identifier from appearing (redundantly) in a child;
            // but a reference to an identifier in a child scope, will NOT prevent that identifier from appearing in a parent scope.
            const ps = (parentScope != null) ? parentScope : scope;
            if (copy.type == OD.If || copy.type == OD.ElseIf) {
                if (astNode.expr in ps) {
                    copy.firstRef = false; // firstRef = false means opendocx, when it's deciding which expressions to evaluate and place in output XML, will skip this one
                } else {
                    ps[astNode.expr] = false; // we put this expression "in" the scope, but set it to false -- so the checks above in Content and List (that check for truthiness) will not see it, but the checks here (that check for "in") WILL see it.
                    copy.firstRef = true; // firstRef = true means the firs time this IF expression has been encountered in this scope, so opendocx will output this expression in the data XML
                }
            }            
            const childContext = Object.create(ps);
            copy.contentArray = reduceContentArray(contentArray, null, childContext, ps);
            return copy;
    }
}

const simplifyContentArray2 = function(astBody) {
    // 2nd pass at simplifying logic
    // for now, just clean up scope helpers leftover from first pass
    for (const obj of astBody) {
        simplifyNode2(obj);
    }
}

const simplifyNode2 = function(astNode) {
    if (astNode.scope)
        delete astNode.scope;
    if (Array.isArray(astNode.contentArray))
        simplifyContentArray2(astNode.contentArray);
}

const reduceAstNode = function(astNode) {
    // prune endlessly recursive property
    const {toWatch, watchId, ...simplified} = astNode; 
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
                    for (let i = 0; i < thisArray.length; i++) {
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

/**
 * Recursively processes the given AST node to determine if it contains any "list filters", and if it does,
 * changes the filter's argument from an expression into a string literal.
 *
 * Yatte adds to the regular "filters" supported by angular-expressions, a new concept: the "list filter".
 * List filters accept (as an argument) an expression that will be executed once FOR EACH item in the list.
 * 
 * This function facilitate this delayed evaluation of the expression.  See implementation of the filters
 * sort, filter, map, some, every, find, and group (in filters.js) for how this string is used.
 * 
 * @param {object} astNode 
 * @returns {boolean}
 */
const doctorListFilters = function (astNode) {
    switch(astNode.type) {
        case 'Program':
            return astNode.body.reduce((accumulator, statementObj) => accumulator |= doctorListFilters(statementObj), false);
        case 'ExpressionStatement':
            return doctorListFilters(astNode.expression);
        case 'Literal':
        case 'Identifier':
        case 'ThisExpression':
            return false;
        case 'MemberExpression':
            return doctorListFilters(astNode.object) | doctorListFilters(astNode.property);
        case 'CallExpression':
            if (!astNode.filter) {
                return doctorListFilters(astNode.callee) | astNode.arguments.reduce((accumulator, argObj) => accumulator |= doctorListFilters(argObj), false);
            } // else astNode.filter == true
            switch (astNode.callee.name) {
                case 'sort':
                case 'filter':
                case 'map':
                case 'some':
                case 'every':
                case 'find':
                case 'group':
                    let changed = false
                    for (let i = 0; i < astNode.arguments.length; i++) {
                        let argument = astNode.arguments[i];
                        if (argument.type == 'CallExpression' && argument.filter) { // chained filter
                            changed |= doctorListFilters(argument);
                        }
                        else if (i > 0 && argument.type != 'Literal') {
                            astNode.arguments[i] = {type: 'Literal', constant: true, value: escapeQuotes(serializeAstNode(argument))}
                            changed = true;
                        }
                    }
                    return changed;
                default:
                    return doctorListFilters(astNode.callee) | astNode.arguments.reduce((accumulator, argObj) => accumulator |= doctorListFilters(argObj), false);
            }
        case 'ArrayExpression':
            return astNode.elements.reduce((accumulator, elem) => accumulator |= doctorListFilters(elem), false);
        case 'ObjectExpression':
            return astNode.properties.reduce((accumulator, prop) => accumulator |= doctorListFilters(prop), false);
        case 'Property':
            return doctorListFilters(astNode.key) | doctorListFilters(astNode.value);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return doctorListFilters(astNode.left) | doctorListFilters(astNode.right);
        case 'UnaryExpression':
            return doctorListFilters(astNode.argument);
        case 'ConditionalExpression':
            return doctorListFilters(astNode.test) | doctorListFilters(astNode.alternate) | (astNode.consequent ? doctorListFilters(astNode.consequent) : false);
        default:
            return false;
    }
}

const escapeQuotes = function (str) {
    return str.replace(/"/g,'&quot;')
}

/**
 * Recursively processes the given AST node to determine if it contains any conditional expressions, and if it does,
 * it reverses the "alternate" and "consequent" properties to conform to the generally-understood meanings of those terms,
 * for consistency and compatibility with other AST node types (IfStatements in particular).
 * See:
 *      https://github.com/estree/estree/blob/master/es5.md#conditionalexpression
 *          ... which does not say what is what, but gives the wrong idea by its ordering of the properties, and
 *      https://github.com/estree/estree/blob/master/es5.md#ifstatement
 *          ... which makes it clear that "consequent" is the "then", while "alternate" is the "else" (by virtue of it being optional)
 
 * and all kinds of sources that make the intended meanings of "consequent" clear:
 *      https://www.gnu.org/software/mit-scheme/documentation/mit-scheme-ref/Conditionals.html
 *      https://en.wikipedia.org/wiki/Conditional_(computer_programming)
 *
 * When Angular parses conditional expressions, although it generally follows a subset of the ESTree spec,
 * it places the portion following '?' in "alternate" and the portion following ':' in "consequent",
 * which is backwards and causes problems if you intend to use the AST for any other purpose.
 * 
 * @param {object} astNode 
 * @returns {boolean}
 */
const fixConditionalExpressions = function (astNode) {
    let swap
    switch(astNode.type) {
        case 'Program':
            return astNode.body.reduce((accumulator, statementObj) => accumulator |= fixConditionalExpressions(statementObj), false);
        case 'ExpressionStatement':
            return fixConditionalExpressions(astNode.expression);
        case 'Literal':
        case 'Identifier':
        case 'ThisExpression':
            return false;
        case 'MemberExpression':
            return fixConditionalExpressions(astNode.object) | fixConditionalExpressions(astNode.property);
        case 'CallExpression':
            return fixConditionalExpressions(astNode.callee) | astNode.arguments.reduce((accumulator, argObj) => accumulator |= fixConditionalExpressions(argObj), false);
        case 'ArrayExpression':
            return astNode.elements.reduce((accumulator, elem) => accumulator |= fixConditionalExpressions(elem), false);
        case 'ObjectExpression':
            return astNode.properties.reduce((accumulator, prop) => accumulator |= fixConditionalExpressions(prop), false);
        case 'Property':
            return fixConditionalExpressions(astNode.key) | fixConditionalExpressions(astNode.value);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return fixConditionalExpressions(astNode.left) | fixConditionalExpressions(astNode.right);
        case 'UnaryExpression':
            return fixConditionalExpressions(astNode.argument);
        case 'ConditionalExpression':
            let childFixed = fixConditionalExpressions(astNode.test) | fixConditionalExpressions(astNode.alternate) | fixConditionalExpressions(astNode.consequent);
            if (!astNode.fixed) {
                swap = astNode.alternate;
                astNode.alternate = astNode.consequent;
                astNode.consequent = swap;
                astNode.fixed = true;
            }
            return childFixed || astNode.fixed;
        default:
            return false;
    }
}
