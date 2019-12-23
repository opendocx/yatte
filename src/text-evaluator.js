'use strict'

const Scope = require('./yobj')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class TextEvaluator {
  constructor (scope) {
    this.contextStack = (scope && scope.__yobj)
      ? scope.__yobj
      : (scope instanceof Scope)
        ? scope
        : Scope.pushObject(scope)
  }

  assemble (contentArray) {
    const text = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack)).join('')
    // reset context stack (a TextEvaluator is a one-time-use sort of thing)
    this.contextStack = null
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
        // todo: make sure the following is memoized to avoid unnecessary re-evaluation
        let value = frame.evaluate(evaluator)
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
        // todo: make sure the following is memoized to avoid unnecessary re-evaluation
        iterable = frame.evaluate(evaluator)
      } catch (err) {
        return CreateContextErrorMessage('EvaluationException: ' + err.message)
      }
      contextStack = Scope.pushList(iterable, contextStack)
      const allContent = contextStack.indices.map(index => {
        contextStack = Scope.pushListItem(index, contextStack)
        const listItemContent = contentItem.contentArray.map(
          listContentItem => ContentReplacementTransform(listContentItem, contextStack))
        contextStack = Scope.pop(contextStack)
        return listItemContent.join('')
      })
      contextStack = Scope.pop(contextStack)
      return allContent.join('')
    }
    case OD.If:
    case OD.ElseIf: {
      let bValue
      try {
        if (frame.frameType !== Scope.OBJECT) {
          throw new Error(`Internal error: cannot define a condition directly in a ${frame.frameType} context`)
        }
        const evaluator = base.compileExpr(contentItem.expr) // these are cached so this should be fast
        // todo: make sure the following is memoized to avoid unnecessary re-evaluation
        const value = frame.evaluate(evaluator)
        bValue = Scope.isTruthy(value)
      } catch (err) {
        return CreateContextErrorMessage('EvaluationException: ' + err.message)
      }
      if (bValue) {
        const content = contentItem.contentArray
          .filter(
            item => (typeof item !== 'object') || (item == null) || (item.type !== OD.ElseIf && item.type !== OD.Else)
          )
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return content.join('')
      }
      const elseCond = contentItem.contentArray.find(
        item => (typeof item === 'object' && item != null && (item.type === OD.ElseIf || item.type === OD.Else))
      )
      if (elseCond) {
        if (elseCond.type === OD.ElseIf) { return ContentReplacementTransform(elseCond, contextStack) }
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
