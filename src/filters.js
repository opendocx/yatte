const expressions = require('angular-expressions')
const dateFns = { format: require('date-fns/format') }
const numeral = require('numeral')
const numWords = require('number-to-words-en')
const base = require('./base-templater')
const Scope = require('./yobject')
const { AST, unEscapeQuotes } = require('./estree')
const deepEqual = require('fast-deep-equal')

module.exports = expressions.filters

// define built-in filters
expressions.filters.upper = Upper
expressions.filters.lower = Lower
expressions.filters.initcap = Initcap
expressions.filters.titlecaps = Titlecaps
expressions.filters.format = Format
expressions.filters.cardinal = Cardinal
expressions.filters.ordinal = Ordinal
expressions.filters.ordsuffix = Ordsuffix
expressions.filters.else = Else
expressions.filters.contains = Contains
expressions.filters.punc = Punc
expressions.filters.sort = Sort
expressions.filters.filter = Filter
expressions.filters.find = Find
expressions.filters.any = Any
expressions.filters.some = Any
expressions.filters.every = Every
expressions.filters.all = Every
expressions.filters.map = MapFilter
expressions.filters.group = Group
expressions.filters.reduce = Reduce

function Upper (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toUpperCase()
}

function Lower (input) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  return input.toLowerCase()
}

function Initcap (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.charAt(0).toUpperCase() + input.slice(1)
}

function Titlecaps (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.replace(/(^| )(\w)/g, s => s.toUpperCase())
}

class DateFormatFixer {
  constructor (oldDateFormat) {
    this.formatStr = oldDateFormat
  }

  fixed () {
    return this
      .replaceAll('YY', 'yy')
      .replaceAll('D', 'd')
      .replaceAll('[', '\'')
      .replaceAll(']', '\'')
      .formatStr
  }

  replaceAll (find, replaceWith) {
    return new DateFormatFixer(
      this.formatStr.replace(
        new RegExp(find.replace(DateFormatFixer.escRE, '\\$&'), 'g'),
        replaceWith
      )
    )
  }
}
DateFormatFixer.escRE = /[.*+?^${}()|[\]\\]/g

function Format (input, generalFmt, negativeFmt, zeroFmt) {
  if (input === null || typeof input === 'undefined') return input
  if (input instanceof Date) {
    // fix up format string to accommodate differences between date-fns 1.3 and current:
    const newFormat = new DateFormatFixer(generalFmt).fixed()
    return dateFns.format(input, newFormat)
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
  if (num === 0) {
    fmtStr = zeroFmt || generalFmt || '0,0'
  } else if (num < 0) {
    fmtStr = negativeFmt || generalFmt || '0,0'
  } else {
    fmtStr = generalFmt || '0,0'
  }
  if (fmtStr === 'cardinal') {
    return numWords.toWords(num, { useCommas: false })
  }
  if (fmtStr === 'ordinal') {
    return numWords.toWordsOrdinal(num, { useCommas: false })
  }
  if (fmtStr.toLowerCase() === 'a') {
    return base26(num, fmtStr === 'A')
  }
  return numeral(num).format(fmtStr)
}

function base26 (input, upper) {
  if (input === null || typeof input === 'undefined') return input
  const places = []
  let quotient = Number(input)
  let remain, dec
  while (quotient !== 0) {
    dec = quotient - 1
    quotient = Math.floor(dec / 26)
    remain = dec % 26
    places.unshift(remain + 1)
  }
  const codes = places.map(n => n + (upper ? 64 : 96))
  return String.fromCharCode.apply(null, codes)
}

function Cardinal (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWords(Number(input), { useCommas: false })
}

function Ordinal (input) {
  if (input === null || typeof input === 'undefined') return input
  return numWords.toWordsOrdinal(Number(input), { useCommas: false })
}

function Ordsuffix (input) {
  if (input === null || typeof input === 'undefined') return input
  if (typeof input !== 'number') input = Number(input)
  switch (input % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function Else (input, unansweredFmt) {
  if (input === null || typeof input === 'undefined') return unansweredFmt
  return input
}

function Contains (input, value) {
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

function Punc (inputList, example = '1, 2, and 3') {
  if (!inputList || !Array.isArray(inputList) || !inputList.length) return inputList
  const parsed = Scope.parseListExample(example)
  if (parsed) {
    // inputList may be the actual source array (the context stack has not yet been pushed!)
    // so make a shallow copy before adding any custom properties onto the array
    inputList = [...inputList]
    inputList['punc'] = parsed
  }
  return inputList
}

// runtime implementation of list filters:

function Sort (input, scope) {
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
Sort.arrayFilter = true

function Filter (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.filter, input, scope, predicateStr)
}
Filter.arrayFilter = true

function Find (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.find, input, scope, predicateStr)
}
Find.arrayFilter = true

function Any (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.some, input, scope, predicateStr)
}
Any.arrayFilter = true
Any.rtlFilter = true

function Every (input, scope, predicateStr) {
  return callArrayFunc(Array.prototype.every, input, scope, predicateStr)
}
Every.arrayFilter = true
Every.rtlFilter = true

function MapFilter (input, scope, mappedStr) {
  return callArrayFunc(Array.prototype.map, input, scope, mappedStr)
}
MapFilter.arrayFilter = true

function Group (input, scope, groupStr) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 2) {
    return input
  }
  if (!scope) {
    scope = {}
  }
  const evaluator = base.compileExpr(unEscapeQuotes(groupStr))
  let lScope = Scope.pushList(input, scope.__frame)
  const grouped = input.reduce(
    (result, item, index) => {
      lScope = Scope.pushListItem(index, lScope)
      const key = lScope._evaluate(evaluator).toString()
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
Group.arrayFilter = true

function Reduce (input, scope, reducerStr, initValue = undefined) {
  if (!input || !Array.isArray(input) || !input.length || arguments.length < 2) {
    return input
  }
  if (!scope) {
    scope = {}
  }
  const reducer = base.compileExpr(unEscapeQuotes(reducerStr))
  let lScope = Scope.pushList(input, scope.__frame)
  const reduced = input.reduce(
    (result, item, index) => {
      lScope = Scope.pushReducerItem(index, lScope, result)
      const newResult = lScope._evaluate(reducer)
      lScope = Scope.pop(lScope)
      return newResult
    },
    initValue
  )
  lScope = Scope.pop(lScope)
  return reduced
}
Reduce.arrayFilter = true
Reduce.immediateArgs = [1]

// helper functions

function callArrayFunc (func, array, scope, predicateStr) {
  if (!array || !Array.isArray(array) || !array.length || arguments.length < 2) {
    return array
  }
  if (!scope) {
    scope = {}
  }
  const evaluator = base.compileExpr(unEscapeQuotes(predicateStr))
  const justThis = evaluator.ast.type === AST.ThisExpression
  // predicateStr can refer to built-in properties _index, _index0, or _parent.
  // These need to evaluate to the correct thing.
  // It can also refer to this, which should refer to the current array element (even if it's a primitive)
  let lScope = Scope.pushList(array, scope.__frame)
  const result = func.call(array, (item, index) => {
    lScope = Scope.pushListItem(index, lScope)
    const subResult = (justThis && (!lScope._value || (lScope._objType === Scope.PRIMITIVE)))
      ? item
      : lScope._evaluate(evaluator)
    lScope = Scope.pop(lScope)
    return subResult
  })
  lScope = Scope.pop(lScope)
  return result
}
