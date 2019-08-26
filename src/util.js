exports.mergeScopes = mergeScopes
exports.shallowClone = shallowClone
exports.shallowCloneOrWrap = shallowCloneOrWrap
exports.isPrimitiveWrapper = isPrimitiveWrapper
exports.wrapPrimitive = wrapPrimitive
exports.shallowCloneWrappedPrimitive = shallowCloneWrappedPrimitive
exports.wrapWrappedPrimitive = wrapWrappedPrimitive
exports.objInheritsFrom = objInheritsFrom
exports.copyProperties = copyProperties

function mergeScopes (local, parent) {
  //if (local && local.hasOwnProperty('_parent') && local._parent === parent && objInheritsFrom(local, parent)) {
  if (local && objInheritsFrom(local, parent)) {
    console.log('****** mergeScopes called unnecessarily! *********')
    throw new Error('Unexpected: mergeScopes called unnecessarily')
  }
  return shallowClone(local, parent, true, true)
}

/**
 * Returns an object that has shallow-cloned all properties of obj, but which has newProto
 * injected into its prototype chain.  The returned object will appear to have all the properties
 * of both obj AND newProto.
 * 
 * Neither obj nor newProto are modified by this function, but be aware that it uses shallow copying,
 * so subsequent modification of object- or array-type properties will be modifying the properties in the original objects.
 *  
 * @param {object} obj the object to clone 
 * @param {object} newProto the object to use as the new clone's prototype
 * @returns {object}
 */
function shallowClone (obj, newProto, wrapPrimitives = true, alsoRetainObjProto = false) {
  let clone
  if (newProto) {
    if (isPrimitiveWrapper(newProto)) {
      // if the requested new prototype is a wrapped primitive (from which cannot be inherited),
      // swap it out for a regular object with the same properties and a _value property, so it can act as a regular prototype
      newProto = wrapWrappedPrimitive(newProto)
    }
    let oldProto = obj && Object.getPrototypeOf(obj)
    if (alsoRetainObjProto && oldProto && (oldProto !== Object.prototype) && !isPrimitiveWrapper(oldProto)) {
      newProto = shallowClone(oldProto, newProto, false, false)
    }
  } 
  if (typeof obj === 'object' && obj !== null) {
    if (isPrimitiveWrapper(obj)) {
      clone = wrapPrimitives ? wrapWrappedPrimitive(obj, newProto) : shallowCloneWrappedPrimitive(obj)
    } else if (obj === Object.prototype) { // obj is a stock empty object, {}; it has no properties we need to copy
      clone = Object.create(newProto || obj)
    } else { // clone the object, replacing its prototype with newProto if specified
      clone = Object.create(newProto || Object.getPrototypeOf(obj))
      copyProperties(obj, clone)
    }
  } else {
    clone = newProto ? Object.create(newProto) : obj
  }
  return clone
}

function shallowCloneOrWrap (obj) {
  if (obj === null || typeof obj === 'undefined') return obj
  if (typeof obj === 'object') {
    if (isPrimitiveWrapper(obj)) {
      return shallowCloneWrappedPrimitive(obj)
    } else {
      return shallowClone(obj, Object.getPrototypeOf(obj))
    }
  } else {
    return wrapPrimitive(obj)
  }
}

function isPrimitiveWrapper (obj) {
  return (obj !== null) && obj.constructor && ['String', 'Number', 'Boolean'].includes(obj.constructor.name)
}

function wrapPrimitive (value) {
  switch (typeof value) {
    case 'string':
      // eslint-disable-next-line no-new-wrappers
      return new String(value)
    case 'number':
      // eslint-disable-next-line no-new-wrappers
      return new Number(value)
    case 'boolean':
      // eslint-disable-next-line no-new-wrappers
      return new Boolean(value)
    default:
      throw new Error(`${typeof value} is not a primitive`)
  }
}

function shallowCloneWrappedPrimitive (wrappedPrimitive) {
  let clone = wrapPrimitive(wrappedPrimitive.valueOf())
  copyProperties(wrappedPrimitive, clone)
  return clone
}

function wrapWrappedPrimitive(wrappedPrimitive, newProto = {}) {
  const val = wrappedPrimitive.valueOf()
  let newObj = Object.create(newProto)
  copyProperties(wrappedPrimitive, newObj)
  newObj._value = val
  newObj.valueOf = () => this._value
  return newObj
}

function objInheritsFrom(obj, ancestorObj) {
  // eslint-disable-next-line no-cond-assign
  while (obj = Object.getPrototypeOf(obj)) {
    if (obj === ancestorObj) {
      return true
    }
  }
  return false
}

function copyProperties (fromObj, toObj) {
  Object.getOwnPropertyNames(fromObj).filter(n => isNaN(n)).forEach(name => Object.defineProperty(toObj, name, Object.getOwnPropertyDescriptor(fromObj, name)))
}
