// These node types are a subset of those defined in the ESTree specification.
// For the meaning and specific properties of each type of node, see
// https://github.com/estree/estree/blob/master/es5.md

const AST = {
  Identifier: 'Identifier',
  Literal: 'Literal',
  Program: 'Program',
  ExpressionStatement: 'ExpressionStatement',
  BlockStatement: 'BlockStatement',
  EmptyStatement: 'EmptyStatement',
  IfStatement: 'IfStatement',
  ForOfStatement: 'ForOfStatement',
  ThisExpression: 'ThisExpression',
  ArrayExpression: 'ArrayExpression',
  ObjectExpression: 'ObjectExpression',
  Property: 'Property',
  UnaryExpression: 'UnaryExpression',
  BinaryExpression: 'BinaryExpression',
  LogicalExpression: 'LogicalExpression',
  MemberExpression: 'MemberExpression',
  ConditionalExpression: 'ConditionalExpression',
  CallExpression: 'CallExpression',
  // also includes some custom/proprietary node types:
  LocalsExpression: 'LocalsExpression', // from angular-expressions:
  //   like 'ThisExpression', but for the local scope (Angular equates "this" to the broader evaluation "scope")
  AngularFilterExpression: 'AngularFilterExpression',
  //   properties: input (node), filter (ident), arguments (node array)
  ListFilterExpression: 'ListFilterExpression',
  //   properties: input (node), filter (ident), arguments (node array), rtl (bool)
  // also includes a utility method:
  serialize: serializeAstNode
}
exports.AST = AST

// Some serialization logic adapted from AString
// https://github.com/davidbonnet/astring/blob/master/src/astring.js

const OPERATOR_PRECEDENCE = {
  '||': 3,
  '&&': 4,
  '==': 8,
  '!=': 8,
  '===': 8,
  '!==': 8,
  '<': 9,
  '>': 9,
  '<=': 9,
  '>=': 9,
  '+': 11,
  '-': 11,
  '*': 12,
  '%': 12,
  '/': 12
}

// Enables parenthesis regardless of precedence
const NEEDS_PARENTHESES = 18

const EXPRESSIONS_PRECEDENCE = {
  // Definitions
  [AST.ArrayExpression]: 21,
  [AST.ThisExpression]: 21,
  [AST.LocalsExpression]: 21,
  [AST.Identifier]: 21,
  // Operations
  [AST.MemberExpression]: 20,
  [AST.CallExpression]: 20,
  // Other definitions
  [AST.Literal]: 19,
  [AST.ObjectExpression]: NEEDS_PARENTHESES,
  // Other operations
  [AST.UnaryExpression]: 17,
  [AST.BinaryExpression]: 14,
  [AST.LogicalExpression]: 12,
  [AST.ConditionalExpression]: 4,
  CommaOrSequence: 1,
  [AST.Property]: 1,
  [AST.AngularFilterExpression]: 0,
  [AST.ListFilterExpression]: 0
}

exports.astMutateInPlace = astMutateInPlace
function astMutateInPlace (node, mutator) {
  var nodeModified = mutator(node)
  switch (node.type) {
    case AST.Program:
      return nodeModified | node.body.reduce(
        (accumulator, statementObj) => (accumulator |= astMutateInPlace(statementObj, mutator)),
        false
      )
    case AST.ExpressionStatement:
      return nodeModified | astMutateInPlace(node.expression, mutator)
    case AST.Literal:
    case AST.Identifier:
    case AST.ThisExpression:
    case AST.LocalsExpression:
      return nodeModified
    case AST.MemberExpression:
      return nodeModified | astMutateInPlace(node.object, mutator) | astMutateInPlace(node.property, mutator)
    case AST.CallExpression:
      return nodeModified | astMutateInPlace(node.callee, mutator) | node.arguments.reduce(
        (accumulator, argObj) => (accumulator |= astMutateInPlace(argObj, mutator)),
        false
      )
    case AST.AngularFilterExpression:
    case AST.ListFilterExpression:
      return nodeModified | astMutateInPlace(node.filter, mutator)
        | astMutateInPlace(node.input, mutator) | node.arguments.reduce(
        (accumulator, argObj) => (accumulator |= astMutateInPlace(argObj, mutator)),
        false
      )
    case AST.ArrayExpression:
      return nodeModified | node.elements.reduce(
        (accumulator, elem) => (accumulator |= astMutateInPlace(elem, mutator)),
        false
      )
    case AST.ObjectExpression:
      return nodeModified | node.properties.reduce(
        (accumulator, prop) => (accumulator |= astMutateInPlace(prop, mutator)),
        false
      )
    case AST.Property:
      return nodeModified | astMutateInPlace(node.key, mutator) | astMutateInPlace(node.value, mutator)
    case AST.BinaryExpression:
    case AST.LogicalExpression:
      return nodeModified | astMutateInPlace(node.left, mutator) | astMutateInPlace(node.right, mutator)
    case AST.UnaryExpression:
      return nodeModified | astMutateInPlace(node.argument, mutator)
    case AST.ConditionalExpression:
      return nodeModified | astMutateInPlace(node.test, mutator) | astMutateInPlace(node.consequent, mutator)
        | astMutateInPlace(node.alternate, mutator)
    default:
      return false
  }
}

