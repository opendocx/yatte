const expressions = require('angular-expressions')
require('url')
exports.filters = require('./filters') // ensure filters are loaded into (shared) expressions object
const OD = require('./fieldtypes')
const { AST, astMutateInPlace, escapeQuotes, unEscapeQuotes } = require('./estree')
exports.AST = AST
exports.escapeQuotes = escapeQuotes
exports.unEscapeQuotes = unEscapeQuotes
exports.serializeAST = AST.serialize // this export is redundant and deprecated, slated for removal in next version

const parseContentArray = function (contentArray, bIncludeExpressions = true, bIncludeListPunctuation = true) {
  // contentArray can be either an array of strings (as from a text template split via regex)
  // or an array of objects with field text and field IDs (as extracted from a DOCX template)
  // In the latter case (array of objects), sub-arrays indicate discreet blocks of content
  // (paragraphs, table cells, etc.)??
  const astBody = []
  let i = 0
  while (i < contentArray.length) { // we use a 'while' because contentArray gets shorter as we go!
    const parsedContentItem = parseContentItem(i, contentArray, bIncludeExpressions, bIncludeListPunctuation)
    if (parsedContentItem.length === 1) {
      const parsedContent = parsedContentItem[0]
      if (typeof parsedContent === 'object' &&
           (parsedContent.type === OD.EndList ||
            parsedContent.type === OD.EndIf ||
            parsedContent.type === OD.Else ||
            parsedContent.type === OD.ElseIf
           )
      ) {
        // Field X's EndList/EndIf/Else/ElseIf has no matching List/If
        const errMsg = `${parsedContent.id ? `Field ${parsedContent.id}'s` : 'The'} ${parsedContent.type
        } has no matching ${(parsedContent.type === OD.EndList) ? 'List' : 'If'}`
        throw new Error(errMsg)
      }
    }
    Array.prototype.push.apply(astBody, parsedContentItem)
    i++
  }
  return astBody
}
exports.parseContentArray = parseContentArray

const validateContentArray = function (contentArray) {
  const astBody = []
  let i = 0
  while (i < contentArray.length) { // we use a 'while' because contentArray gets shorter as we go!
    const parsedContentItem = validateContentItem(i, contentArray)
    if (parsedContentItem.length === 1) {
      const parsedContent = parsedContentItem[0]
      if (typeof parsedContent === 'object' &&
           (parsedContent.type === OD.EndList ||
            parsedContent.type === OD.EndIf ||
            parsedContent.type === OD.Else ||
            parsedContent.type === OD.ElseIf
           )
      ) {
        // Field X's EndList/EndIf/Else/ElseIf has no matching List/If
        const errMsg = `${parsedContent.id ? `Field ${parsedContent.id}'s` : 'The'} ${parsedContent.type
        } has no matching ${(parsedContent.type === OD.EndList) ? 'List' : 'If'}`
        throw new Error(errMsg)
      }
    }
    Array.prototype.push.apply(astBody, parsedContentItem)
    i++
  }
  return astBody
}
exports.validateContentArray = validateContentArray

const buildLogicTree = function (astBody) {
  // return a copy of astBody with all (or at least some) logically insignificant nodes pruned out:
  // remove plain text nodes (non-dynamic)
  // remove EndIf and EndList nodes
  // remove Content nodes that are already defined in the same logical/list scope
  // always process down all if branches & lists
  // ~~~strip field ID metadata (for docx templates) since it no longer applies
  // ~~~ revised: leave it in so we know more about error location
  const copy = reduceContentArray(astBody)
  simplifyContentArray2(copy)
  simplifyContentArray3(copy)
  return copy
}
exports.buildLogicTree = buildLogicTree

// const reduceAst = function (ast) {

// }

/**
 * The result of calling compileExpr() is an instance of EvaluateExpression.
 * It is a curried function that (when called with a global and, optionally, local data context) will
 * return the result of evaluating the expression against that data context.
 *
 * The function also has a custom property called 'ast' containing the Abstract Syntax Tree for the parsed expression.
 *
 * @callback EvaluateExpression
 * @param {Object} s - the scope against which to evaluate the expression
 * @param {Object} l - the local object ("this") against which to evaluate the expression
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
const compileExpr = function (expr) {
  if (!expr) {
    throw new Error('Cannot compile empty or null expression')
  }
  if (expr === '.') expr = 'this'
  const cache = compileExpr.cache
  const cacheKey = expr
  let result = cache ? cache[cacheKey] : undefined
  if (!result) {
    try {
      result = expressions.compile(expr)
    } catch (e) {
      throw new SyntaxError(angularExpressionErrorMessage(e, expr))
    }
    // check if angular-expressions gave us back a cached copy that has already been fixed up!
    if (result.ast.body) { // if the AST still has "body" property (which we remove below), it has not yet been fixed
      // strip out the angular 'toWatch' array, etc., from the AST,
      // since I'm not entirely sure how to do anything useful with that stuff outside of Angular itself
      result.ast = reduceAstNode(result.ast.body[0].expression)
      // extend AST with enhanced nodes for filters
      let modified = fixFilters(result.ast)
      // normalize the expression
      const normalizedExpr = AST.serialize(result.ast)
      // change "this" to "$locals"
      const hasThis = thisTo$locals(result.ast)
      modified |= hasThis
      // recompile the expression if filter fixes changed its functionality
      if (modified) {
        const existingAst = result.ast
        result = expressions.compile(hasThis ? AST.serialize(existingAst) : normalizedExpr)
        result.ast = existingAst
      }
      // save the normalized expression as a property of the compiled expression
      result.normalized = normalizedExpr
      // fix problem with Angular AST -- reversal of terms 'consequent' and 'alternate' in conditionals
      fixConditionalExpressions(result.ast) // (it serializes/normalizes the same whether this has been run or not)
    }
    // cache the compiled expression under the original string
    if (cache) {
      cache[cacheKey] = result
    }
    // does it make any sense to also cache the compiled expression under the normalized string?
    // Maybe not, since you have to compile the expression in order to GET a normalized string...
  }
  return result
}
compileExpr.cache = {}
expressions.compile.cache = false // disable angular-expressions' own caching of compiled expressions (we cache instead)
exports.compileExpr = compileExpr

const angularExpressionErrorMessage = function (e, expr) {
  const errLines = e.message.split('\n')
  if (errLines[0].startsWith('[$parse:syntax]')) {
    const errUrl = new URL(errLines[1])
    const token = errUrl.searchParams.get('p0')
    const msg = errUrl.searchParams.get('p1')
    const position = errUrl.searchParams.get('p2')
    const expr = errUrl.searchParams.get('p3')
    return `Syntax Error: '${token}' ${msg}:\n${expr}\n${' '.repeat(position - 1) + '^'.repeat(token.length)}`
  }
  if (errLines[0].startsWith('[$parse:lexerr]')) {
    let msg = errLines[0].substr(15).trim()
    const errInfo = msg.match(/^(.+) +at columns (\d+).*?\[(.*?)\]/)
    const expr = msg.match(/in expression \[(.*)\].*?$/)[1]
    msg = errInfo[1].trim()
    const position = errInfo[2]
    const token = errInfo[3]
    return `${msg} '${token}':\n${expr}\n${' '.repeat(position) + '^'.repeat(token.length)}`
  }
  if (e.message.startsWith('Cannot read propert') && e.message.includes('$stateful')) {
    return 'Syntax Error: did you refer to a nonexistent filter?\n' + expr
  }
  return e.message
}

const parseContentItem = function (idx, contentArray, bIncludeExpressions = true, bIncludeListPunctuation = true) {
  const contentItem = contentArray[idx]
  const parsedItems = []
  if (Array.isArray(contentItem)) {
    // if there's a sub-array, that item must be its own valid sequence of fields
    // with appropriately matched ifs/endifs and/or lists/endlists
    const parsedBlockContent = parseContentArray(contentItem, bIncludeExpressions, bIncludeListPunctuation)
    Array.prototype.push.apply(parsedItems, parsedBlockContent)
  } else {
    const parsedContent = parseField(contentArray, idx, bIncludeExpressions, bIncludeListPunctuation)
    if (parsedContent !== null) {
      parsedItems.push(parsedContent)
    }
  }
  return parsedItems
}

const validateContentItem = function (idx, contentArray) {
  const contentItem = contentArray[idx]
  const parsedItems = []
  if (Array.isArray(contentItem)) {
    // if there's a sub-array, that item must be its own valid sequence of fields
    // with appropriately matched ifs/endifs and/or lists/endlists
    const parsedBlockContent = validateContentArray(contentItem)
    Array.prototype.push.apply(parsedItems, parsedBlockContent)
  } else {
    const parsedContent = validateField(contentArray, idx)
    if (parsedContent !== null) {
      parsedItems.push(parsedContent)
    }
  }
  return parsedItems
}

const parseField = function (contentArray, idx = 0, bIncludeExpressions = true, bIncludeListPunctuation = true) {
  const contentArrayItem = contentArray[idx]
  let content, fieldId
  if (typeof contentArrayItem === 'string') {
    if (contentArrayItem.length === 0) return null // empty string == ignore (== null)
    content = getFieldContent(contentArrayItem)
    if (content === null) return contentArrayItem // not a field means it's static text
    fieldId = void 0
  } else {
    // field object, e.g. extracted from DOCX
    content = contentArrayItem.content
    fieldId = contentArrayItem.id
  }

  if (content === null) { throw new Error(`Unrecognized field text: '${contentArrayItem}'`) }

  // parse the field
  let match, node
  if ((match = _ifRE.exec(content)) !== null) {
    node = createNode(OD.If, match[1], fieldId)
    if (bIncludeExpressions) parseFieldExpr(node)
    node.contentArray = parseContentUntilMatch(contentArray, idx + 1, OD.EndIf,
      fieldId, bIncludeExpressions, bIncludeListPunctuation)
  } else if ((match = _elseifRE.exec(content)) !== null) {
    node = createNode(OD.ElseIf, match[1], fieldId)
    if (bIncludeExpressions) parseFieldExpr(node)
    node.contentArray = []
  } else if (_elseRE.test(content)) {
    node = createNode(OD.Else, void 0, fieldId, [])
  } else if (_endifRE.test(content)) {
    node = createNode(OD.EndIf, void 0, fieldId)
  } else if ((match = _listRE.exec(content)) !== null) {
    node = createNode(OD.List, match[1], fieldId)
    if (bIncludeExpressions) {
      parseFieldExpr(node)
    }
    node.contentArray = parseContentUntilMatch(contentArray, idx + 1, OD.EndList,
      fieldId, bIncludeExpressions, bIncludeListPunctuation)
  } else if (_endlistRE.test(content)) {
    node = createNode(OD.EndList, void 0, fieldId)
  } else {
    node = createNode(OD.Content, content.trim(), fieldId)
    if (bIncludeExpressions) parseFieldExpr(node)
  }
  return node
}

const validateField = function (contentArray, idx = 0) {
  const node = contentArray[idx]
  if (typeof node === 'string') {
    if (node.length === 0) return null // empty string == ignore (== null)
    return node // it's static text
  }
  // otherwise it's a parsed field object
  if (node.type === OD.If) {
    node.contentArray = validateContentUntilMatch(contentArray, idx + 1, OD.EndIf, node.id)
  } else if (node.type === OD.ElseIf || node.type === OD.Else) {
    node.contentArray = []
  } else if (node.type === OD.List) {
    node.contentArray = validateContentUntilMatch(contentArray, idx + 1, OD.EndList, node.id)
  }
  return node
}

const parseFieldContent = function (content) {
  if (typeof content !== 'string') return null // error
  if (!content) return createNode(OD.Content, '')
  // parse the content
  let match, result
  if ((match = _ifRE.exec(content))) {
    result = createNode(OD.If, match[1])
  } else if ((match = _elseifRE.exec(content))) {
    result = createNode(OD.ElseIf, match[1])
  } else if ((match = _elseRE.exec(content))) {
    result = createNode(OD.Else)
    if (match[1]) result.comment = match[1]
  } else if ((match = _endifRE.exec(content))) {
    result = createNode(OD.EndIf)
    if (match[1]) result.comment = match[1]
  } else if ((match = _listRE.exec(content))) {
    result = createNode(OD.List, match[1])
  } else if ((match = _endlistRE.exec(content))) {
    result = createNode(OD.EndList)
    if (match[1]) result.comment = match[1]
  } else {
    result = createNode(OD.Content, content.trim())
  }
  return result
}
exports.parseFieldContent = parseFieldContent

const createNode = function (type, expr, id, contentArray) {
  const newNode = { type: type }
  if (typeof expr === 'string') newNode.expr = expr
  if (typeof id === 'string') newNode.id = id
  if (Array.isArray(contentArray)) newNode.contentArray = contentArray
  return newNode
}

const parseFieldExpr = function (fieldObj) {
  // fieldObj is an object with two properties:
  //   type (string): the field type
  //   expr (string): the expression within the field that wants to be parsed
  try {
    const compiledExpr = compileExpr(fieldObj.expr)
    fieldObj.expr = compiledExpr.normalized // normalize all expressions
  } catch (err) {
    if (fieldObj.id) {
      err.message = err.message + ' [in field ' + fieldObj.id + ']'
    }
    throw err
  }
}

const parseContentUntilMatch = function (
  contentArray, startIdx, targetType, originId, bIncludeExpressions, bIncludeListPunctuation
) {
  // parses WITHIN THE SAME CONTENT ARRAY (block) until it finds a field of the given targetType
  // returns a content array
  let idx = startIdx
  const result = []
  let parentContent = result
  let elseEncountered = false
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (idx >= contentArray.length) {
      // Field X's List/If has no matching EndList/EndIf
      const errMsg = `${originId ? `Field ${originId}'s` : 'The'} ${(targetType === OD.EndList) ? 'List' : 'If'
      } has no matching ${targetType}`
      throw new Error(errMsg)
    }
    const parsedContent = parseContentItem(idx, contentArray, bIncludeExpressions, bIncludeListPunctuation)
    const isObj = (parsedContent.length === 1 && typeof parsedContent[0] === 'object' && parsedContent[0] !== null)
    idx++
    if (isObj && parsedContent[0].type === targetType) {
      if (parsedContent[0].type === OD.EndList && bIncludeListPunctuation) {
        // future: possibly inject this only if we're in a list on which the "punc" filter was used
        // (because without the "punc" filter specifying list punctuation, this node will be a no-op)
        // However, that is a little more complicated than it might seem, because this
        // code operates in parallel with OpenDocx, which does the same thing (always inserting
        // a punctuation placeholder at the tail-end of every list) for DOCX templates.
        // See "puncElem" in OpenDocx.Templater\Templater.cs
        injectListPunctuationNode(parentContent, bIncludeExpressions)
      }
      parentContent.push(parsedContent[0])
      break
    }
    if (parsedContent) { parsedContent.forEach(pc => { if (pc) { parentContent.push(pc) } }) }
    if (isObj) {
      let errMsg
      switch (parsedContent[0].type) {
        case OD.ElseIf:
        case OD.Else:
          if (targetType === OD.EndIf) {
            if (elseEncountered) {
              // Encountered [field Y's|an] [Else/ElseIf] when expecting an EndIf (following [field X's|an] Else)
              errMsg = `Encountered ${
                parsedContent[0].id ? `field ${parsedContent[0].id}'s` : 'an'} ${
                parsedContent[0].type} (after ${originId ? `field ${originId}'s` : 'an'
              } Else) when expecting an EndIf`
            }
            if (parsedContent[0].type === OD.Else) { elseEncountered = true }
            if (!errMsg) { parentContent = parsedContent[0].contentArray }
          } else if (targetType === OD.EndList) {
            // Encountered [field Y's|an] [Else|ElseIf] when expecting [the end of field X's List|an EndList]
            errMsg = `Encountered ${
              parsedContent[0].id ? `field ${parsedContent[0].id}'s` : 'an'} ${
              parsedContent[0].type} when expecting ${originId
              ? `the end of field ${originId}'s List`
              : 'an EndList'}`
          }
          break
        case OD.EndIf:
        case OD.EndList:
          // Field X's EndIf/EndList has no matching If/List
          errMsg = `${parsedContent[0].id ? `Field ${parsedContent[0].id}'s` : 'The'} ${parsedContent[0].type
          } has no matching ${(parsedContent[0].type === OD.EndList) ? 'List' : 'If'}`
      }
      if (errMsg) {
        throw new Error(errMsg)
      }
    }
  }
  // remove (consume) all parsed items from the contentArray before returning
  contentArray.splice(startIdx, idx - startIdx)
  return result
}

const validateContentUntilMatch = function (contentArray, startIdx, targetType, originId) {
  // validates WITHIN THE SAME CONTENT ARRAY (block) until it finds a field of the given targetType
  // returns a content array
  let idx = startIdx
  const result = []
  let parentContent = result
  let elseEncountered = false
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (idx >= contentArray.length) {
      // Field X's List/If has no matching EndList/EndIf
      const errMsg = `${originId ? `Field ${originId}'s` : 'The'} ${(targetType === OD.EndList) ? 'List' : 'If'
      } has no matching ${targetType}`
      throw new Error(errMsg)
    }
    const parsedContent = validateContentItem(idx, contentArray)
    const isObj = (parsedContent.length === 1 && typeof parsedContent[0] === 'object' && parsedContent[0] !== null)
    idx++
    if (isObj && parsedContent[0].type === targetType) {
      if (parsedContent[0].type === OD.EndList) {
        // future: possibly inject this only if we're in a list on which the "punc" filter was used
        // (because without the "punc" filter specifying list punctuation, this node will be a no-op)
        // However, that is a little more complicated than it might seem, because this
        // code operates in parallel with OpenDocx, which does the same thing (always inserting
        // a punctuation placeholder at the tail-end of every list) for DOCX templates.
        // See "puncElem" in OpenDocx.Templater\Templater.cs
        injectListPunctuationNode(parentContent, false)
      }
      parentContent.push(parsedContent[0])
      break
    }
    if (parsedContent) { parsedContent.forEach(pc => { if (pc) { parentContent.push(pc) } }) }
    if (isObj) {
      let errMsg
      switch (parsedContent[0].type) {
        case OD.ElseIf:
        case OD.Else:
          if (targetType === OD.EndIf) {
            if (elseEncountered) {
              // Encountered [field Y's|an] [Else/ElseIf] when expecting an EndIf (following [field X's|an] Else)
              errMsg = `Encountered ${
                parsedContent[0].id ? `field ${parsedContent[0].id}'s` : 'an'} ${
                parsedContent[0].type} when expecting an EndIf (ElseIf cannot follow Else!)`
            }
            if (parsedContent[0].type === OD.Else) { elseEncountered = true }
            if (!errMsg) { parentContent = parsedContent[0].contentArray }
          } else if (targetType === OD.EndList) {
            // Encountered [field Y's|an] [Else|ElseIf] when expecting [the end of field X's List|an EndList]
            errMsg = `Encountered ${
              parsedContent[0].id ? `field ${parsedContent[0].id}'s` : 'an'} ${
              parsedContent[0].type} when expecting ${originId
              ? `the end of field ${originId}'s List`
              : 'an EndList'}`
          }
          break
        case OD.EndIf:
        case OD.EndList:
          // Field X's EndIf/EndList has no matching If/List
          errMsg = `${parsedContent[0].id ? `Field ${parsedContent[0].id}'s` : 'The'} ${parsedContent[0].type
          } has no matching ${(parsedContent[0].type === OD.EndList) ? 'List' : 'If'}`
      }
      if (errMsg) {
        throw new Error(errMsg)
      }
    }
  }
  // remove (consume) all parsed items from the contentArray before returning
  contentArray.splice(startIdx, idx - startIdx)
  return result
}

const injectListPunctuationNode = function (contentArray, bIncludeExpressions) {
  // synthesize list punctuation node
  const puncNode = createNode(OD.Content, '_punc', void 0)
  // id==undefined because there is not (yet) a corresponding field in the template
  if (bIncludeExpressions) parseFieldExpr(puncNode)
  // find last non-empty node in the list
  let i = contentArray.length - 1
  while (i >= 0 && (contentArray[i] === '' || contentArray[i] === null)) {
    i--
  }
  const priorNode = (i >= 0) ? contentArray[i] : null
  // if it's a text node, place the list punctuation node at its end but PRIOR to any line breaks;
  // otherwise just place the list punctuation at the end
  if (typeof priorNode === 'string') {
    let ix = priorNode.length - 1
    let bInsert = false
    while (ix >= 0 && '\r\n'.includes(priorNode[ix])) {
      bInsert = true
      ix--
    }
    if (bInsert) { // split text node and insert Content node
      const before = priorNode.slice(0, ix + 1)
      const after = priorNode.slice(ix + 1)
      if (before.length > 0) {
        contentArray[i] = before
        contentArray.splice(i + 1, 0, puncNode, after)
      } else {
        contentArray.splice(i, 1, puncNode, after)
      }
    } else {
      contentArray.push(puncNode)
    }
  } else {
    contentArray.push(puncNode)
  }
}

const _ifRE = /^(?:if\b|\?)\s*(.*)$/
const _elseifRE = /^(?:elseif\b|:\?)\s*(.*)$/
const _elseRE = /^(?:else\b|:)(.*)?$/
const _endifRE = /^(?:endif\b|\/\?)(?:.*)$/
const _listRE = /^(?:list\b|#)\s*(.*)$/
const _endlistRE = /^(?:endlist\b|\/#)(.*)$/
const _curlyquotes = /[“”]/g
const _zws = /[\u{200B}\u{200C}]/gu

const getFieldContent = function (text) {
  if (text.slice(0, 1) === '[' && text.slice(-1) === ']') {
    return text.slice(1, -1).replace(_curlyquotes, '"').replace(_zws, '')
  }
  return null
}

const reduceContentArray = function (astBody, newBody = null, scope = null, parentScope = null) {
  // prune plain text nodes (non-dynamic, so they don't affect logic)
  // prune EndIf and EndList nodes (only important insofar as we need to match up nodes to fields --
  //   which will not be the case with a reduced logic tree)
  // prune redundant Content nodes that are already defined in the same logical & list scope
  // always process down all if branches & lists
  //    but mark check whether each if expression is the first (in its scope) to refer to the expression,
  //    and if so, indicate it on the node
  // future: compare logical & list scopes of each item, and eliminate logical branches
  //    and list iterations that are redundant
  if (newBody === null) newBody = []
  if (scope === null) scope = {}
  for (const obj of astBody) {
    const newObj = reduceContentNode(obj, scope, parentScope)
    if (newObj !== null) {
      newBody.push(newObj)
    }
  }
  return newBody
}

const reduceContentNode = function (astNode, scope, parentScope = null) {
  if (typeof astNode === 'string') return null // plain text node -- boilerplate content in a text template
  if (astNode.type === OD.EndList) {
    // can we find the matching List field, to set its .endid = astNode.id before returning?
    return null
  }
  if (astNode.type === OD.EndIf) {
    // can we find the initial matching If field (not ElseIf or Else), to set its .endid = astNode.id before returning?
    return null
  }
  if (astNode.type === OD.Content) {
    if (!astNode.id && astNode.expr === '_punc') { // _punc nodes do not affect logic!
      return null
    }
    const existing = scope[astNode.expr]
    if (existing) { // expression already defined in this scope
      if (astNode.id && typeof existing === 'object') {
        const idd = existing.idd || (existing.idd = [])
        idd.push(astNode.id)
      }
      return null
    }
    const { /* id, */ ...copyOfNode } = astNode // stopped stripping field id
    scope[astNode.expr] = copyOfNode
    return copyOfNode
  }
  if (astNode.type === OD.List) {
    const existing = scope[astNode.expr]
    if (existing) {
      // this list has already been added to the parent scope; revisit it to add more content members if necessary
      reduceContentArray(astNode.contentArray, existing.contentArray, existing.scope)
      if (astNode.id) {
        const idd = existing.idd || (existing.idd = [])
        idd.push(astNode.id)
      }
      return null
    } else {
      const { /* id, */ contentArray, ...copyOfNode } = astNode // stopped stripping the id
      copyOfNode.scope = {} // fresh new wholly separate scope for lists
      copyOfNode.contentArray = reduceContentArray(contentArray, null, copyOfNode.scope)
      scope[astNode.expr] = copyOfNode // set BEFORE recursion for consistent results?  (or is it intentionally after?)
      return copyOfNode
    }
  }
  if (astNode.type === OD.If || astNode.type === OD.ElseIf || astNode.type === OD.Else) {
    // if's are always left in at this point (because of their importance to the logic;
    // a lot more work would be required to accurately optimize them out.)
    // HOWEVER, we can't add the expr to the parent scope by virtue of it having been referenced in a condition,
    // because it means something different for the same expression to be evaluated
    // in a Content node vs. an If/ElseIf node, and therefore an expression emitted/evaluated as part of a condition
    // still needs to be emitted/evaluated as part of a merge/content node.
    // AND VICE VERSA: an expression emitted as part of a content node STILL needs to be emitted as part of a condition,
    // too.

    const { /* id, */ contentArray, ...copyOfNode } = astNode // stopped stripping the id
    // this 'parentScope' thing is a bit tricky.  The parentScope argument is only supplied
    // when we're inside an If/ElseIf/Else block within the current scope.
    // If supplied, it INDIRECTLY refers to the actual scope -- basically, successive layers of "if" blocks
    // that each establish a new "mini" scope, that has the parent scope as its prototype.
    // This means, a reference to an identifier in a parent scope, will prevent that identifier from
    // subsequently appearing (redundantly) in a child; but a reference to an identifier in a child scope,
    // must NOT prevent that identifier from appearing subsequently in a parent scope.
    const pscope = (parentScope != null) ? parentScope : scope
    if (copyOfNode.type === OD.If || copyOfNode.type === OD.ElseIf) {
      if (!(('if$' + astNode.expr) in pscope)) {
        pscope['if$' + astNode.expr] = copyOfNode
      }
    }
    const childContext = Object.create(pscope)
    copyOfNode.contentArray = reduceContentArray(contentArray, null, childContext, pscope)
    return copyOfNode
  }
}

const simplifyContentArray2 = function (astBody) {
  // 2nd pass at simplifying logic
  // for now, just clean up scope helpers leftover from first pass
  for (const obj of astBody) {
    simplifyNode2(obj)
  }
}

const simplifyNode2 = function (astNode) {
  if (astNode.scope) { delete astNode.scope }
  if (Array.isArray(astNode.contentArray)) { simplifyContentArray2(astNode.contentArray) }
}

const simplifyContentArray3 = function (body, scope = {}) {
  // 3rd pass at simplifying scopes
  const initialScope = { ...scope } // shallow-clone the scope to start with
  // first go through content fields
  let i = 0
  while (i < body.length) {
    const field = body[i]
    let nodeRemoved = false
    if (field.type === OD.Content) {
      if (field.expr in scope) {
        if (field.id) {
          const existing = scope[field.expr]
          const idd = existing.idd || (existing.idd = [])
          idd.push(field.id)
        }
        body.splice(i, 1)
        nodeRemoved = true
      } else {
        scope[field.expr] = field
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
        scope[field.expr] = field
      }
      simplifyContentArray3(field.contentArray, {}) // new scope for lists
    } else if (field.type === OD.If) {
      // the content in an if block has everything in its parent scope
      simplifyContentArray3(field.contentArray, { ...scope }) // copy the parent scope
    } else if (field.type === OD.ElseIf || field.type === OD.Else) {
      // elseif and else fields are (in the logic tree) children of ifs,
      // but they do NOT have access to the parent scope, reset to initial scope for if
      simplifyContentArray3(field.contentArray, { ...initialScope })
    }
  }
  // note: although this will eliminate some redundant fields, it will not eliminate all of them.
  // A partial rewrite is planned to implement a new, more straight-forward approach.
}

const reduceAstNode = function (astNode) {
  // prune endlessly recursive property
  // eslint-disable-next-line no-unused-vars
  const { toWatch, watchId, ...simplified } = astNode
  for (const prop in simplified) {
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
        simplified[prop] = reduceAstNode(simplified[prop])
        break
      case 'arguments':
      case 'elements':
      case 'properties': {
        // recurse into nodes containing arrays of items that can contain expressions
        const thisArray = simplified[prop]
        if (thisArray && thisArray.length > 0) {
          for (let i = 0; i < thisArray.length; i++) {
            thisArray[i] = reduceAstNode(thisArray[i])
          }
        }
        break
      }
      default:
                // should not need to do anything else
    }
  }
  return simplified
}

/**
 * Recursively processes the given AST node to determine if it contains any conditional expressions, and if it does,
 * it reverses the "alternate" and "consequent" properties to conform to the generally-understood meanings
 * of those terms, for consistency and compatibility with other AST node types (IfStatements in particular).
 * See:
 *      https://github.com/estree/estree/blob/master/es5.md#conditionalexpression
 *          ... which does not say what is what, but gives the wrong idea by its ordering of the properties, and
 *      https://github.com/estree/estree/blob/master/es5.md#ifstatement
 *          ... which makes it clear that "consequent" is the "then", while "alternate" is the "else"
 *          (by virtue of it being optional)

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
        const swap = node.alternate
        node.alternate = node.consequent
        node.consequent = swap
        node.fixed = true
        return true // made a change
      }
    }
    return false // nothing changed
  })
}

/**
 * Recursively processes the given AST node to determine if it contains any "filters",
 * either typical angular-type filters or yatte list filters.
 * If it does, it modifies the AST to more explicitly and naturally represent these filters.
 *
 * Note: if this function makes changes, it modifies the given ast *in place*. The return value indicates whether
 *       or not changes were made.
 *
 * @param {object} astNode
 * @returns {boolean} true means the AST was modified in such a way as to materially change how the expression
 * should be evaluated; false means the AST may or may not have been modified, but it should not require
 * re-compilation by angular-expressions.
 */
const fixFilters = function (astNode) {
  return astMutateInPlace(astNode, node => {
    if (node.type === AST.CallExpression && node.filter) {
      const modified = convertCallNodeToFilterNode(node)
      if (modified && node.rtl) {
        const newNode = getRTLFilterChain(node)
        if (newNode !== node) {
          node.input = newNode.input
          node.filter = newNode.filter
          node.arguments = newNode.arguments
        }
      }
      return modified
    }
    return false
  })
}

/**
 * Given a chain of one or more filter nodes that are supposed to have right-to-left associativity, but
 * which have been initially parsed (as all filter nodes are by angular-expressions) as left-to-right,
 * reverse the order/structure of the nodes in the chain, and return the node at the beginning of the chain.
 */
const getRTLFilterChain = function (node, innerNode = undefined) {
  // check if its input is also a filter, and if so, recurse / transform AST to reflect correct associativity
  const inputNode = node.input
  if (inputNode.type === AST.CallExpression && inputNode.filter) {
    convertCallNodeToFilterNode(inputNode)
    if (inputNode.rtl) {
      const newInnerNode = {
        type: AST.ListFilterExpression,
        rtl: true,
        input: inputNode.arguments[0],
        filter: node.filter,
        arguments: innerNode ? [innerNode] : node.arguments,
        constant: inputNode.arguments[0].constant && (innerNode ? innerNode.constant : node.arguments[0].constant)
      }
      return getRTLFilterChain(inputNode, newInnerNode)
    }
  }
  // else
  if (innerNode) {
    node.arguments = [innerNode]
  }
  return node
}

const convertCallNodeToFilterNode = function (node) {
  node.filter = node.callee
  delete node.callee
  node.input = node.arguments.shift()
  const filterFunc = expressions.filters[node.filter.name]
  if (filterFunc && filterFunc.arrayFilter) {
    node.type = AST.ListFilterExpression
    // resolve aliases
    if (node.filter.name === 'some') { // alias for 'any'
      node.filter.name = 'any'
    } else if (node.filter.name === 'all') { // alias for 'every'
      node.filter.name = 'every'
    }
    node.rtl = filterFunc.rtlFilter || false
    if (filterFunc.immediateArgs) {
      node.immediateArgs = filterFunc.immediateArgs
    }
    if (isNormalizedListFilterNode(node)) {
      // the node is a list filter that had formerly been normalized
      //   -- re-parse the string argument into the original AST
      // node.arguments.shift() // discard AST's extra "this" (added during normalization) UPDATE: no longer added
      const parsedArg = compileExpr(unEscapeQuotes(node.arguments[0].value))
      node.arguments[0] = parsedArg.ast
      return false // existing compiled behavior was already based on the normalized form,
      // so return false to avoid recompilation (which would only be redundant)
    } else {
      // the node is a list filter that is just now being parsed & fixed up
      return true
      // returning true means after we're done mutating the AST, we'll re-serialize
      // to get the normalized form, and then recompile THAT with angular-expressions
    }
  } else {
    node.type = AST.AngularFilterExpression
    return false
  }
}

/**
 * Recursively processes the given AST node to convert any and all nodes representing the "this" token,
 * to the "$locals" token instead
 *
 * Note: if this function makes changes, it modifies the given ast *in place*. The return value indicates whether
 *       or not changes were made.
 *
 * @param {object} astNode
 * @returns {boolean} whether or not the AST was modified
 */
const thisTo$locals = function (astNode) {
  return astMutateInPlace(astNode, node => {
    if (node.type === AST.ThisExpression) {
      node.type = AST.LocalsExpression
      return true
    }
    return false
  })
}

function isNormalizedListFilterNode (node) {
  if (!node || node.type !== AST.ListFilterExpression) return false
  const args = node.arguments
  if (
    args.length > 0 /* 1 */ &&
    // args[0].type === AST.ThisExpression &&
    args[0/* 1 */].type === AST.Literal
  ) {
    if (args.length !== 1 /* 2 */ && node.filter.name !== 'sort' && node.filter.name !== 'reduce') {
      console.log(`Warning: ListFilterExpression with multiple arguments: ${AST.serialize(node)}`)
    }
    return true
  }
  return false
}
