'use strict'

const Scope = require('./scope')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class TextEvaluator {
  constructor (scope, locals = null) {
    this.scopePushed = this.localsPushed = false
    if (scope) {
      this.contextStack = scope.__target
        || (scope instanceof Scope ? scope : (this.scopePushed = true) && Scope.pushObject(scope))
    }
    if (locals) {
      if (locals.__target || (locals instanceof Scope)) throw new Error('Scope stack cannot be provided as locals')
      this.contextStack = Scope.pushObject(locals, this.contextStack)
      this.localsPushed = true
    }
  }

  assemble (contentArray) {
    const text = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack)).join('')
    // now pop whatever was pushed (and nothing more)
    if (this.localsPushed) {
      this.contextStack = Scope.pop(this.contextStack)
    }
    if (this.scopePushed) {
      this.contextStack = Scope.pop(this.contextStack)
    }
    return text
  }
}
module.exports = TextEvaluator

function ContentReplacementTransform (contentItem, contextStack) {
  if (!contentItem) { return '' }
  if (typeof contentItem === 'string') { return contentItem }
  if (typeof contentItem !== 'object') { throw new Error(`Unexpected content '${contentItem}'`) }
  const frame = contextStack // .peek()
  switch (contentItem.type) {
    case OD.Content:
      try {
        const evaluator = base.compileExpr(contentItem.expr) // these are cached so this should be fast
        let value = frame._evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
        if (value === null || typeof value === 'undefined') {
          value = '[' + contentItem.expr + ']' // missing value placeholder
        }
        return value
      } catch (err) {
        return CreateContextErrorMessage('EvaluationException: ' + err.message)
      }
    case OD.List: {
      let iterable
      try {
        const evaluator = base.compileExpr(contentItem.expr) // these are cached so this should be fast
        iterable = frame._evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
      } catch (err) {
        return CreateContextErrorMessage('EvaluationException: ' + err.message)
      }
      contextStack = Scope.pushList(iterable, contextStack, contentItem.expr) // const indices = contextStack.pushList(contentItem.expr, iterable)
      const allContent = contextStack._indices.map(index => {
        contextStack = Scope.pushListItem(index, contextStack, 'o' + index) // contextStack.pushObject('o' + index, index)
        const listItemContent = contentItem.contentArray.map(listContentItem => ContentReplacementTransform(listContentItem, contextStack))
        contextStack = Scope.pop(contextStack) // contextStack.popObject()
        return listItemContent.join('')
      })
      contextStack = Scope.pop(contextStack) // contextStack.popList()
      return allContent.join('')
    }
    case OD.If:
    case OD.ElseIf: {
      let bValue
      try {
        if (frame._scopeType != Scope.OBJECT) {
          throw new Error(`Internal error: cannot define a condition directly in a ${frame._scopeType} context`)
        }
        const evaluator = base.compileExpr(contentItem.expr) // these are cached so this should be fast
        const value = frame._evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
        bValue = Scope.isTruthy(value)
      } catch (err) {
        return CreateContextErrorMessage('EvaluationException: ' + err.message)
      }
      if (bValue) {
        const content = contentItem.contentArray
          .filter(item => (typeof item !== 'object') || (item == null) || (item.type != OD.ElseIf && item.type != OD.Else))
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return content.join('')
      }
      const elseCond = contentItem.contentArray.find(item => (typeof item === 'object' && item != null && (item.type == OD.ElseIf || item.type == OD.Else)))
      if (elseCond) {
        if (elseCond.type == OD.ElseIf) { return ContentReplacementTransform(elseCond, contextStack) }
        // else
        const content = elseCond.contentArray
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return content.join('')
      }
      return ''
    }
  }
}

function CreateContextErrorMessage (message) {
  return '*** ' + message + ' ***'
}