function getExpressionPrecedence (node) {
  if (node.type === AST.CallExpression && node.filter) {
    return EXPRESSIONS_PRECEDENCE[AST.AngularFilterExpression]
  } // else
  return EXPRESSIONS_PRECEDENCE[node.type]
}

function expressionNeedsParentheses (node, parentNode, isRightHand) {
  const nodePrecedence = getExpressionPrecedence(node)
  if (nodePrecedence === NEEDS_PARENTHESES) {
    return true
  }
  const parentNodePrecedence = getExpressionPrecedence(parentNode)
  if (nodePrecedence !== parentNodePrecedence) {
    // Different node types
    return nodePrecedence < parentNodePrecedence
  }
  if (nodePrecedence !== EXPRESSIONS_PRECEDENCE.LogicalExpression
    && nodePrecedence !== EXPRESSIONS_PRECEDENCE.BinaryExpression) {
    return false
  }
  if (isRightHand) {
    // Parenthesis are used if both operators have the same precedence
    return (OPERATOR_PRECEDENCE[node.operator] <= OPERATOR_PRECEDENCE[parentNode.operator])
  }
  return (OPERATOR_PRECEDENCE[node.operator] < OPERATOR_PRECEDENCE[parentNode.operator])
}

function serializeOptionallyWrapped (node, subs, maxPrecedence, orEqual = false) {
  const wrap = orEqual
    ? (getExpressionPrecedence(node) <= maxPrecedence)
    : (getExpressionPrecedence(node) < maxPrecedence)
  return wrap ? ('(' + serializeAstNode(node, subs) + ')') : serializeAstNode(node, subs)
}

function serializeBinaryExpressionPart (node, parentNode, isRightHand, subs) {
  /*
    serializes a left-hand or right-hand expression `node`
    from a binary expression applying the provided `operator`.
    The `isRightHand` parameter should be `true` if the `node` is a right-hand argument.
    */
  if (expressionNeedsParentheses(node, parentNode, isRightHand)) {
    return '(' + serializeAstNode(node, subs) + ')'
  } else {
    return serializeAstNode(node, subs)
  }
}

