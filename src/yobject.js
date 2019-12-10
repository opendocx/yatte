'use strict'
const EvaluationResult = require('./eval-result')
const { AST } = require('./estree')

class YObject {
  constructor (value, context = null, virtuals = null) {
    if (value && value.__object) throw new Error('Nested YObject')
    this._context = context // evaluation context of this yobject
    this._objType = isPrimitive(value) ? Scope.PRIMITIVE : YObject.isArray(value) ? Scope.LIST : Scope.OBJECT
    this._valueType = typeof value
    switch (this._valueType) {
      case 'object':
        this._value = value
        if (!value) {
          this._valueType = 'null'
        } else if (this._objType === Scope.PRIMITIVE) {
          this._valueType = value.constructor.name.toLowerCase()
        } else {
          this._virtuals = virtuals
          if (this._objType === Scope.LIST) this._valueType = 'array'
        }
        break
      case 'string':
        this._value = new String(value) // eslint-disable-line no-new-wrappers
        break
      case 'number':
        this._value = new Number(value) // eslint-disable-line no-new-wrappers
        break
      case 'boolean':
        this._value = new Boolean(value) // eslint-disable-line no-new-wrappers
        break
      default:
        this._value = value
    }
    this.__proxy = undefined
  }

  [Symbol.toPrimitive] (hint) {
    if (!this._value) return undefined
    switch (this._valueType) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'date':
        return this._value.valueOf()
      default:
        if (hint === 'string') return this._value.toString()
        if (hint === 'number') return Number(this._value)
        // else
        return Boolean(this._value)
    }
  }

  get [Symbol.isConcatSpreadable] () {
    return (this._valueType === 'array' || YObject.isArray(this._value))
  }

  toString (...args) {
    return this._value.toString.apply(this._value, args)
  }

  valueOf () {
    return this._value.valueOf()
  }

  get _bareValue () { // for "unwrapping" wrapped primitives. Differs from valueOf in handling of dates.
    switch (this._valueType) {
      case 'string':
      case 'number':
      case 'boolean':
        return this._value.valueOf()
    }
    return this._value
  }

  get _parent () {
    return this._context && this._context._getScopeProxy()
  }

  _getObjectProxy () {
    return this.__proxy || (this.__proxy = new Proxy(
      this._value,
      new YObjectHandler(
        this._objType === Scope.OBJECT
          ? new Scope(this)
          : new Scope(this) // this._context
      )
    ))
  }

  static isTruthy (value) {
    let bValue
    if (value && YObject.isIterable(value)) {
      // checking if a list is empty or not
      if (!YObject.isArray(value)) {
        value = Array.from(value)
      }
      bValue = (value.length > 0) // for purposes of evaluation in yatte, we consider empty lists falsy!
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

class YList extends YObject {
  constructor (iterable, context, virtuals = null) {
    const array = iterable ? Array.from(iterable) : []
    super(array, context, virtuals)
    this._indices = indices(array.length)
    this._punc = iterable ? iterable.punc : null
  }
}

class YListItem extends YObject {
  constructor (listContext, index0) {
    if (!listContext || !(listContext instanceof Scope) || !(listContext._yobj instanceof YList)) {
      throw new Error('List context expected')
    }
    const item = listContext._value[index0]
    super(item, listContext, listContext._virtuals)
    this._index0 = index0
  }

  get _index () {
    return this._index0 + 1
  }

  get _punc () {
    const index0 = this._index0
    const lastItem = this._context._value.length - 1
    const punc = this._context._punc
    return punc                     // if punctuation was specified
      ? (index0 === lastItem)       //   (then) if index0 is the last item
        ? punc.suffix               //     (then) get the list suffix (if any)
        : (index0 === lastItem - 1) //     (else) if index0 is 2nd to last
          ? index0 === 0            //       (then) if first (meaning there are only 2!)
            ? punc.only2            //         (then) get only2
            : punc.last2            //         (else) get last2
          : punc.between            //       (else) just get regular 'between' punctuation
      : ''                          //   (else) no punctuation
  }
}

class YReducerItem extends YListItem {
  constructor (listContext, index0, result) {
    super(listContext, index0)
    this._result = result
  }
}

class Scope {
  constructor (yObject) {
    this._yobj = yObject
    this.__proxy = undefined
  }

  get _objType () {
    return this._yobj._objType
  }

  get _value () {
    return this._yobj._value
  }

  get _bareValue () {
    return this._yobj._bareValue
  }

  [Symbol.toPrimitive] (hint) {
    return this._yobj[Symbol.toPrimitive](hint)
  }

  get [Symbol.isConcatSpreadable] () {
    return this._yobj[Symbol.isConcatSpreadable]
  }

  toString (...args) {
    return this._yobj.toString.apply(this._yobj, args)
  }

  valueOf () {
    return this._yobj.valueOf()
  }

  get _virtuals () {
    return this._yobj._virtuals
  }

  _getScopeProxy () {
    return this.__proxy || (this.__proxy = new Proxy(this, scopeChainHandler))
  }

  _getObjectProxy () {
    return this._yobj._getObjectProxy()
  }

  _evaluate (compiledExpr) {
    if (typeof compiledExpr === 'function') {
      if (compiledExpr.ast) {
        // appears to be a compiled angular expression; it expects a scope object (proxy)
        const result = compiledExpr(this._getScopeProxy())
        // check for proxied primitives we may need to unwrap
        const t = result && result._objType
        if (t === Scope.PRIMITIVE) {
          return result._bareValue
        }
        return result
      } // else
      if (compiledExpr.logic) {
        // appears to be a compiled template; it expects a scope frame (not a proxy)
        return compiledExpr(this).valueOf()
      }
    }
    throw new Error('Scope._evaluate invoked against a non-function')
  }

  _deferEvaluate (compiledExpr) {
    return {
      type: AST.ExpressionStatement,
      expression: compiledExpr.ast,
      text: compiledExpr.normalized,
      data: this
    }
  }

  get _parent () {
    const parentFrame = this._parentScope
    return parentFrame && parentFrame._getScopeProxy()
  }

  get _parentScope () {
    return this._yobj._context
  }

  static empty (thatScope) {
    return !thatScope || !(thatScope instanceof Scope) || !(thatScope._yobj instanceof YObject)
  }

  static pop (thatScope, forceRelease = false) {
    if (Scope.empty(thatScope)) return null
    const parentScope = thatScope._yobj._context
    if (forceRelease) {
      // this causes problems when due to async code, frames may be pushed and popped out of order sometimes
      // (hence the fact that it's optional and off by default)
      thatScope._yobj._context = null
    }
    return parentScope
  }

  static pushObject (value, context = null, virtuals = null) {
    const frame = !value || (value instanceof Scope) ? value : value.__frame
    if (frame) {
      if (context || virtuals) throw new Error('Redundant scope pushed')
      return frame
    }
    if (context) {
      if (!(context instanceof Scope)) throw new Error('Pushed onto invalid context stack')
    }
    let obj = !value || (value instanceof YObject) ? value : value.__object
    if (obj) {
      if (context && (obj._context._value !== context._value)) throw new Error('Value/context mismatch')
      if (virtuals && (obj._virtuals !== virtuals)) throw new Error('Value/virtuals mismatch')
    } else {
      obj = new YObject(value, context, virtuals)
    }
    return new Scope(obj)
  }

  static pushList (iterable, context, virtuals = null) {
    if (context) {
      if (!(context instanceof Scope)) throw new Error('Pushed onto invalid context stack')
    }
    const frame = !iterable || (iterable instanceof Scope) ? iterable : iterable.__frame
    if (frame) {
      if (!(frame instanceof ListScope)) throw new Error('Pushed non-list as list')
      if (context && (context._value !== frame._context._value)) throw new Error('List frame/context mismatch')
      if (virtuals && (virtuals !== frame._virtuals)) throw new Error('List frame/virtuals mismatch')
      return frame
    }
    let list = !iterable || (iterable instanceof YObject) ? iterable : iterable.__object
    if (list) {
      if (context && (list._context._value !== context._value)) throw new Error('List/context mismatch')
      if (virtuals && (list._virtuals !== virtuals)) throw new Error('List/virtuals mismatch')
    } else {
      list = new YList(iterable, context, virtuals)
    }
    return new ListScope(list)
  }

  static pushListItem (index0, listContext) {
    if (listContext) {
      if (!(listContext instanceof ListScope)) throw new Error('Pushed onto invalid list context')
    } else {
      throw new Error('Cannot push list item onto empty stack')
    }
    if (!listContext._value || index0 >= listContext._value.length) throw new Error('List item out of range')
    const listItem = new YListItem(listContext, index0)
    return new ListItemScope(listItem)
  }

  static pushReducerItem (index0, listContext, result) {
    if (listContext) {
      if (!(listContext instanceof ListScope)) throw new Error('Pushed reducer item onto invalid list context')
    } else {
      throw new Error('Cannot push reducer item onto empty stack')
    }
    if (!listContext._value || index0 >= listContext._value.length) throw new Error('Reducer item out of range')
    const reducerItem = new YReducerItem(listContext, index0, result)
    return new ReducerItemScope(reducerItem)
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
Scope.PRIMITIVE = 'primitive'
Scope.OBJECT = 'object'
Scope.LIST = 'list'
Scope.isIterable = YObject.isIterable
Scope.isArray = YObject.isArray
Scope.isTruthy = YObject.isTruthy
module.exports = Scope

class ListScope extends Scope {
  get _indices () {
    return this._yobj._indices
  }

  get _punc () {
    return this._yobj._punc
  }
}

class ListItemScope extends Scope {
  get _index0 () {
    return this._yobj._index0
  }

  get _index () {
    return this._yobj._index
  }

  get _punc () {
    return this._yobj._punc
  }

  get _parentScope () {
    return this._yobj._context._parentScope // recurse to skip list frame
  }
}

class ReducerItemScope extends ListItemScope {
  get _result () {
    return this._yobj._result
  }
}

class HandlerBase {
  hasProperty (object, property) {
    return object && (typeof object === 'object') && (property in object)
  }

  getProperty (object, property, context) {
    const val = object[property]
    if (!val
      || typeof val === 'string'
      || typeof val === 'number'
      || typeof val === 'boolean'
      || val instanceof Date
      || val instanceof EvaluationResult) {
      return val
    } // else
    if (YObject.isArray(val)) {
      if (val.length > 0 && (val._virtuals || val[0]._virtuals)) {
        // we have virtuals defined; return array of objects capable of evaluating the virtuals
        const listScope = Scope.pushList(val, context, val._virtuals || val[0]._virtuals)
        return val.map((item, index0) => {
          const itemScope = Scope.pushListItem(index0, listScope)
          return itemScope._getObjectProxy()
        })
      }
      // else no virtuals, so just return the plain array
      return val
    }
    // else return the object
    if (typeof val === 'object' && val._virtuals) {
      // need to return an object that looks like val (it's NOT a scope object), but which
      // still knows/remembers the current scope stack.
      // this object can have virtuals, which (when invoked) look up identifiers against the correct scope stack.
      return (new YObject(val, context, val._virtuals))._getObjectProxy() // new Proxy(val, new YObjectHandler(context))
    }
    // else return value as-is
    return val
  }
}

/*
  YObjectHandler is a Proxy handler for runtime proxies of data objects.
  It is used like this:
      new Proxy(dataObj, new YObjectHandler(dataContextStackFrame))
  This will be a (direct) Proxy of a data object.
*/
class YObjectHandler extends HandlerBase {
  constructor (contextFrame) {
    super()
    this.context = contextFrame
  }

  get (targetObject, property, receiverProxy) {
    switch (property) {
      case Symbol.toPrimitive: return (/* hint */) => targetObject.valueOf()
      case '__object': return targetObject
      case '_parent': return this.context && this.context._parent
      case '_getObjectProxy': return () => receiverProxy
      case 'toString': return (...args) => targetObject.toString.apply(targetObject, args)
      case 'valueOf': return () => targetObject.valueOf()
    } // else
    if (this.hasProperty(targetObject._virtuals, property)) { // prop is the name of a virtual property
      // avoid pushing targetObject onto this.context if this.context._value === targetObject
      let contextScope
      if (this.context._value === targetObject) {
        contextScope = this.context
      } else {
        contextScope = Scope.pushObject(targetObject, this.context, targetObject._virtuals)
      }
      // todo: investigate whether we should be passing contextScope._getObjectProxy() instead of _getScopeProxy()
      //       because if we're executing a virtual ON a YObject (as we hare here), scope lookup behavior
      //       should probably not happen!
      const val = targetObject._virtuals[property](contextScope._getScopeProxy())
      return (val instanceof EvaluationResult) ? val.value : val
    } // else
    if (this.hasProperty(targetObject, property)) {
      return this.getProperty(targetObject, property,
        Scope.pushObject(targetObject, this.context, targetObject._virtuals)
      )
    } // else
    // return undefined
  }

  has (targetObject, property) {
    // maybe needed to support concat spread for arrays
    if (this.hasProperty(targetObject._virtuals, property)) {
      return true
    } // else
    if (this.hasProperty(targetObject, property)) {
      return true
    }
  }
}

/*
  ScopeHandler is a Proxy handler for runtime proxies of context scope frames.
  There need only ever be one instance of this class (const scopeChainHandler).
  It is used like this:
      new Proxy(dataContextStackFrame, scopeChainHandler)
  This will be a Proxy of a scope stack frame (which contains a reference to a data object).
  It also needs to serve as an 'indirect' proxy to the data object.
*/
class ScopeHandler extends HandlerBase {
  get (targetStackFrame, property, receiverProxy) {
    switch (property) {
      case '__frame': return targetStackFrame
      case '__object': return targetStackFrame._value
      case '_yobj': return targetStackFrame._yobj // bypass walking the stack
      case 'toString': return targetStackFrame.toString // bypass walking the stack
      case 'valueOf': return targetStackFrame.valueOf // bypass walking the stack
      // case '_getScopeProxy': return () => receiverProxy
    } // else
    let thisFrame = targetStackFrame
    while (thisFrame) {
      if (property in thisFrame) { // property is a direct call to _evaluate, _deferEvaluate, etc.
        return thisFrame[property]
      } // else
      // if (this.hasProperty(thisFrame._yobj, property)) { // property may be _index0, _indices, _parent, etc.
      //   return this.getProperty(thisFrame._yobj, property, targetStackFrame)
      // } // else
      if (this.hasProperty(thisFrame._virtuals, property)) {
        const val = thisFrame._virtuals[property](
          thisFrame === targetStackFrame
            ? receiverProxy
            : thisFrame._getScopeProxy()
        )
        return (val instanceof EvaluationResult) ? val.value : val
      } // else
      if (this.hasProperty(thisFrame._value, property)) {
        return this.getProperty(thisFrame._value, property, targetStackFrame)
      } // else
      // keep walking the stack...
      thisFrame = thisFrame._parentScope
    }
  }

  has (targetStackFrame, property) {
    // needed to support concat spread for arrays!  (who knew?)
    let thisFrame = targetStackFrame
    while (thisFrame) {
      if (property in thisFrame) { // property is a direct call to _evaluate, _deferredEvaluation, etc.
        return true
      } // else
      // if (this.hasProperty(thisFrame._yobj, property)) {
      //   return true
      // } // else
      if (this.hasProperty(thisFrame._virtuals, property)) {
        return true
      } // else
      if (this.hasProperty(thisFrame._value, property)) {
        return true
      } // else
      // keep walking the stack...
      thisFrame = thisFrame._parentScope
    }
  }
}

const scopeChainHandler = new ScopeHandler()
const primitiveConstructors = [String, Number, Boolean, Date]

function indices (length) {
  return new Array(length).fill(undefined).map((value, index) => index)
}

function isPrimitive (value) {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true
    case 'object':
      if (!value || (value.constructor && primitiveConstructors.includes(value.constructor))) {
        return true
      }
  }
  return false
}
