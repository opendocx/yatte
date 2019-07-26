const expressions= require('angular-expressions');
require('./filters'); // ensure filters are loaded into (shared) expressions object
const OD = require('./fieldtypes');
const { AST, astMutateInPlace, escapeQuotes, unEscapeQuotes } = require('./estree')
exports.AST = AST
exports.escapeQuotes = escapeQuotes
exports.unEscapeQuotes = unEscapeQuotes
exports.serializeAST = AST.serialize // this export is redundant and deprecated, slated for removal in next version

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
    simplifyContentArray3(copy);
    return copy;
}
exports.buildLogicTree = buildLogicTree;

const compiledExprCache = {} // this doesn't seem to do anything... it's always empty? I'm missing something obvious.

/**
 * The result of calling compileExpr() is an instance of EvaluateExpression.
 * It is a curried function that (when called with a global and, optionally, local data context) will
 * return the result of evaluating the expression against that data context.
 *
 * The function also has a custom property called 'ast' containing the Abstract Syntax Tree for the parsed expression.
 *
 * @callback EvaluateExpression
 * @param {Object} scope - the (global) scope against which to evaluate the expression
 * @param {Object} locals - the local scope against which to evaluate the expression
 * @returns {*} - the value resulting from the evaluation
 * 
 * @property {Object} ast
 */

/**
 * compileExpr takes an expression (as a string) and returns a compiled version of that expression.
 * 
 * This functionality is largely inherited from the angular-expressions package.  However, there are a couple
 * problems with the ASTs produced by that package; also, yatte extends the angular-expressions idea of 'filters'
 * with a new variation ('list filters'). These problems and enhancements are addressed here through modifying
 * and extending the returned AST.
 * 
 * @param {string} expr
 * @returns {EvaluateExpression}
 */
