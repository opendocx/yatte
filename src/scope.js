'use strict'
const EvaluationResult = require('./eval-result')
const { AST } = require('./estree')

const scopeChainHandler = {
  get: function(targetStackFrame, property, receiverProxy) {
    switch (property) {
      case '__target': return targetStackFrame
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
        const val = thisFrame._virtuals[property](receiverProxy)
        return (val instanceof EvaluationResult) ? val.value : val
      } // else
      if (property in thisFrame._data) {
        const val = thisFrame._data[property]
        if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof EvaluationResult)) {
          // need to return an object that looks like val (it's NOT a scope object), but which still knows/remembers the current scope stack.
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
  }
}

class ScopedObjectHandler {
  constructor (scope) {
    this.scope = scope
  }
  get (targetObject, property, receiverProxy) {
    switch (property) {
      case Symbol.toPrimitive: return (/* hint */) => targetObject.valueOf()
      // case '__target': return targetObject // this is only needed on scope stack frames, not arbitrary objects
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
      if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof EvaluationResult)) {
        // need to return an object that looks like val (it's NOT a scope object), but which still knows/remembers the current scope stack.
        // this object can have virtuals, which (when invoked) must execute independently (of their own accord) against the correct scope stack.
        const nestedScope = Scope.pushObject(targetObject, this.scope, undefined, targetObject._virtuals)
        return new Proxy(val, new ScopedObjectHandler(nestedScope))
      } // else
      return val
    } // else
    // return undefined
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
        this._data = new String(data)
        break
      case 'number':
        this._data = new Number(data)
        break
      case 'boolean': 
        this._data = new Boolean(data)
        break
      default:
        this._data = data
    }
  }

  [Symbol.toPrimitive](hint) {
    if (!this._data) return undefined
    switch(this._dataType) {
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

  _getScopeProxy() {
    return new Proxy(this, scopeChainHandler)
  }

  _getObjectProxy() {
    // if (this._dataType !== 'object') throw new Error(`Cannot get ObjectProxy on a ${this._dataType}`)
    // above commented out because it was causing a test to fail that otherwise still works...
    return new Proxy(this._data, new ScopedObjectHandler(this._parentScope))
  }

  _evaluate (compiledExpr) {
    if (compiledExpr.ast && (compiledExpr.ast.type === AST.ThisExpression)) { // special case
      return this._data
    } // else
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

  static empty(scope) {
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
    super(Scope.OBJECT, scopeLabel, parentList._data[index0], parentList, parentList._virtuals)
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
      ? (index0 == lastItem)       // if index0 is the last item
        ? punc.suffix              // get the list suffix (if any)
        : (index0 == lastItem - 1) // else if index0 is 2nd to last
          ? index0 == 0            //    ... and ALSO first (meaning there are only 2!)
            ? punc.only2           //        ... then get only2
            : punc.last2           //        ... otherwise get last2
          : punc.between           // otherwise just get regular 'between' punctuation
      : ''                       // otherwise no punctuation
  }
}

const indices = (length) => new Array(length).fill(undefined).map((value, index) => index)
