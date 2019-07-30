'use strict'

const ContextStack = require('./context-stack')
const OD = require('./fieldtypes')
const base = require('./base-templater')

class MetaEvaluator {
  constructor (context, locals = null) {
    this.context = context
    this.locals = locals
    this.contextStack = new ContextStack()
  }

  assemble(contentArray) {
    this.contextStack.pushGlobal(this.context, this.locals)
    const result = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack))
    this.contextStack.popGlobal()
    return FlatSingle(result)
  }
}
module.exports = MetaEvaluator

function ContentReplacementTransform(contentItem, contextStack)
{
  if (!contentItem || (typeof contentItem === "string"))
    return
  if (typeof contentItem !== "object")
    throw new Error(`Unexpected content '${contentItem}'`)
  const frame = contextStack.peek()
  switch (contentItem.type) {
    case OD.Content:
      try {
        const evaluator = base.compileExpr(contentItem.expr)
        return  frame.deferredEvaluation(evaluator)
      } catch (err) {
        return CreateContextErrorMessage(err.message)
      }

    case OD.List: {
        let iterable
        try {
          const evaluator = base.compileExpr(contentItem.expr)
          iterable = frame.evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
        } catch (err) {
          return CreateContextErrorMessage(err.message)
        }
        const indices = contextStack.pushList(contentItem.expr, iterable)
        const allContent = indices.map(index => {
          contextStack.pushObject('o' + index, index)
          const listItemContent = contentItem.contentArray.map(listContentItem => ContentReplacementTransform(listContentItem, contextStack))
          contextStack.popObject()
          return FlatSingle(listItemContent)
        });
        contextStack.popList()
        return FlatSingle(allContent)
      }

    case OD.If:
    case OD.ElseIf: {
        let bValue;
        try {
          if (frame.type != 'Object') {
            throw new Error(`Internal error: cannot define a condition directly in a ${frame.type} context`)
          }
          const evaluator = base.compileExpr(contentItem.expr)
          const value = frame.evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
          bValue = ContextStack.IsTruthy(value)
        } catch (err) {
          return CreateContextErrorMessage(err.message)
        }
        if (bValue)
        {
          const content = contentItem.contentArray
            .filter(item => (typeof item != "object") || (item == null) || (item.type != OD.ElseIf && item.type != OD.Else))
            .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
          return FlatSingle(content)
        }
        let elseCond = contentItem.contentArray.find(item => (typeof item == "object" && item != null && (item.type == OD.ElseIf || item.type == OD.Else)))
        if (elseCond) {
          if (elseCond.type == OD.ElseIf)
            return ContentReplacementTransform(elseCond, contextStack)
          // else
          const content = elseCond.contentArray
            .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack))
          return FlatSingle(content)
        }
      }
      break
  }
}

function FlatSingle(arr) {
  return [].concat(...arr).filter(Boolean)
}

function CreateContextErrorMessage(message) {
  return { error: "Evaluation Error: " + message }
}