function serializeAstNode (astNode, subs = false) {
  switch (astNode.type) {
    case AST.Program:
      return astNode.body.map(statement => serializeAstNode(statement, subs)).join('\n')
    case AST.ExpressionStatement:
      return serializeAstNode(astNode.expression, subs)
    case AST.Literal:
      if (typeof astNode.value === 'string') { return '"' + astNode.value + '"' }
      if (astNode.value === null) { return 'null' }
      return astNode.value.toString()
    case AST.Identifier:
      return astNode.name
    case AST.MemberExpression:
      return serializeOptionallyWrapped(astNode.object, subs, EXPRESSIONS_PRECEDENCE.MemberExpression) + (
        astNode.computed
          ? ('[' + serializeAstNode(astNode.property, subs) + ']')
          : ('.' + serializeAstNode(astNode.property, subs))
      )
    case AST.CallExpression: {
      let str
      if (astNode.filter) {
        str = serializeOptionallyWrapped(astNode.arguments[0], subs,
          EXPRESSIONS_PRECEDENCE[AST.AngularFilterExpression], true)
          + '|' + serializeAstNode(astNode.callee, subs)
        for (let i = 1; i < astNode.arguments.length; i++) {
          str += ':' + serializeOptionallyWrapped(astNode.arguments[i], subs,
            EXPRESSIONS_PRECEDENCE[AST.AngularFilterExpression], true)
        }
      } else {
        str = serializeAstNode(astNode.callee, subs) + '('
          + astNode.arguments.map(
            argObj => serializeOptionallyWrapped(argObj, subs, EXPRESSIONS_PRECEDENCE.CommaOrSequence)
          ).join(',') + ')'
      }
      return str
    }
    case AST.AngularFilterExpression:
      return (
        serializeOptionallyWrapped(astNode.input, subs, EXPRESSIONS_PRECEDENCE.AngularFilterExpression)
        + '|' + serializeAstNode(astNode.filter, subs)
        + astNode.arguments.map(arg =>
          ':' + serializeOptionallyWrapped(arg, subs, EXPRESSIONS_PRECEDENCE.AngularFilterExpression)
        ).join('')
      )
    case AST.ListFilterExpression:
      return serializeOptionallyWrapped(astNode.input, subs, EXPRESSIONS_PRECEDENCE.ListFilterExpression, astNode.rtl)
        + '|' + serializeAstNode(astNode.filter, subs) // + ':this' // starting with yatte 1.2 beta 5, this is obsolete
        + astNode.arguments.map(
          (arg, i) => {
            if (subs) {
              if (arg.type === AST.Literal && typeof arg.value === 'string') {
                return `:${astNode.value}??ERR??`
              } else {
                return `:${serializeAstNode(arg, subs)}`
              }
            } else {
              return (
                astNode.immediateArgs && astNode.immediateArgs.includes(i)
                  ? `:${serializeAstNode(arg, subs)}`
                  : `:"${escapeQuotes(serializeAstNode(arg, subs))}"`
              )
            }
          }).join('')
    case AST.ArrayExpression:
      return '[' + astNode.elements.map(
        elem => serializeOptionallyWrapped(elem, subs, EXPRESSIONS_PRECEDENCE.CommaOrSequence)
      ).join(',') + ']'
    case AST.ObjectExpression:
      return '{' + astNode.properties.map(prop => serializeAstNode(prop, subs)).join(',') + '}'
    case AST.Property:
      return (astNode.computed ? '[' : '') + serializeAstNode(astNode.key, subs)
        + (astNode.computed ? ']' : '') + ':'
        + serializeOptionallyWrapped(astNode.value, subs, EXPRESSIONS_PRECEDENCE.Property)
    case AST.BinaryExpression:
    case AST.LogicalExpression:
      return serializeBinaryExpressionPart(astNode.left, astNode, false, subs)
        + astNode.operator + serializeBinaryExpressionPart(astNode.right, astNode, true, subs)
    case AST.UnaryExpression:
      return astNode.prefix
        ? astNode.operator + serializeOptionallyWrapped(astNode.argument, subs, EXPRESSIONS_PRECEDENCE.UnaryExpression)
        : serializeAstNode(astNode.argument, subs) + astNode.operator
    case AST.ConditionalExpression:
      // angular expression parsing has alternate and consequent reversed from their standard meanings!
      // so serialize according to whether it's been fixed or not
      return (
        serializeOptionallyWrapped(astNode.test, subs, EXPRESSIONS_PRECEDENCE.ConditionalExpression, true)
        + '?' + serializeOptionallyWrapped(
          astNode.fixed ? astNode.consequent : astNode.alternate,
          subs,
          EXPRESSIONS_PRECEDENCE.ConditionalExpression
        ) + ':' + serializeOptionallyWrapped(
          astNode.fixed ? astNode.alternate : astNode.consequent,
          subs,
          EXPRESSIONS_PRECEDENCE.ConditionalExpression
        )
      )
    case AST.ThisExpression:
      return 'this'
    case AST.LocalsExpression:
      return /* subs ? '' : */ '$locals'
    default:
      throw new Error(`Unsupported expression type '${astNode.type}'`)
  }
}

exports.escapeQuotes = escapeQuotes
function escapeQuotes (str) {
  // include ampersands so escaping is nestable AND reversable when nested
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

exports.unEscapeQuotes = unEscapeQuotes
function unEscapeQuotes (str) {
  return str.replace(/&apos;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}
