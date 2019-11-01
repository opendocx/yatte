'use strict'
const { AST } = require('./estree')

const scopeChainHandler = {
  get: function(target, prop) {
    if (prop === '__scope') {
      return target
    }
    let current = target
    while (current) {
      if (prop in current) {
        return current[prop]
      } else if (prop in current._data) {
        return current._data[prop]
      }
      current = current._parent || current._parentScope
    }
  }
}

class Scope {
  constructor (scopeType, scopeLabel, data = null, parent = null) {
    this._scopeType = scopeType
    this._label = scopeLabel
    this._parentScope = parent
    this._dataType = typeof data
    switch (this._dataType) {
      case 'object':
        this._data = data
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
        return this._data.valueOf()
      default:
        if (hint === 'string') return this._data.toString()
        if (hint === 'number') return Number(this._data)
        // else
        return Boolean(this._data)
    }
  }

  _getScopeObject() {
    return new Proxy(this, scopeChainHandler)
  }

  _evaluate (compiledExpr) {
    if (compiledExpr.ast.type === AST.ThisExpression) { // special case
      return this._data
    } // else
    return compiledExpr(this._getScopeObject())
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
    return (!scope || !scope._parentScope)
  }

  static pop (scope) {
    if (Scope.empty(scope)) return null
    const parent = scope._parentScope
    scope._parentScope = null
    return parent
  }

  static pushObject (data, parent = null, label = '') {
    return new Scope(Scope.OBJECT, label || (parent ? label : '_odx'), data, parent)
  }

  static pushList (iterable, parent, label) {
    return new ListScope(label, iterable, parent)
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
}
Scope.OBJECT = 'Object'
Scope.LIST = 'List'
module.exports = Scope

class ListScope extends Scope {
  constructor (scopeLabel, iterable, parent) {
    const array = iterable ? Array.from(iterable) : []
    super(Scope.LIST, scopeLabel, array, parent)
    this._indices = indices(array.length)
    this._punc = iterable ? iterable.punc : null
  }
}

class ItemScope extends Scope {
  constructor (scopeLabel, index0, parentList) {
    if (!parentList || parentList._scopeType !== Scope.LIST) {
      throw new Error('ItemScope must be a child of ListScope')
    }
    super(Scope.OBJECT, scopeLabel, parentList._data[index0], parentList)
    this._index0 = index0
  }

  get _index () {
    return this._index0 + 1
  }

  get _parent () {
    return new Proxy(this._parentScope._parentScope, scopeChainHandler)
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
