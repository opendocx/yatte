'use strict'
const { AST } = require('./estree')

class ContextStack {
  constructor () {
    this.stack = []
  }

  empty () {
    return this.stack.length == 0
  }

  pushGlobal (contextObj, localsObj = null) {
    if (!this.empty()) { throw new Error('Internal error: execution stack is not empty at beginning of assembly') }
    const newFrame = new StackFrame('Object', '_odx', localsObj, null, contextObj)
    this.push(newFrame)
  }

  popGlobal () {
    const result = this.popObject()
    if (!this.empty()) { throw new Error('Internal error: execution stack is not empty at end of assembly') }
    return result
  }

  pushObject (name, index) {
    const listFrame = this.peek()
    if (listFrame && listFrame.type == 'List') {
      const item = listFrame.localScope[index]
      let local
      if (typeof item === 'object') {
        if (isPrimitiveWrapper(item)) {
          local = primitiveWrapperClone(item)
        } else {
          local = shallowClone(item, Object.getPrototypeOf(item))
        }
      } else {
        local = wrapPrimitive(item)
      }
      Object.defineProperties(local, {
        _index0: { value: index },
        _index: { value: index + 1 },
        // _parent is set above in MergeParentScopes, once for the whole list
        _punc: { value: (
          listFrame.punctuation
            ? (
              (index == listFrame.localScope.length - 1)
                ? listFrame.punctuation.suffix
                : (
                  (index == listFrame.localScope.length - 2)
                    ? (
                      index == 0
                        ? listFrame.punctuation.only2
                        : listFrame.punctuation.last2
                    )
                    : listFrame.punctuation.between
                )
            )
            : ''
        )
        }
      })
      const newFrame = new StackFrame('Object', name, local, listFrame, listFrame.parentScope)
      this.push(newFrame)
    } else {
      throw new Error('Cannot push non-list stack frame')
    }
  }

  popObject () {
    const poppedFrame = this.pop()
    if (poppedFrame.type != 'Object') { throw new Error(`Internal error: expected Object stack frame, got ${poppedFrame.type} instead`) }
    return poppedFrame
  }

  pushList (name, iterable) {
    const parentFrame = this.peek()
    const array = iterable ? Array.from(iterable) : []
    const newFrame = new StackFrame('List', name, array, parentFrame, MergeParentScopes(parentFrame.localScope, parentFrame.parentScope))
    newFrame.punctuation = iterable ? iterable.punc : null
    this.push(newFrame)
    return indices(newFrame.localScope.length)
  }

  popList () {
    const poppedFrame = this.pop()
    if (poppedFrame.type != 'List') { throw new Error(`Internal error: expected List stack frame, got ${poppedFrame.type} instead`) }
    return poppedFrame
  }

  push (frame) {
    this.stack.push(frame)
  }

  pop () {
    return this.stack.pop()
  }

  peek () {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null
  }

  peekName () {
    return this.peek().name
  }

  static IsTruthy (value) {
    let bValue
    if (value && ContextStack.IsIterable(value)) {
      // checking if a list is empty or not
      if (!ContextStack.IsArray(value)) {
        value = Array.from(value)
      }
      bValue = (value.length > 0) // for purposes of if fields in opendocx, we consider empty lists falsy! (unlike typical JavaScript, where all arrays are considered truthy)
    } else {
      bValue = Boolean(value)
    }
    return bValue
  }

  static IsArray (obj) {
    return Array.isArray(obj)
  }

  static IsIterable (obj) {
    // checks for null and undefined; also strings (though iterable) should not be iterable *contexts*
    if (obj == null || typeof obj === 'string') {
      return false
    }
    return typeof obj[Symbol.iterator] === 'function'
  }
}
module.exports = ContextStack

const indices = (length) => new Array(length).fill(undefined).map((value, index) => index)

class StackFrame {
  constructor (type, name, localScope, parentFrame, parentScope = parentFrame.parentScope) {
    this.type = type
    this.name = name
    this.localScope = localScope || null
    this.parentFrame = parentFrame
    this.parentScope = parentScope
  }

  evaluate (compiledExpr) {
    if (this.parentScope && this.localScope && compiledExpr.ast.type === AST.ListFilterExpression) {
      return compiledExpr(MergeParentScopes(this.localScope, this.parentScope, false))
    } // else
    return compiledExpr(this.parentScope, this.localScope)
  }

  deferredEvaluation (compiledExpr) {
    return {
      type: AST.ExpressionStatement,
      expression: compiledExpr.ast,
      text: compiledExpr.normalized,
      // for deferred evaluation (which happens for meta templates), we do not currently allow use of _parent to *explicitly* reference the parent context.
      scope: Object.prototype.hasOwnProperty.call(this.parentScope, '_parent') ? this.parentScope._parent : this.parentScope,
      locals: this.localScope
    }
  }
}

function MergeParentScopes (parentLocal, parentParent, define_parent = true) {
  let merged
  if (parentLocal) {
    if (isPrimitiveWrapper(parentLocal)) {
      merged = Object.create(parentParent)
      if (define_parent) {
        Object.defineProperty(merged, '_parent', { value: parentLocal })
      }
    } else {
      // make a copy of the prototype object for parentLocal, but redirect its prototype chain to point to the parent context
      const proto = shallowClone(Object.getPrototypeOf(parentLocal), parentParent)
      merged = shallowClone(parentLocal, proto)
      if (define_parent) {
        Object.defineProperty(merged, '_parent', { value: merged })
      }
    }
  } else {
    merged = Object.create(parentParent)
    if (define_parent) {
      Object.defineProperty(merged, '_parent', { value: parentParent })
    }
  }
  return merged
}

function wrapPrimitive (value) {
  let val
  switch (typeof value) {
    case 'string': val = new String(value); break
    case 'number': val = new Number(value); break
    case 'boolean': val = new Boolean(value); break
    default: throw new Error(`unexpected value type '${typeof value}'`)
  }
  return val
}

// function wrapPrimitiveAlt (value) {
//   return {
//     _value: value,
//     valueOf: () => this._value
//   }
// }

function isPrimitiveWrapper (obj) {
  return obj.constructor && ['String', 'Number', 'Boolean'].includes(obj.constructor.name)
}

function shallowClone (obj, newProto) {
  let clone
  if (newProto && isPrimitiveWrapper(newProto)) {
    const val = newProto.valueOf()
    newProto = { _value: val }
  }
  if (obj === Object.prototype) {
    clone = Object.create(newProto || obj)
  } else {
    clone = Object.create(newProto || Object.getPrototypeOf(obj))
    Object.getOwnPropertyNames(obj).forEach(key => Object.defineProperty(clone, key, Object.getOwnPropertyDescriptor(obj, key)))
  }
  return clone
}

function primitiveWrapperClone (obj) {
  let clone = wrapPrimitive(obj.valueOf())
  Object.getOwnPropertyNames(obj).forEach(key => Object.defineProperty(clone, key, Object.getOwnPropertyDescriptor(obj, key)))
  return clone
}
