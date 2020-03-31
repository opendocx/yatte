'use strict'
const EvaluationResult = require('./eval-result')
const { AST } = require('./estree')

class YObject {
  constructor (value, parent = null) {
    // value can be:
    //   - null
    //   - a string or String object
    //   - a number or Number object
    //   - a boolean or Boolean object
    //   - a Date object                 (frameType=YObject.PRIMITIVE for this and all of the above)
    //   - any other single object       (frameType=YObject.OBJECT)
    //   - an array of any of the above  (frameType=YObject.LIST)
    if (value && (value.__yobj || (value instanceof YObject))) throw new Error('Cannot nest a YObject inside another')
    if (parent) {
      if (typeof parent === 'function') {
        // the function needs to return an instanceof YObject!
      } else {
        if (!(parent instanceof YObject)) throw new Error('Parent must be an instance of YObject')
      }
    }
    this.parent = parent
    this.frameType = (isPrimitive(value) || value === null)
      ? YObject.PRIMITIVE
      : YObject.isArray(value)
        ? YObject.LIST
        : YObject.OBJECT
    this.valueType = typeof value
    switch (this.valueType) {
      case 'object':
        if (!value) {
          this.value = null
          this.valueType = 'null'
        } else {
          if (this.frameType === YObject.PRIMITIVE) {
            this.valueType = value.constructor.name.toLowerCase()
            this.value = value
          } else if (this.frameType === YObject.LIST) {
            this.valueType = 'array'
            const len = value && value.length
            if (len && value[len - 1] && value[len - 1].__yobj) {
              // the array contains proxy objects -- extract raw values from them
              this.value = value.map(element => (element && element.__yobj) ? element.__value : element)
              // (because items in the list will get a new context from the list & its parents)
            } else {
              this.value = value
            }
          } else {
            // valueType is already correct
            this.value = value
          }
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

  hasParent (yobj) {
    let thisFrame = this.parent
    if (typeof thisFrame === 'function') {
      thisFrame = thisFrame()
    }
    while (thisFrame && (thisFrame !== yobj)) {
      thisFrame = thisFrame.parent
      if (typeof thisFrame === 'function') {
        thisFrame = thisFrame()
      }
    }
    return thisFrame === yobj
  }

  getParent () {
    return (typeof this.parent === 'function') ? this.parent() : this.parent
  }

  getParentEffective () {
    return this.getParent()
  }

  hasProperty (property) {
    return this.value && (typeof this.value === 'object') && (property in this.value)
  }

  getProperty (property, curriedParent = undefined) {
    // a caller is fetching some property value of the YObject, typically during evaluation.
    // first check for child YObjects
    const yobj = this.getChildYObject(property, curriedParent)
    if (yobj) {
      return (yobj instanceof YList) ? yobj.scopeProxy : yobj.proxy
    }
    // else get the value
    const val = this.value[property]
    // check if it's a virtual, and if so, evaluate it
    if (typeof val === 'function' && (val.ast || val.logic)) {
      let newVal = this.evaluate(val)
      if (newVal instanceof EvaluationResult) {
        newVal = newVal.value
      }
      // I believe newVal, at this point, may be either a primitive or an object proxy
      return newVal
    }
    // else just return it
    return val
  }

  getChildYObject (property, curriedParent = undefined) {
    // a caller is fetching the YObject for a child scope
    let val = this.items[property]
    if (val) { // we already have a cached YObject; return it
      return val
    }
    // else get the value
    val = this.value[property]
    // if it's empty, a raw primitive or a function, return nothing
    if (!val || isPrimitive(val, false) || (typeof val === 'function')) {
      return
    }
    // if it's already a proxy, return its underlying YObject
    let yobj = val.__yobj
    if (yobj) {
      return yobj
    }
    // create a YObject wrapper for the item, and cache it in items
    // (original item still availabe in value/__value)
    yobj = YObject.isIterable(val)
      ? new YList(val, curriedParent || this)
      : new YObject(val, curriedParent || this)
    this.items[property] = yobj
    return yobj
  }

  evaluate (compiledVirtual) {
    if (typeof compiledVirtual === 'function') {
      if (compiledVirtual.ast) {
        // appears to be a compiled angular expression; it expects a scope object (proxy)
        const result = compiledVirtual(this.scopeProxy)
        const yobj = result  && result.__scope && result.__yobj
        const frameType = yobj && yobj.frameType
        if (frameType === YObject.LIST) {
          // it's an array proxy of scope proxies; just return it
          return result
        }
        // check for array return values, wrap them in a YList, and return a proxy
        if (Array.isArray(result) && !(this instanceof YReducerItem)) {
          return (new YList(result, this)).scopeProxy
        }
        // else check for proxied primitives we may need to unwrap
        if (frameType === YObject.PRIMITIVE) {
          return yobj.valueType === 'null'
            ? yobj.bareValue // nothing else can be done with a null
            : yobj.proxy // but we may still need to look up properties of other "hybrid" objects!
        }
        // else just return the value
        return result
      } // else
      if (compiledVirtual.logic) {
        // appears to be a compiled template; it expects a scope frame (not a proxy)
        const result = compiledVirtual(this)
        return result && result.valueOf()
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
    return (
      this.valueType === 'function'
        ? this.value
        : this._proxy || (this._proxy = new Proxy(this, yobjectHandler))
    )
  }

  get scopeProxy () {
    return (
      this.valueType === 'function'
        ? this.value
        : this._scopeProxy || (this._scopeProxy = new Proxy(this, scopeChainHandler))
    )
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
    return this.value && this.value.valueOf()
  }

  get bareValue () { // for "unwrapping" wrapped primitives. Differs from valueOf in handling of dates.
    switch (this.valueType) {
      case 'string':
      case 'number':
      case 'boolean':
        return this.value && this.value.valueOf()
    }
    return this.value
  }

  get _parent () {
    const parent = this.getParentEffective()
    return parent && parent.scopeProxy
    // note: _parent needs to return a scopeProxy (rather than a regular proxy) so _index will be available on it
  }

  static empty (thatScope) {
    return !thatScope || !(thatScope instanceof YObject)
  }

  static pop (thatScope) {
    if (YObject.empty(thatScope)) return null
    return thatScope.getParent()
  }

  static pushObject (value, parent = null) {
    let yobj
    if (parent) { // replace value's evaluation context (if it has any) with explicitly-supplied parent
      if (parent.__yobj) {
        throw new Error('parent must not be a proxy')
      }
      let obj = value && value.__value // in case it's a proxy
      if (!obj) {
        obj = (value instanceof YObject) ? value.value : value
      }
      yobj = new YObject(obj, parent)
    } else { // no parent passed in... so preserve value's parents (evaluation context) if available
      yobj = value && value.__yobj
      if (!yobj) {
        yobj = (value instanceof YObject) ? value : new YObject(value)
      }
    }
    return yobj
  }

  static parentMatch (parent1, parent2) {
    let match = parent1 === parent2
    if (!match) {
      if (typeof parent1 === 'function') {
        parent1 = parent1()
        match = parent1 === parent2
      }
      if (!match) {
        if (typeof parent2 === 'function') {
          parent2 = parent2()
          match = parent1 === parent2
        }
      }
    }
    return match
  }

  static pushList (iterable, parent) {
    if (parent && parent.__yobj) {
      throw new Error('parent must be a YObject, not a proxy')
    }
    let array
    const yobj = iterable && iterable.__yobj
    if (yobj) { // it's a list proxy (result of evaluating an expression)
      if (YObject.parentMatch(yobj.parent, parent)) { // it already has the correct/desired context
        return iterable.__yobj // just go with what we've already got
      }
      // else
      console.log('pushList called with out-of-context proxy')
      array = iterable.__yobj.value
    }
    if (!array) {
      if (iterable instanceof YList) {
        if (YObject.parentMatch(iterable.parent, parent)) {
          return iterable
        }
        console.log('pushList called with out-of-context list')
        array = iterable.value
      }
    }
    return new YList(array || iterable, parent)
  }

  static pushListItem (index0, parentList) {
    // YListItems have already been created, we just return the existing ones
    if (typeof parentList === 'function') {
      const parent = parentList()
      if (parent.__yobj) {
        throw new Error('parentList must be a YList, not a proxy')
      }
      const item = parent.items[index0]
      // however, we fix up the parent reference if necessary
      if (item.parent !== parentList) {
        item.parent = parentList
      }
      return item
    } // else
    if (parentList.__yobj) {
      throw new Error('parentList must be a YList, not a proxy')
    }
    return parentList.items[index0]
  }

  static pushReducerItem (index0, parentList, result) {
    return new YReducerItem(index0, parentList, result)
  }

  static parseListExample (example) {
    const p1 = example.indexOf('1')
    const p2 = example.indexOf('2')
    const p3 = example.indexOf('3')
    if (p1 >= 0 && p2 > p1) { // at least 1 & 2 are present and in the right order (minimum for valid example)
      // const prefix = example.slice(0, p1)
      // you may wonder why we don't bother remembering the stuff prior to the "1" token (if any)
      // It's because right now, this stuff only gets merged into assembled content at the location where
      // the template compiler has placed a {[_punc]} field, and no _punc field gets added at the beginning
      // of a list item.  In fact, it kinda raises the question of how appropriate it is to support the suffix,
      // as we do, because if there are NO items in the list, you might expect the suffix to be merged anyway,
      // but it's not -- it only gets merged as a suffix to the last item in the list.  If we wanted to add a
      // prefix, but still be consistent, we'd need the prefix to only be merged as a prefix to the first item,
      // and if there were no items, you'd get neither prefix nor suffix.
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
  constructor (iterable, parent) {
    let array
    if (iterable) {
      array = Array.isArray(iterable) ? iterable : Array.from(iterable)
      // we used to make a copy of the array always so as not to modify the original,
      // but that may no longer be necessary
    } else {
      array = []
    }
    super(array, parent)
    this.punc = iterable ? iterable.punc : null
    // for YLists, items needs to be an array instead of an object:
    this.items = this.indices.map(index0 => new YListItem(index0, this)) // array of YListItems
  }

  /**
   * returns a plain value (no evaluation context)
   * @param {number} index
   */
  getListValue (index) {
    return this.value[index]
  }

  /**
   * returns a YListItem (value + evaluation context)
   * @param {number} index
   */
  getListItem (index) {
    return this.items[index]
  }

  get indices () {
    return indices((this.value && this.value.length) || 0)
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
    // this is either called from the YList constructor (directly)
    // OR from the YReducerItem constructor, which is called from pushReducerItem.
    if (!parentList || !((parentList instanceof YList) || (typeof parentList === 'function'))) {
      throw new Error('List context expected')
    }
    const parent = (typeof parentList === 'function') ? parentList() : parentList
    let element = parent.getListValue(index0)
    if (element && element.__yobj) { // oops, a proxy object made its way to here
      element = element.__value // strip the proxy, as this list item will inherit new context from its parent
    }
    if (element instanceof YObject) {
      throw new Error('Unexpected YObject in list value')
    }
    super(element, parentList)
    this.index0 = index0
  }

  getParentEffective () {
    // A list item's "effective" parent is the parent list's parent.
    return this.getParent().getParent()
  }

  get index () {
    return this.index0 + 1
  }

  get punc () {
    const index0 = this.index0
    const parent = this.getParent()
    const lastItem = parent.value.length - 1
    const punc = parent.punc
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
      case '__scope': return this.scopeProxies
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
      case 'valueOf': return () => yobj.value && yobj.value.valueOf()
      case Symbol.toPrimitive: return (hint) => yobj[Symbol.toPrimitive](hint)
      case Symbol.isConcatSpreadable: return yobj.valueType === 'array'
    } // else
    return this.getMember(yobj, property, receiver)
  }

  getMember (/* target */ yobj, property, receiver /* proxy */) {
    // always returns a proxy object, i.e., suitable for further evaluation
    // if (yobj.hasProperty(property)) {
    return yobj.getProperty(property)
    // } // else
    // return undefined
  }

  has (/* target */ yobj, property) {
    // maybe needed to support concat spread for arrays?
    if (proxyMethodNames.includes(property)) {
      return true
    }
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
      case 'valueOf': return () => yobj.value && yobj.value.valueOf()
      case Symbol.toPrimitive: return (hint) => yobj[Symbol.toPrimitive](hint)
      case Symbol.isConcatSpreadable: return yobj.valueType === 'array'
    }
    // otherwise we walk up the context stack, searching for the requested property:
    let thisFrame = yobj
    while (thisFrame) {
      if (super.has(thisFrame, property)) {
        const member = super.getMember(thisFrame, property, receiver)
        if (member) {
          const yo = member.__yobj
          if (yo) {
            // we need to return its value, but retain the full, originial context
            // check if the context we need (yobj) is already part of member's context!
            if (!yo.hasParent(yobj)) {
              if (yo instanceof YList) {
                return (new YList(yo.value, yobj)).scopeProxy
              } else {
                return (new YObject(yo.value, yobj)).scopeProxy
              }
            }
          }
        }
        return member
      }
      // else keep walking the stack...
      thisFrame = thisFrame.parent
      if (typeof thisFrame === 'function') {
        thisFrame = thisFrame()
      }
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
      if (typeof thisFrame === 'function') {
        thisFrame = thisFrame()
      }
    }
  }
}

const scopeChainHandler = new ScopeHandler()
const yobjectHandler = new YObjectHandler()
const primitiveConstructors = [String, Number, Boolean, Date]

function indices (length) {
  return new Array(length).fill(undefined).map((value, index) => index)
}

function isPrimitive (value, includeWrapped = true) {
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true
    case 'object':
      if (includeWrapped) {
        if (value && value.constructor && primitiveConstructors.includes(value.constructor)) {
          return true
        }
      } else if (value && (value instanceof Date)) {
        return true
      }
  }
  return false
}