const compileExpr = function(expr) {
    if (!expr) {
        throw new Error('Cannot compile invalid (empty or null) expression')
    }
    if (expr == ".") expr = "this";
    const cacheKey = expr;
    let result = compiledExprCache[cacheKey];
    if (!result) {
        result = expressions.compile(expr);
        // check if angular-expressions gave us back a cached copy that has already been fixed up!
        if (result.ast.body) { // if the AST still has "body" property (which we remove below), it has not yet been fixed
            // strip out the angular 'toWatch' array, etc., from the AST,
            // since I'm not entirely sure how to do anything useful with that stuff outside of Angular itself
            result.ast = reduceAstNode(result.ast.body[0].expression);
            // extend AST with enhanced nodes for filters
            let modified = fixFilters(result.ast)
            // normalize the expression
            let normalizedExpr = AST.serialize(result.ast)
            // recompile the expression if filter fixes changed its functionality
            if (modified) {
                let existingAst = result.ast
                result = expressions.compile(normalizedExpr)
                result.ast = existingAst
            }
            // save the normalized expression as a property of the compiled expression
            result.normalized = normalizedExpr
            // fix problem with Angular AST -- reversal of terms 'consequent' and 'alternate' in conditionals
            fixConditionalExpressions(result.ast) // (note: it serializes/normalizes the same whether this has been run or not)
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
        const {id, ...copyOfNode} = astNode; // strip field id if it's there // TODO: stop stripping the id!
        scope[astNode.expr] = copyOfNode;
        return copyOfNode;
    }
    if (astNode.type == OD.List) {
        let existingListNode
        if (existingListNode = scope[astNode.expr]) { // this list has already been added to the parent scope; revisit it to add more content members if necessary
            reduceContentArray(astNode.contentArray, existingListNode.contentArray, existingListNode.scope);
            return null;
        } else {
            const {id, contentArray, ...copyOfNode} = astNode; // TODO: stop stripping the id!
            copyOfNode.scope = {}; // fresh new wholly separate scope for lists
            copyOfNode.contentArray = reduceContentArray(contentArray, null, copyOfNode.scope);
            scope[astNode.expr] = copyOfNode; // set BEFORE recursion for consistent results?  (or is it intentionally after?)
            return copyOfNode;
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
            // AND VICE VERSA: an expression emitted as part of a content node STILL needs to be emitted as part of a condition, too.

            const {id, contentArray, ...copyOfNode} = astNode; // TODO: stop stripping the id!
            // this 'parentScope' thing is a bit tricky.  The parentScope argument is only supplied when we're inside an If/ElseIf/Else block within the current scope.
            // If supplied, it INDIRECTLY refers to the actual scope -- basically, successive layers of "if" blocks
            // that each establish a new "mini" scope, that has the parent scope as its prototype.
            // This means, a reference to an identifier in a parent scope, will prevent that identifier from appearing (redundantly) in a child;
            // but a reference to an identifier in a child scope, will NOT prevent that identifier from appearing in a parent scope.
            const pscope = (parentScope != null) ? parentScope : scope;
            if (copyOfNode.type == OD.If || copyOfNode.type == OD.ElseIf) {
                if (('if$'+astNode.expr) in pscope) {
                    copyOfNode.firstRef = false; // firstRef = false means opendocx, when it's deciding which expressions to evaluate and place in output XML, will skip this one
                } else {
                    pscope['if$'+astNode.expr] = copyOfNode;
                    copyOfNode.firstRef = true; // firstRef = true means the firs time this IF expression has been encountered in this scope, so opendocx will output this expression in the data XML
                }
            }            
            const childContext = Object.create(pscope);
            copyOfNode.contentArray = reduceContentArray(contentArray, null, childContext, pscope);
            return copyOfNode;
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

const simplifyContentArray3 = function(body, scope = {}) {
    // 3rd pass at simplifying scopes
    // first go through content fields
    let i = 0
    while (i < body.length) {
        let field = body[i]
        let nodeRemoved = false
        if (field.type === OD.Content) {
            if (field.expr in scope) {
                body.splice(i, 1)
                nodeRemoved = true
            } else {
                scope[field.expr] = true
            }
        }
        if (!nodeRemoved) {
            i++
        }
    }
    // then recurse into ifs and lists
    for (const field of body) {
        if (field.type === OD.List) {
            if (!(field.expr in scope)) {
                scope[field.expr] = true
            }
            simplifyContentArray3(field.contentArray, {}) // new scope for lists
        } else if (field.type === OD.If || field.type === OD.ElseIf || field.type === OD.Else) {
            simplifyContentArray3(field.contentArray, { ...scope }) // copy scope for ifs
        }
    }
    // note: although this will eliminate some redundant fields, it will not eliminate all of them.
    // A partial rewrite is planned to implement a new, more straight-forward approach.
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
            case 'consequent':
            case 'alternate':
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
 * Note: if this function makes changes, it modifies the given ast *in place*. The return value indicates whether
 *       or not changes were made.
 * 
 * @param {object} astNode 
 * @returns {boolean}
 */
const fixConditionalExpressions = function (astNode) {
    return astMutateInPlace(astNode, node => {
        if (node.type === AST.ConditionalExpression) {
            if (!node.fixed) {
                let swap = node.alternate;
                node.alternate = node.consequent;
                node.consequent = swap;
                node.fixed = true;
                return true; // made a change
            }
        }
        return false; // nothing changed
    })
}

/**
 * Recursively processes the given AST node to determine if it contains any "filters", either typical angular-type filters
 * or yatte list filters. If it does, it modifies the AST to more explicitly and naturally represent these filters.
 * 
 * Note: if this function makes changes, it modifies the given ast *in place*. The return value indicates whether
 *       or not changes were made.
 * 
 * @param {object} astNode 
 * @returns {boolean}
 */
const fixFilters = function (astNode) {
    return astMutateInPlace(astNode, node => {
        if (node.type === AST.CallExpression && node.filter && (node.arguments.length < 2 || node.arguments[1].type !== AST.ThisExpression)) {
            convertCallNodeToFilterNode(node)
            if (node.rtl) {
                let newNode = getRTLFilterChain(node)
                if (newNode !== node) {
                    node.input = newNode.input
                    node.filter = newNode.filter
                    node.arguments = newNode.arguments
                }
            }
            return true;
        }
        return false;
    })
}

/**
 * Given a chain of one or more filter nodes that are supposed to have right-to-left associativity, but
 * which have been parsed (as filter nodes are, initially, by angular-expressions) as left-to-right,
 * reverse the order/structure of the nodes in the chain, and return the node at the beginning of the chain.
 */
const getRTLFilterChain = function(node, innerNode = undefined) {
    // check if its input is also a filter, and if so, recurse / transform AST to reflect correct associativity
    let inputNode = node.input
    if (inputNode.type === AST.CallExpression && inputNode.filter) {
        convertCallNodeToFilterNode(inputNode)
        if (inputNode.rtl) {
            let newInnerNode = {
                type: AST.ListFilterExpression,
                rtl: true,
                input: inputNode.arguments[0],
                filter: node.filter,
                arguments: innerNode ? [ innerNode ] : node.arguments
            }
            return getRTLFilterChain(inputNode, newInnerNode)
        }
    }
    // else
    if (innerNode) {
        node.arguments = [ innerNode ]
    }
    return node
}

const convertCallNodeToFilterNode = function (node) {
    node.filter = node.callee
    delete node.callee
    node.input = node.arguments.shift()
    if (['sort', 'filter', 'map', 'some', 'any', 'every', 'all', 'find', 'group'].includes(node.filter.name)) {
        node.type = AST.ListFilterExpression
        // resolve aliases
        if (node.filter.name === 'some') { // alias for 'any'
            node.filter.name = 'any'
        } else if (node.filter.name === 'all') { // alias for 'every'
            node.filter.name = 'every'
        }
        node.rtl = ['any', 'every'].includes(node.filter.name);
    } else {
        node.type = AST.AngularFilterExpression
    }
}
