'use strict'
const EvaluationResult = require('./eval-result')
const { AST } = require('./estree')

/*
  Two kinds of proxy objects created & managed as part of this file:
  1) Evaluation Context Proxies (ECPs)
  2) Scoped Object Proxies (SOPs)

  The former (Context Proxies) are meant to be used (by evaluation code) as a hierarchical scope -- the kind of
  stack structure where Yatte evaluation takes place, where if an identifier is not defined in this scope, it looks
  up the chain of parent scopes until it finds one where that identifier is defined.

  The latter (Scoped Object Proxies) are meant to be used (by evaluation code) as concrete object instances -- the
  kind of thing where it either has a specific named member, or it doesn't... there is no looking up identifiers on
  parent contexts.  HOWEVER, Scoped Object Proxies ALSO incorporate a Context that is to be used in situations where the
  scoped object has virtuals, which then require a lookup scope to evaluate.

  During evaluation, CPs are that IN WHICH you look for identifiers, to resolve them.  Once resolved, you can have
  an SOP, which is like an object instance that remembers the context from which it came.
*/

// TODO: implement some sort of (WeakMap) cache for all of these proxy objects

const scopeChainHandler = {
  get: function (targetStackFrame, property, receiverProxy) {
    switch (property) {
      case '__frame': return targetStackFrame
      case '_getScopeProxy': return () => receiverProxy
      case 'toString': return targetStackFrame.toString
      case 'valueOf': return targetStackFrame.valueOf
    } // else
    let thisFrame = targetStackFrame
    while (thisFrame) {
      if (property in thisFrame) { // property is a direct call to _evaluate, _deferredEvaluation, etc.
        return thisFrame[property]
      } // else
      if (thisFrame._virtuals && (property in thisFrame._virtuals)) {
        const val = thisFrame._virtuals[property](
          thisFrame === targetStackFrame
            ? receiverProxy
            : thisFrame._getScopeProxy()
        )
        return (val instanceof EvaluationResult) ? val.value : val
      } // else
      if (property in thisFrame._data) {
        const val = thisFrame._data[property]
        if (!val
          || typeof val === 'string'
          || typeof val === 'number'
          || typeof val === 'boolean'
          || val instanceof Date
          || val instanceof EvaluationResult) {
          return val
        } // else
        if (Array.isArray(val)) {
          return (val.length > 0 && (val._virtuals || val[0]._virtuals))
            ? val.map(vitem => new Proxy(vitem, new ScopedObjectHandler(targetStackFrame)))
            : val
        } // else
        if (typeof val === 'object' && val._virtuals) {
          // need to return an object that looks like val (it's NOT a scope object), but which
          // still knows/remembers the current scope stack.
          // this object can have virtuals, which (when invoked) look up identifiers against the correct scope stack.
          return new Proxy(val, new ScopedObjectHandler(targetStackFrame))
        } // else return value as-is
        return val
      } // else
      // keep walking the stack...
      if (thisFrame instanceof ItemScope) {
        thisFrame = thisFrame._parentScope._parentScope // skip list (array) frame
      } else {
        thisFrame = thisFrame._parentScope
      }
    }
  },
  has: function (targetStackFrame, property) {
    // needed to support concat spread for arrays!  (who knew?)
    let thisFrame = targetStackFrame
    while (thisFrame) {
      if (property in thisFrame) { // property is a direct call to _evaluate, _deferredEvaluation, etc.
        return true
      } // else
      if (thisFrame._virtuals && (property in thisFrame._virtuals)) {
        return true
      } // else
      if (property in thisFrame._data) {
        return true
      } // else
      // keep walking the stack...
      if (thisFrame instanceof ItemScope) {
        thisFrame = thisFrame._parentScope._parentScope // skip list (array) frame
      } else {
        thisFrame = thisFrame._parentScope
      }
    }
  },
}

class ScopedObjectHandler {
  constructor (contextFrame) {
    this.scope = contextFrame
  }

