'use strict'

const Scope = require('./scope')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class MetaEvaluator {
  constructor (context, locals = null) {
    if (context) {
      this.contextStack = Scope.pushObject(context)
    }
    if (locals) {
      this.contextStack = Scope.pushObject(locals, this.contextStack)
    }
  }

  assemble (contentArray) {
    const result = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack))
    this.contextStack = Scope.pop(this.contextStack)
    return FlatSingle(result)
  }
}
module.exports = MetaEvaluator

function ContentReplacementTransform (contentItem, contextStack) {
  if (!contentItem || (typeof contentItem === 'string')) { return }
  if (typeof contentItem !== 'object') { throw new Error(`Unexpected content '${contentItem}'`) }
  const frame = contextStack // .peek()
  switch (contentItem.type) {
    case OD.Content:
      try {
        const evaluator = base.compileExpr(contentItem.expr)
        return frame._deferredEvaluation(evaluator)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }

    case OD.List: {
      let iterable
      try {
        const evaluator = base.compileExpr(contentItem.expr)
        iterable = frame._evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }
      contextStack = Scope.pushList(iterable, contextStack, contentItem.expr)
      const allContent = contextStack._indices.map(index => {
        contextStack = Scope.pushListItem(index, contextStack, 'o' + index)
        const listItemContent = contentItem.contentArray.map(listContentItem => ContentReplacementTransform(listContentItem, contextStack))
        contextStack = Scope.pop(contextStack)
        return FlatSingle(listItemContent)
      })
      contextStack = Scope.pop(contextStack)
      return FlatSingle(allContent)
    }

    case OD.If:
    case OD.ElseIf: {
      let bValue
      try {
        if (frame._scopeType != Scope.OBJECT) {
          throw new Error(`Internal error: cannot define a condition directly in a ${frame._scopeType} context`)
        }
        const evaluator = base.compileExpr(contentItem.expr)
        const value = frame._evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
        bValue = Scope.isTruthy(value)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }
      if (bValue) {
        const content = contentItem.contentArray
          .filter(item => (typeof item !== 'object') || (item == null) || (item.type != OD.ElseIf && item.type != OD.Else))
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return FlatSingle(content)
      }
      const elseCond = contentItem.contentArray.find(item => (typeof item === 'object' && item != null && (item.type == OD.ElseIf || item.type == OD.Else)))
      if (elseCond) {
        if (elseCond.type == OD.ElseIf) { return ContentReplacementTransform(elseCond, contextStack) }
        // else
        const content = elseCond.contentArray
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return FlatSingle(content)
      }
    }
      break
  }
}

function FlatSingle (arr) {
  return [].concat(...arr).filter(Boolean)
}

function CreateContextErrorMessage (message) {
  return { error: 'Evaluation Error: ' + message }
}
