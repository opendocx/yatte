'use strict'
const EvaluationResult = require('./eval-result')
const { AST } = require('./estree')

class YObject {
  constructor (value, parent = null, virtuals = null) {
    if (value && (value.__yobj || (value instanceof YObject))) throw new Error('Cannot nest YObjects')
    if (parent) {
      if (!(parent instanceof YObject)) throw new Error('Invalid context')
    }
    this.parent = parent
    this.frameType = isPrimitive(value) ? YObject.PRIMITIVE : YObject.isArray(value) ? YObject.LIST : YObject.OBJECT
    this.valueType = typeof value
    switch (this.valueType) {
      case 'object':
        if (!value) {
          this.value = value
          this.valueType = 'null'
        } else if (this.frameType === YObject.PRIMITIVE) {
          this.value = value
          this.valueType = value.constructor.name.toLowerCase()
        } else {
          this.value = value
          this.virtuals = virtuals || ((parent instanceof YList) && parent.virtuals)
          if (this.frameType === YObject.LIST) this.valueType = 'array'
        }
        break
      case 'string':
        this.value = new String(value) // eslint-disable-line no-new-wrappers
        break
      case 'number':
        this.value = new Number(value) // eslint-disable-line no-new-wrappers
        break
      case 'boolean':
        this.value = new Boolean(value) // eslint-disable-line no-new-wrappers
        break
      default:
        this.value = value
    }
    this.items = {}
    this._proxy = undefined
    this._scopeProxy = undefined
  }

  hasProperty (property) {
    return (typeof this.value === 'object') && this.value && (property in this.value)
  }

  getProperty (property) {
    const val = this.items[property] || this.value[property]
    if (
      !val
      || val instanceof YObject
      || typeof val === 'string'
      || typeof val === 'number'
      || typeof val === 'boolean'
      || val instanceof Date
      // || val instanceof EvaluationResult
    ) {
      return val
    }
    // else create a YObject wrapper for the item, and cache it in items
    // (original item still availabe in value/__value)
    let newVal
    if (YObject.isIterable(val)) {
      newVal = new YList(val, this, val._virtuals)
    } else {
      newVal = new YObject(val, this, val._virtuals)
    }
    this.items[property] = newVal
    return newVal
  }

  hasVirtual (property) {
    return this.virtuals && (property in this.virtuals)
  }

  callVirtual (property) {
    /* const virtualScope = (yobj.frameType === YObject.PRIMITIVE)
      ? yobj.parent
      : yobj */
    const val = this.evaluate(this.virtuals[property])
    return (val instanceof EvaluationResult) ? val.value : val
  }

  evaluate (compiledVirtual) {
    if (typeof compiledVirtual === 'function') {
      if (compiledVirtual.ast) {
        // appears to be a compiled angular expression; it expects a scope object (proxy)
        const result = compiledVirtual(this.scopeProxy)
        // check for array return values, wrap them in a YList, and return a proxy
        if (Array.isArray(result) && !(this instanceof YReducerItem)) {
          return (new YList(result, this)).scopeProxy
        }
        // else check for proxied primitives we may need to unwrap
        const t = result && result.__yobj && result.__yobj.frameType
        if (t === YObject.PRIMITIVE) {
          return result.__yobj.bareValue
        }
        // else just return the value
        return result
      } // else
      if (compiledVirtual.logic) {
        // appears to be a compiled template; it expects a scope frame (not a proxy)
        return compiledVirtual(this).valueOf()
      } // else
      return compiledVirtual(this.scopeProxy)
    }
    throw new Error('YObject.evaluate invoked against a non-function')
  }

  deferEvaluate (compiledVirtual) {
    if (typeof compiledVirtual === 'function') {
      if (compiledVirtual.ast) {
        return {
          type: AST.ExpressionStatement,
          expression: compiledVirtual.ast,
          text: compiledVirtual.normalized,
          data: this
        }
      }
    }
    throw new Error('Cannot defer evaluation of virtual')
  }

  get proxy () {
    return this._proxy || (this._proxy = new Proxy(this, yobjectHandler))
  }

  get scopeProxy () {
    return this._scopeProxy || (this._scopeProxy = new Proxy(this, scopeChainHandler))
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
    if (obj == null || isPrimitive(obj)) {
      return false
    }
    return typeof obj[Symbol.iterator] === 'function'
  }