  get (targetObject, property, receiverProxy) {
    switch (property) {
      case Symbol.toPrimitive: return (/* hint */) => targetObject.valueOf()
      case '__object': return targetObject
      case '_getObjectProxy': return () => receiverProxy
      case 'toString': return (...args) => targetObject.toString.apply(targetObject, args)
      case 'valueOf': return () => targetObject.valueOf()
    } // else
    if (targetObject._virtuals && (property in targetObject._virtuals)) { // prop is the name of a virtual property
      const nestedScope = Scope.pushObject(targetObject, this.scope, property, targetObject._virtuals)
      const val = targetObject._virtuals[property](nestedScope._getScopeProxy())
      return (val instanceof EvaluationResult) ? val.value : val
    } // else
    if (property in targetObject) {
      const val = targetObject[property]
      if (!val
        || typeof val === 'string'
        || typeof val === 'number'
        || typeof val === 'boolean'
        || val instanceof Date
        || val instanceof EvaluationResult) {
        return val
      } // else
      const nestedScope = Scope.pushObject(targetObject, this.scope, undefined, targetObject._virtuals)
      if (Array.isArray(val)) {
        return (val.length > 0 && (val._virtuals || val[0]._virtuals))
          ? val.map(vitem => new Proxy(vitem, new ScopedObjectHandler(nestedScope)))
          : val
      } // else
      if (typeof val === 'object' && val._virtuals) {
        // need to return an object that looks like val (it's NOT a scope object), but which
        // still knows/remembers the current scope stack.
        // this object can have virtuals, which (when invoked) look up identifiers against the correct scope stack.
        return new Proxy(val, new ScopedObjectHandler(nestedScope))
      } // else return value as-is
      return val
    } // else
    // return undefined
  }

  has (targetObject, property) {
    // maybe needed to support concat spread for arrays
    if (targetObject._virtuals && (property in targetObject._virtuals)) {
      return true
    } // else
    if (property in targetObject) {
      return true
    }
  }
}

class Scope {
  constructor (scopeType, scopeLabel, data = null, parent = null, virtuals = null) {
    this._scopeType = scopeType
    this._label = scopeLabel
    this._parentScope = parent
    this._dataType = typeof data
    switch (this._dataType) {
      case 'object':
        this._data = data
        if (data instanceof Date) {
          this._dataType = 'date'
        } else {
          this._virtuals = virtuals
          if (scopeType === Scope.LIST) this._dataType = 'array'
        }
        break
      case 'string':
        this._data = new String(data) // eslint-disable-line no-new-wrappers
        break
      case 'number':
        this._data = new Number(data) // eslint-disable-line no-new-wrappers
        break
      case 'boolean':
        this._data = new Boolean(data) // eslint-disable-line no-new-wrappers
        break
      default:
        this._data = data
    }
  }

