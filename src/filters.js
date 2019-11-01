const expressions = require('angular-expressions')
const dateFormat = require('date-fns/format')
const numeral = require('numeral')
const numWords = require('number-to-words')
const base = require('./base-templater')
const Scope = require('./scope')
const { unEscapeQuotes } = require('./estree')
const deepEqual = require('fast-deep-equal')

// define built-in filters
expressions.filters.upper = upper
expressions.filters.lower = lower
expressions.filters.initcap = initcap
expressions.filters.titlecaps = titlecaps
expressions.filters.format = format
expressions.filters.cardinal = cardinal
expressions.filters.ordinal = ordinal
expressions.filters.ordsuffix = ordsuffix
expressions.filters.else = elseFunc
expressions.filters.contains = contains
expressions.filters.punc = punc
expressions.filters.sort = sort
expressions.filters.filter = filter
expressions.filters.find = find
expressions.filters.any = any
expressions.filters.some = any
expressions.filters.every = every
expressions.filters.all = every
expressions.filters.map = map
expressions.filters.group = group

function upper (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toUpperCase()
}

function lower (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toLowerCase()
}

function initcap (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.charAt(0).toUpperCase() + input.slice(1)
}

function titlecaps (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.replace(/(^| )(\w)/g, s => s.toUpperCase())
}

function format (input, generalFmt, negativeFmt, zeroFmt) {
  if (input === null || typeof input === 'undefined') return input
  if (input instanceof Date) {
    return dateFormat(input, generalFmt)
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

function cardinal (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWords(Number(input))
}

function ordinal (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWordsOrdinal(Number(input))
}

function ordsuffix (input) {
  if (input === null || typeof input === 'undefined') return input
  if (typeof input !== 'number') input = Number(input)
  switch (input % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function elseFunc (input, unansweredFmt) {
  if (input === null || typeof input === 'undefined') return unansweredFmt
  return input
}

function contains (input, value) {
  if (input === null || typeof input === 'undefined' || input === '') return false
  if (typeof input === 'string') {
    return input.includes(value.toString())
  }
  if (!Scope.isIterable(input)) return false
  value = value && value.valueOf()
  for (const item of input) {
    if (deepEqual(item && item.valueOf(), value)) {
      return true
    }
  }
  return false
}

function punc (inputList, example = '1, 2 and 3') {
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

function sort (input, scope) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 3) return input
  if (!scope) scope = {}
  const sortBy = []
  let i = 2
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
    const valA = sortBy[depth].evaluator(a) // sort expressions must only  refer to stuff in the current list item
    const valB = sortBy[depth].evaluator(b)
    if (valA < valB) { return sortBy[depth].descending ? 1 : -1 }
    if (valA > valB) { return sortBy[depth].descending ? -1 : 1 }
    return compare(a, b, depth + 1)
  }
  return input.slice().sort(compare)
}

function filter (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.filter, input, scope, predicateStr)
}

function find (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.find, input, scope, predicateStr)
}

function any (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.some, input, scope, predicateStr)
}

function every (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.every, input, scope, predicateStr)
}

function map (input, scope, mappedStr) {
  return callArrayFunc(Array.prototype.map, input, scope, mappedStr)
}

function group (input, scope, groupStr) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 2) {
    return input
  }
  if (!scope) {
    scope = {}
  }
  const evaluator = base.compileExpr(unEscapeQuotes(groupStr))
  let lScope = Scope.pushList(input, scope.__scope, 'group')
  const grouped = input.reduce(
    (result, item, index) => {
      lScope = Scope.pushListItem(index, lScope, 'o' + index)
      const key = lScope._evaluate(evaluator).toString() // ['string', 'number'].includes(typeof item) ? evaluator(item) : evaluator(scope, item)
      let bucket = result.find(b => b._key === key)
      if (!bucket) {
        bucket = { _key: key, _values: [] }
        result.push(bucket)
      }
      bucket._values.push(item)
      lScope = Scope.pop(lScope)
      return result
    },
    []
  )
  lScope = Scope.pop(lScope)
  return grouped
}

// helper functions

function callArrayFunc (func, array, scope, predicateStr) {
  if (!array || !Array.isArray(array) || !array.length || arguments.length < 2) {
    return array
  }
  if (!scope) {
    scope = {}
  }
  const evaluator = base.compileExpr(unEscapeQuotes(predicateStr))
  // predicateStr can refer to built-in properties _index, _index0, or _parent. These need to evaluate to the correct thing.
  let lScope = Scope.pushList(array, scope.__scope, func.name)
  const result = func.call(array, (item, index) => {
    lScope = Scope.pushListItem(index, lScope, 'o' + index)
    const subResult = lScope._evaluate(evaluator)
    lScope = Scope.pop(lScope)
    return subResult
  })
  lScope = Scope.pop(lScope)
  return result
}