  [Symbol.toPrimitive] (hint) {
    if (!this.value) return undefined
    switch (this.valueType) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'date':
        return this.value.valueOf()
      default:
        if (hint === 'string') return this.value.toString()
        if (hint === 'number') return Number(this.value)
        // else
        return Boolean(this.value)
    }
  }

  /* get [Symbol.isConcatSpreadable] () {
    return (this.valueType === 'array' || YObject.isArray(this.value))
  } */

  toString (...args) {
    return this.value.toString.apply(this.value, args)
  }

  valueOf () {
    return this.value.valueOf()
  }

  get bareValue () { // for "unwrapping" wrapped primitives. Differs from valueOf in handling of dates.
    switch (this.valueType) {
      case 'string':
      case 'number':
      case 'boolean':
        return this.value.valueOf()
    }
    return this.value
  }

  get _parent () {
    return this.parent && this.parent.scopeProxy
    // note: _parent needs to return a scopeProxy (rather than a regular proxy) so _index will be available on it
  }

  static empty (thatScope) {
    return !thatScope || !(thatScope instanceof YObject)
  }

  static pop (thatScope) {
    if (YObject.empty(thatScope)) return null
    return thatScope.parent
  }

  static pushObject (value, parent = null, virtuals = null) {
    let obj = value.__value // in case it's a proxy
    if (!obj) {
      obj = (value instanceof YObject) ? value.value : value
    }
    return new YObject(obj, parent, virtuals || ((value instanceof YObject) && value.virtuals))
  }

  static pushList (iterable, parent, virtuals = null) {
    let array
    if (iterable && iterable.__yobj) { // it's a list proxy (result of evaluating an expression)
      if (iterable.__yobj.parent === parent) { // it already has the correct/desired context
        return iterable.__yobj // just go with what we've already got
      }
      // else
      console.log('pushList called with out-of-context proxy')
      array = iterable.__yobj.value
    }
    if (!array) {
      if (iterable instanceof YList) {
        if (iterable.parent === parent) {
          return iterable
        }
        console.log('pushList called with out-of-context list')
        array = iterable.value
      }
    }
    return new YList(array || iterable, parent, virtuals || ((iterable instanceof YList) && iterable.virtuals))
  }

  static pushListItem (index0, parentList) {
    return parentList.items[index0] // YListItems have already been created, we just return the existing ones
  }

  static pushReducerItem (index0, parentList, result) {
    return new YReducerItem(index0, parentList, result)
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
YObject.PRIMITIVE = 'primitive'
YObject.OBJECT = 'object'
YObject.LIST = 'list'
module.exports = YObject

class YList extends YObject {
  constructor (iterable, parent, virtuals = null) {
    super([], parent, virtuals)
    this.punc = iterable ? iterable.punc : null
    let array
    if (iterable) {
      array = Array.isArray(iterable) ? iterable : Array.from(iterable) // we used to always make a copy of the array
      // so we're not modifying the original, but that may no longer be necessary
    } else {
      array = []
    }
    // array may contain proxy objects; if so, extract raw values from proxies
    this.value = array.map(element => (element && element.__yobj) ? element.__value : element) // raw objects
    this.items = this.value.map((item, index0) => new YListItem(index0, this)) // array of YListItems
  }

  get indices () {
    return indices(this.items.length)
  }

  get proxy () {
    // need a wrapped array of YListItems, such that calls to get trap return proxies, but target item is still an array
    return this._proxy || (this._proxy = new Proxy(this.items, new ProxyArrayHandler(this, false)))
  }

  get scopeProxy () {
    // array of proxies instead of single proxy, because the result must return true for Array.isArray()
    return this._scopeProxy || (this._scopeProxy = new Proxy(this.items, new ProxyArrayHandler(this, true)))
  }
}

class YListItem extends YObject {
  constructor (index0, parentList) {
    if (!parentList || !(parentList instanceof YList)) {
      throw new Error('List context expected')
    }
    const element = parentList.value[index0]
    if (element instanceof YObject) {
      throw new Error('Unexpected YObject in list value')
    }
    super(element, parentList, parentList._virtuals)
    this.index0 = index0
    // this.rresult = undefined // needed when a reducer is used on the list
  }

  get _parent () {
    return this.parent.parent && this.parent.parent.scopeProxy
    // note: _parent needs to return a scopeProxy (rather than a regular proxy) so _index will be available on it
  }

  get index () {
    return this.index0 + 1
  }

  get punc () {
    const index0 = this.index0
    const lastItem = this.parent.value.length - 1
    const punc = this.parent.punc
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
  constructor (index0, parentList, result) {
    super(index0, parentList)
    this.result = result
  }
}

class ProxyArrayHandler {
  constructor (ylist, scopeProxies = true) {
    this.ylist = ylist
    this.scopeProxies = scopeProxies
  }

  get (/* target */ array, property, receiver /* proxy */) {
    switch (property) {
      case '__yobj': return this.ylist
      case '__value': return this.ylist.value
      case '_parent': return this.ylist._parent
      case Symbol.isConcatSpreadable: return true
    } // else
    const val = array[property]
    return (val && (val instanceof YObject))
      // ? (val.frameType === YObject.PRIMITIVE
      //   ? val.bareValue :
      ?  (this.scopeProxies
        ? val.scopeProxy
        : val.proxy)// )
      : val
  }

  // redirect (trap) {
  //   return (target, ...args) => Reflect[trap](this.ylist, ...args)
  // }
}

/*
  YObjectHandler is a Proxy handler for runtime proxies of data objects.
*/
class YObjectHandler {
  get (/* target */ yobj, property, receiver /* proxy */) {
    switch (property) {
      case '__yobj': return yobj // target object
      case '__value': return yobj.value // raw value
      case '_parent': return yobj._parent // object proxy
      case 'toString': return (...args) => yobj.value.toString.apply(yobj.value, args)
      case 'valueOf': return () => yobj.value.valueOf()
      case Symbol.toPrimitive: return (/* hint */) => {throw 'Symbol.toPrimitive'} // targetYObject.valueOf()
      case Symbol.isConcatSpreadable: return yobj.valueType === 'array'
    } // else
    return this.getMember(yobj, property, receiver)
  }

  getMember (/* target */ yobj, property, receiver /* proxy */) {
    if (yobj.hasVirtual(property)) {
      return yobj.callVirtual(property)
    } // else
    if (yobj.hasProperty(property)) {
      const prop = yobj.getProperty(property)
      if (prop instanceof YObject) {
        if (prop instanceof YList) return prop.scopeProxy
        if (prop.frameType === 'primitive' || prop.valueType === 'function') return prop.value
        return prop.proxy
      } // else
      return prop
    } // else
    // return undefined
  }

  has (/* target */ yobj, property) {
    // maybe needed to support concat spread for arrays?
    if (proxyMethodNames.includes(property)) {
      return true
    }
    if (yobj.hasVirtual(property)) {
      return true
    } // else
    if (yobj.hasProperty(property)) {
      return true
    }
  }
}

const proxyMethodNames = ['__yobj', '__value', '_parent', 'toString', 'valueOf', Symbol.toPrimitive]
const scopeProxyMethodNames = proxyMethodNames.concat(['__scope', '_index', '_index0', '_punc', '_result'])

/*
  ScopeHandler is a Proxy handler for runtime proxies of context scope frames.
  There need only ever be one instance of this class (const scopeChainHandler).
*/
class ScopeHandler extends YObjectHandler {
  get (/* target */ yobj, property, receiver /* proxy */) {
    // for certain specific properties, we bypass searching up the context stack:
    switch (property) {
      case '__scope':  return true
      case '__yobj': return yobj
      case '__value': return yobj.value
      case '_parent': return yobj._parent
      case '_index': return yobj.index
      case '_index0': return yobj.index0
      case '_punc': return yobj.punc
      case '_result': return yobj.result
      case 'toString': return (...args) => yobj.value.toString.apply(yobj.value, args)
      case 'valueOf': return () => yobj.value.valueOf()
      case Symbol.toPrimitive: return (hint) => yobj[Symbol.toPrimitive](hint)
      case Symbol.isConcatSpreadable: return yobj.valueType === 'array'
    }
    // otherwise we walk up the context stack, searching for the requested property:
    let thisFrame = yobj
    while (thisFrame) {
      if (super.has(thisFrame, property)) {
        return super.getMember(thisFrame, property, receiver)
      }
      // else keep walking the stack...
      thisFrame = thisFrame.parent
    }
  }

  has (/* target */ yobj, property) {
    // trap needed to support concat spread for arrays!  (who knew?)
    if (scopeProxyMethodNames.includes(property)) {
      return true
    }
    let thisFrame = yobj
    while (thisFrame) {
      if (super.has(thisFrame, property)) {
        return true
      }
      // else keep walking the stack...
      thisFrame = thisFrame.parent
    }
  }
}

const scopeChainHandler = new ScopeHandler()
const yobjectHandler = new YObjectHandler()
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