  [Symbol.toPrimitive] (hint) {
    if (!this._data) return undefined
    switch (this._dataType) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'date':
        return this._data.valueOf()
      default:
        if (hint === 'string') return this._data.toString()
        if (hint === 'number') return Number(this._data)
        // else
        return Boolean(this._data)
    }
  }

  get [Symbol.isConcatSpreadable] () {
    return (this._dataType === 'array' || Array.isArray(this._data))
  }

  toString (...args) {
    return this._data.toString.apply(this._data, args)
  }

  valueOf () {
    return this._data.valueOf()
  }

  get _parent () {
    let parentFrame = this._parentScope
    if (this instanceof ItemScope) {
      parentFrame = parentFrame._parentScope
    }
    return parentFrame && parentFrame._getObjectProxy()
  }

  _getScopeProxy () {
    return new Proxy(this, scopeChainHandler)
  }

  _getObjectProxy () {
    // if (this._dataType !== 'object') throw new Error(`Cannot get ObjectProxy on a ${this._dataType}`)
    // above commented out because it was causing a test to fail that otherwise still works...
    return new Proxy(this._data, new ScopedObjectHandler(this))
  }

  _evaluate (compiledExpr) {
    return compiledExpr(this._getScopeProxy())
  }

  _deferredEvaluation (compiledExpr) {
    return {
      type: AST.ExpressionStatement,
      expression: compiledExpr.ast,
      text: compiledExpr.normalized,
      data: this._data
    }
  }

  static empty (scope) {
    return (!scope)
  }

  static pop (scope, forceRelease = false) {
    if (Scope.empty(scope)) return null
    const parent = scope._parentScope
    if (forceRelease) {
      // this causes problems when due to async code, frames may be pushed and popped out of order sometimes
      // (hence the fact that it's optional and off by default)
      scope._parentScope = null
    }
    return parent
  }

  static pushObject (data, parent = null, label = '', virtuals = null) {
    return new Scope(Scope.OBJECT, label || (parent ? label : '_odx'), data, parent, virtuals)
  }

  static pushList (iterable, parent, label, virtuals = null) {
    return new ListScope(label, iterable, parent, virtuals)
  }

  static pushListItem (index0, parentList, label) {
    return new ItemScope(label, index0, parentList)
  }

  static pushReducerItem (index0, parentList, result, label) {
    return new ReducerItemScope(label, index0, parentList, result)
  }

  static isTruthy (value) {
    let bValue
    if (value && Scope.isIterable(value)) {
      // checking if a list is empty or not
      if (!Scope.isArray(value)) {
        value = Array.from(value)
      }
      bValue = (value.length > 0) // for purposes of if fields in opendocx, we consider empty lists falsy!
      // (unlike typical JavaScript, where any non-null array, even empty ones, are considered truthy)
    } else {
      bValue = Boolean(value)
    }
    return bValue
  }

  static isArray (obj) {
    return Array.isArray(obj)
  }

  static isIterable (obj) {
    // checks for null and undefined; also strings (though iterable) should not be iterable *contexts*
    if (obj == null || typeof obj === 'string') {
      return false
    }
    return typeof obj[Symbol.iterator] === 'function'
  }

  static parseListExample (example) {
    const p1 = example.indexOf('1')
    const p2 = example.indexOf('2')
    const p3 = example.indexOf('3')
    if (p1 >= 0 && p2 > p1) { // at least 1 & 2 are present and in the right order
      const between = example.slice(p1 + 1, p2)
      if (p3 > p2) { // 3 is also present and in the expected order
        const last2 = example.slice(p2 + 1, p3)
        let only2
        if (last2 !== between && last2.startsWith(between)) { // as with an oxford comma: "1, 2, and 3"
          only2 = last2.slice(between.trimRight().length)
        } else {
          only2 = last2
        }
        const suffix = example.slice(p3 + 1)
        return { between, last2, only2, suffix }
      } else { // 3 is not present or is not in the valid order
        const suffix = example.slice(p2 + 1)
        return { between, last2: between, only2: between, suffix }
      }
    }
  }
}
Scope.OBJECT = 'Object'
Scope.LIST = 'List'
Scope.PRIMITIVE = 'Primitive'
module.exports = Scope

class ListScope extends Scope {
  constructor (scopeLabel, iterable, parent, virtuals = null) {
    const array = iterable ? Array.from(iterable) : []
    super(Scope.LIST, scopeLabel, array, parent, virtuals)
    this._indices = indices(array.length)
    this._punc = iterable ? iterable.punc : null
  }
}

class ItemScope extends Scope {
  constructor (scopeLabel, index0, parentList) {
    if (!parentList || parentList._scopeType !== Scope.LIST) {
      throw new Error('ItemScope must be a child of ListScope')
    }
    const data = parentList._data[index0]
    const scopeType = isPrimitive(data) ? Scope.PRIMITIVE : Array.isArray(data) ? Scope.LIST : Scope.OBJECT
    super(scopeType, scopeLabel, data, parentList, parentList._virtuals)
    this._index0 = index0
  }

  get _index () {
    return this._index0 + 1
  }

  get _punc () {
    const index0 = this._index0
    const lastItem = this._parentScope._data.length - 1
    const punc = this._parentScope._punc
    return punc                  // if punctuation was specified
      ? (index0 === lastItem)       // if index0 is the last item
        ? punc.suffix              // get the list suffix (if any)
        : (index0 === lastItem - 1) // else if index0 is 2nd to last
          ? index0 === 0            //    ... and ALSO first (meaning there are only 2!)
            ? punc.only2           //        ... then get only2
            : punc.last2           //        ... otherwise get last2
          : punc.between           // otherwise just get regular 'between' punctuation
      : ''                       // otherwise no punctuation
  }
}

class ReducerItemScope extends ItemScope {
  constructor (scopeLabel, index0, parentList, result) {
    super(scopeLabel, index0, parentList)
    this._result = result
  }
}

const indices = (length) => new Array(length).fill(undefined).map((value, index) => index)
const isPrimitive = (value) => {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true
    case 'object':
      if (value instanceof Date) {
        return true
      }
  }
  return false
}
