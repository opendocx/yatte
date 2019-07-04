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
    '/': 12,
}
  
// Enables parenthesis regardless of precedence
const NEEDS_PARENTHESES = 17
  
const EXPRESSIONS_PRECEDENCE = {
    // Definitions
    ArrayExpression: 20,
    ThisExpression: 20,
    Identifier: 20,
    Literal: 18,
    // Operations
    MemberExpression: 19,
    CallExpression: 19,
    // Other definitions
    ObjectExpression: NEEDS_PARENTHESES,
    // Other operations
    UnaryExpression: 15,
    BinaryExpression: 14,
    LogicalExpression: 13,
    ConditionalExpression: 4,
    AngularFilterCallExpression: 1,
}

function getExpressionPrecedence(node) {
    if (node.type === 'CallExpression' && node.filter) {
        return EXPRESSIONS_PRECEDENCE.AngularFilterCallExpression
    } // else
    return EXPRESSIONS_PRECEDENCE[node.type]
}

function expressionNeedsParentheses(node, parentNode, isRightHand) {
    const nodePrecedence = getExpressionPrecedence(node)
    if (nodePrecedence === NEEDS_PARENTHESES) {
      return true
    }
    const parentNodePrecedence = getExpressionPrecedence(parentNode)
    if (nodePrecedence !== parentNodePrecedence) {
      // Different node types
      return nodePrecedence < parentNodePrecedence
    }
    if (nodePrecedence !== 13 && nodePrecedence !== 14) {
      // Not a `LogicalExpression` or `BinaryExpression`
      return false
    }
    if (isRightHand) {
      // Parenthesis are used if both operators have the same precedence
      return ( OPERATOR_PRECEDENCE[node.operator] <= OPERATOR_PRECEDENCE[parentNode.operator] )
    }
    return ( OPERATOR_PRECEDENCE[node.operator] < OPERATOR_PRECEDENCE[parentNode.operator] )
}

function serializeOptionallyWrapped(node, maxPrecedence, orEqual = false) {
    const wrap = orEqual ? (getExpressionPrecedence(node) <= maxPrecedence) : (getExpressionPrecedence(node) < maxPrecedence)
    return wrap ? ('(' + serializeAstNode(node) + ')') : serializeAstNode(node)
}

function serializeBinaryExpressionPart(node, parentNode, isRightHand) {
    /*
    serializes a left-hand or right-hand expression `node`
    from a binary expression applying the provided `operator`.
    The `isRightHand` parameter should be `true` if the `node` is a right-hand argument.
    */
    if (expressionNeedsParentheses(node, parentNode, isRightHand)) {
        return '(' + serializeAstNode(node) + ')'
    } else {
        return serializeAstNode(node)
    }
}

const serializeAstNode = function(astNode) {
    switch(astNode.type) {
        case 'Program':
            return astNode.body.map(statement => serializeAstNode(statement)).join('\n');
        case 'ExpressionStatement':
            return serializeAstNode(astNode.expression);
        case 'Literal':
            if (typeof astNode.value == 'string')
                return '"' + astNode.value + '"';
            return astNode.value.toString();
        case 'Identifier':
            return astNode.name;
        case 'MemberExpression':
            return serializeOptionallyWrapped(astNode.object, EXPRESSIONS_PRECEDENCE.MemberExpression)
                + (astNode.computed ? ('[' + serializeAstNode(astNode.property) + ']') : ('.' + serializeAstNode(astNode.property)));
        case 'CallExpression':
            let str;
            if (astNode.filter) {
                str = serializeOptionallyWrapped(astNode.arguments[0], EXPRESSIONS_PRECEDENCE.AngularFilterCallExpression, true)
                        + '|' + serializeAstNode(astNode.callee);
                for (let i = 1; i < astNode.arguments.length; i++) {
                    str += ':' + serializeOptionallyWrapped(astNode.arguments[i], EXPRESSIONS_PRECEDENCE.AngularFilterCallExpression, true)
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
            return (astNode.computed ? '[' : '') + serializeAstNode(astNode.key) + (astNode.computed ? ']' : '') + ':' + serializeAstNode(astNode.value);
        case 'BinaryExpression':
        case 'LogicalExpression':
            return serializeBinaryExpressionPart(astNode.left, astNode, false) + astNode.operator + serializeBinaryExpressionPart(astNode.right, astNode, true);
        case 'UnaryExpression':
            return astNode.prefix
                    ? astNode.operator + serializeOptionallyWrapped(astNode.argument, EXPRESSIONS_PRECEDENCE.UnaryExpression)
                    : serializeAstNode(astNode.argument) + astNode.operator;
        case 'ConditionalExpression':
            // angular expression parsing has alternate and consequent reversed from their standard meanings!
            // so serialize according to whether it's been fixed or not
            return serializeOptionallyWrapped(astNode.test, EXPRESSIONS_PRECEDENCE.ConditionalExpression, true)
                    + '?' + serializeOptionallyWrapped(astNode.fixed ? astNode.consequent : astNode.alternate, EXPRESSIONS_PRECEDENCE.ConditionalExpression)
                    + ':' + serializeAstNode(astNode.fixed ? astNode.alternate : astNode.consequent);
        case 'ThisExpression':
            return 'this';
        default:
            throw new Error('Unsupported expression type')
    }
}
exports.serializeAstNode = serializeAstNode;
