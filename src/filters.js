const expressions = require('angular-expressions')
const format = require('date-fns/format')
const numeral = require('numeral')
const numWords = require('number-to-words')
const { unEscapeQuotes } = require('./estree')
const { mergeScopes, wrapPrimitive } = require('./util')
const deepEqual = require('fast-deep-equal')

// define built-in filters
expressions.filters.upper = function (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toUpperCase()
}
expressions.filters.lower = function (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toLowerCase()
}
expressions.filters.initcap = function (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.charAt(0).toUpperCase() + input.slice(1)
}
expressions.filters.titlecaps = function (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.replace(/(^| )(\w)/g, s => s.toUpperCase())
}
expressions.filters.format = function (input, generalFmt, negativeFmt, zeroFmt) {
  if (input === null || typeof input === 'undefined') return input
  if (input instanceof Date) {
    return format(input, generalFmt)
  }
  if (typeof input === 'boolean' || input instanceof Boolean) {
    input = input.valueOf()
    if (generalFmt || negativeFmt) {
      generalFmt = generalFmt ? String(generalFmt) : ''
      negativeFmt = negativeFmt ? String(negativeFmt) : ''
      return input ? generalFmt : negativeFmt
    } // else
    return input ? 'true' : 'false'
  }
  // else number
  const num = Number(input)
  let fmtStr
  if (num == 0) {
    fmtStr = zeroFmt || generalFmt || '0,0'
  } else if (num < 0) {
    fmtStr = negativeFmt || generalFmt || '0,0'
  } else {
    fmtStr = generalFmt || '0,0'
  }
  if (fmtStr === 'cardinal') {
    return numWords.toWords(num)
  }
  if (fmtStr === 'ordinal') {
    return numWords.toWordsOrdinal(num)
  }
  return numeral(num).format(fmtStr)
}
expressions.filters.cardinal = function (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWords(Number(input))
}
expressions.filters.ordinal = function (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWordsOrdinal(Number(input))
}
expressions.filters.ordsuffix = function (input) {
  if (input === null || typeof input === 'undefined') return input
  if (typeof input !== 'number') input = Number(input)
  switch (input % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
expressions.filters.else = function (input, unansweredFmt) {
  if (input === null || typeof input === 'undefined') return unansweredFmt
  return input
}

expressions.filters.contains = function (input, value) {
  if (input === null || typeof input === 'undefined' || input === '') return false
  if (!isIterable(input)) return false
  if (typeof input === 'string') {
    return input.includes(value.toString())
  }
  value = value && value.valueOf()
  for (const item of input) {
    if (deepEqual(item && item.valueOf(), value)) {
      return true
    }
  }
  return false
}

expressions.filters.punc = function (inputList, example = '1, 2 and 3') {
  if (!inputList || !Array.isArray(inputList) || !inputList.length) return inputList
  const p1 = example.indexOf('1')
  const p2 = example.indexOf('2')
  const p3 = example.indexOf('3')
  if (p1 >= 0 && p2 > p1) {
    // inputList may be the actual source array (the context stack has not yet been pushed!)
    // so make a shallow copy before adding any custom properties onto the array
    inputList = [...inputList]
    const between = example.slice(p1 + 1, p2)
    if (p3 > p2) {
      const last2 = example.slice(p2 + 1, p3)
      let only2
      if (last2 !== between && last2.startsWith(between)) // as with an oxford comma: "1, 2, and 3"
      { only2 = last2.slice(between.trimRight().length) } else { only2 = last2 }
      const suffix = example.slice(p3 + 1)
      inputList['punc'] = { between, last2, only2, suffix }
    } else if (p3 < 0) {
      const suffix = example.slice(p2 + 1)
      inputList['punc'] = { between, last2: between, only2: between, suffix }
    }
  }
  return inputList
}

// runtime implementation of list filters:

// scope and locals are not currently used because sort expressions must only refer to stuff in the current list item
// eslint-disable-next-line no-unused-vars
expressions.filters.sort = function (input, scope, locals) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 3) return input
  const sortBy = []
  let i = 3
  while (i < arguments.length) {
    const argument = unEscapeQuotes(arguments[i++])
    sortBy.push({
      descending: argument[0] === '-',
      evaluator: expressions.compile('+-'.includes(argument[0]) ? argument.substr(1) : argument)
    })
  }
  function compare (a, b, depth) {
    if (!depth) {
      depth = 0
    }
    if (depth >= sortBy.length) { return 0 }
    const valA = sortBy[depth].evaluator(a)
    const valB = sortBy[depth].evaluator(b)
    if (valA < valB) { return sortBy[depth].descending ? 1 : -1 }
    if (valA > valB) { return sortBy[depth].descending ? -1 : 1 }
    return compare(a, b, depth + 1)
  }
  return input.slice().sort(compare)
}
expressions.filters.filter = function (input, scope, locals, predicateStr) {
  return callArrayFunc(Array.prototype.filter, input, scope, locals, predicateStr)
}
expressions.filters.find = function (input, scope, locals, predicateStr) {
  return callArrayFunc(Array.prototype.find, input, scope, locals, predicateStr)
}
expressions.filters.any = function (input, scope, locals, predicateStr) {
  return callArrayFunc(Array.prototype.some, input, scope, locals, predicateStr)
}
expressions.filters.some = expressions.filters.any // alias
expressions.filters.every = function (input, scope, locals, predicateStr) {
  return callArrayFunc(Array.prototype.every, input, scope, locals, predicateStr)
}
expressions.filters.all = expressions.filters.every // alias
expressions.filters.map = function (input, scope, locals, mappedStr) {
  return callArrayFunc(Array.prototype.map, input, scope, locals, mappedStr)
}
expressions.filters.group = function (input, scope, locals, groupStr) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 2) {
    return input
  }
  const evaluator = expressions.compile(unEscapeQuotes(groupStr))
  return input.reduce(
    (result, item) => {
      const key = evaluator(mergeScopes(locals, scope), ['string', 'number', 'boolean'].includes(typeof item) ? wrapPrimitive(item) : item)
      let bucket = result.find(b => b._key === key)
      if (!bucket) {
        bucket = { _key: key, _values: [] }
        result.push(bucket)
      }
      bucket._values.push(item)
      return result
    },
    []
  )
}

