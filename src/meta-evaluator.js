'use strict'

const Scope = require('./yobject')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class MetaEvaluator {
  constructor (scope, locals = null) {
    this.scopePushed = this.localsPushed = false
    if (scope) {
      this.contextStack = scope.__frame
        || (scope instanceof Scope ? scope : (this.scopePushed = true) && Scope.pushObject(scope))
    }
    if (locals) {
      if (locals.__frame || (locals instanceof Scope)) throw new Error('Scope stack cannot be provided as locals')
      this.contextStack = Scope.pushObject(locals, this.contextStack)
      this.localsPushed = true
    }
  }

  assemble (contentArray) {
    const result = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack))
    // now pop whatever was pushed (and nothing more)
    if (this.localsPushed) {
      this.contextStack = Scope.pop(this.contextStack)
    }
    if (this.scopePushed) {
      this.contextStack = Scope.pop(this.contextStack)
    }
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
        return frame._deferEvaluate(evaluator)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }

    case OD.List: {
      let iterable
      try {
        const evaluator = base.compileExpr(contentItem.expr)
        // todo: make sure the following is memoized to avoid unnecessary re-evaluation
        iterable = frame._evaluate(evaluator)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }
      contextStack = Scope.pushList(iterable, contextStack)
      const allContent = contextStack._indices.map(index => {
        contextStack = Scope.pushListItem(index, contextStack)
        const listItemContent = contentItem.contentArray.map(
          listContentItem => ContentReplacementTransform(listContentItem, contextStack)
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
        if (frame._objType !== Scope.OBJECT) {
          throw new Error(`Internal error: cannot define a condition directly in a ${frame._objType} context`)
        }
        const evaluator = base.compileExpr(contentItem.expr)
        // todo: make sure the following is memoized to avoid unnecessary re-evaluation
        const value = frame._evaluate(evaluator)
        bValue = Scope.isTruthy(value)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }
      if (bValue) {
        const content = contentItem.contentArray
          .filter(
            item => (typeof item !== 'object') || (item == null) || (item.type !== OD.ElseIf && item.type !== OD.Else)
          )
          .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
        return FlatSingle(content)
      }
      const elseCond = contentItem.contentArray.find(
        item => (typeof item === 'object' && item != null && (item.type === OD.ElseIf || item.type === OD.Else))
      )
      if (elseCond) {
        if (elseCond.type === OD.ElseIf) { return ContentReplacementTransform(elseCond, contextStack) }
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
