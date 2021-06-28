'use strict'

const Scope = require('./yobj')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class MetaEvaluator {
  constructor (scope) {
    this.missing = {}
    this.errors = []
    this.contextStack = (scope && scope.__yobj)
      ? scope.__yobj
      : (scope instanceof Scope)
        ? scope
        : Scope.pushObject(scope)
  }

  assemble (contentArray) {
    const result = contentArray.map(contentItem => (
      this.ContentReplacementTransform(contentItem, this.contextStack)
    ))
    // reset context stack (a TextEvaluator is a one-time-use sort of thing)
    this.contextStack = null
    return FlatSingle(result)
  }

  ContentReplacementTransform (contentItem, contextStack) {
    if (!contentItem || (typeof contentItem === 'string')) { return }
    if (typeof contentItem !== 'object') { throw new Error(`Unexpected content '${contentItem}'`) }
    const frame = contextStack // .peek()
    switch (contentItem.type) {
      case OD.Content:
        try {
          const evaluator = base.compileExpr(contentItem.expr)
          return frame.deferEvaluate(evaluator)
        } catch (err) {
          return CreateContextErrorMessage(err.message)
        }

      case OD.List: {
        let iterable
        try {
          const evaluator = base.compileExpr(contentItem.expr)
          // todo: make sure the following is memoized to avoid unnecessary re-evaluation
          iterable = frame.evaluate(evaluator)
        } catch (err) {
          return CreateContextErrorMessage(err.message)
        }
        contextStack = Scope.pushList(iterable, contextStack)
        contextStack.__expr = contentItem.expr // for deferred re-evaluation of list if necessary
        const allContent = contextStack.indices.map(index => {
          contextStack = Scope.pushListItem(index, contextStack)
          contextStack.__index = index // for deferred re-selection of list item if necessary
          const listItemContent = contentItem.contentArray.map(
            listContentItem => this.ContentReplacementTransform(listContentItem, contextStack)
          )
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
          if (frame.frameType === Scope.LIST) {
            throw new Error(`Internal error: cannot define a condition directly in a ${frame.frameType} context`)
          }
          const evaluator = base.compileExpr(contentItem.expr)
          // todo: make sure the following is memoized to avoid unnecessary re-evaluation
          const value = frame.evaluate(evaluator)
          bValue = Scope.isTruthy(value)
        } catch (err) {
          return CreateContextErrorMessage(err.message)
        }
        if (bValue) {
          const content = contentItem.contentArray
            .filter(
              item => (typeof item !== 'object') || (item == null) || (item.type !== OD.ElseIf && item.type !== OD.Else)
            )
            .map(conditionalContentItem => this.ContentReplacementTransform(conditionalContentItem, contextStack))
          return FlatSingle(content)
        }
        const elseCond = contentItem.contentArray.find(
          item => (typeof item === 'object' && item != null && (item.type === OD.ElseIf || item.type === OD.Else))
        )
        if (elseCond) {
          if (elseCond.type === OD.ElseIf) { return this.ContentReplacementTransform(elseCond, contextStack) }
          // else
          const content = elseCond.contentArray
            .map(conditionalContentItem => this.ContentReplacementTransform(conditionalContentItem, contextStack))
          return FlatSingle(content)
        }
      }
        break
    }
  }
}
module.exports = MetaEvaluator

function FlatSingle (arr) {
  return [].concat(...arr).filter(Boolean)
}

function CreateContextErrorMessage (message) {
  return { error: 'Evaluation Error: ' + message }
}