function callArrayFunc (func, array, scope, locals, predicateStr) {
  if (!array || !Array.isArray(array) || !array.length || arguments.length < 2) {
    return array
  }
  const evaluator = expressions.compile(unEscapeQuotes(predicateStr))
  // predicateStr can refer to built-in properties _index, _index0, or _parent. These need to evaluate to the correct thing.
  return func.call(array, (item, index) => {
    let newScope = locals ? scope ? mergeScopes(locals, scope) : locals : scope || {}
    //let itemScope = locals ? ((locals._parent === scope) ? locals : mergeScopes(locals, scope)) : scope
    return evaluator(newScope, pseudoListFrame(item, index, newScope))
  })
}

function pseudoListFrame (item, index, parent) {
  var result
  switch (typeof item) {
    case 'string':
      result = new String(item)
      break
    case 'number':
      result = new Number(item)
      break
    case 'boolean': 
      result = new Boolean(item)
      break
    case 'object':
      result = item && Object.create(item)
      break
    default:  // unusual or unexpected
      result = item
      break
  }
  if (result && typeof result === 'object') {
    Object.defineProperties(result, {
      _index0: { value: index },
      _index: { value: index + 1 },
      _parent: { value: parent } // todo: see if this _parent link is redundant all the time, or only some of the time.  It can be redundant when MergeParentScope has been used to merge a local scope with a parent scope.
    })
  }
  return result
}

function isIterable (val) {
  return (val != null && (
    (typeof Symbol !== 'undefined' && Symbol && 'iterator' in Symbol && 'function' === typeof val[Symbol.iterator])
    || ('function' === typeof val['@@iterator'])
  ))
}
