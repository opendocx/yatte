/* eslint-disable no-multi-spaces */
const expressions = require('angular-expressions')
const dateFns = { format: require('date-fns/format') }
const numeral = require('numeral')
const numWords = require('number-to-words-en')
const base = require('./base-templater')
const Scope = require('./yobj')
const { unEscapeQuotes } = require('./estree')
const deepEqual = require('fast-deep-equal')

if (dateFns.format.__esModule) {
  dateFns.format = dateFns.format.default
}

module.exports = expressions.filters

// define built-in filters (both regular filters and "list" filters)
// (the distinction between regular and list filters is NOT whether input or output is a list, but rather,
//  whether the filter accepts or expects an anonymous expression (predicate) as an argument or not.
//  List filters have a predicate argument, regular filters do not.)
// regular filters:
expressions.filters.upper = Upper           // text -> text
expressions.filters.lower = Lower           // text -> text
expressions.filters.initcap = Initcap       // text -> text
expressions.filters.titlecaps = Titlecaps   // text -> text
expressions.filters.format = Format         // number/date/trueFalse -> text
expressions.filters.cardinal = Cardinal     // number -> text
expressions.filters.cardinaldec = CardinalDec // number -> text
expressions.filters.cardinalcur = CardinalCur // number -> text
expressions.filters.ordinal = Ordinal       // number -> text
expressions.filters.ordsuffix = Ordsuffix   // number -> text
// expressions.filters.truncate = Truncate     // number -> number
// expressions.filters.round = Round           // number -> number
// expressions.filters.integer = Integer       // number -> number
// expressions.filters.fractional = Fractional // number -> number
expressions.filters.else = Else             // text/number/date/trueFalse -> same/text
expressions.filters.contains = Contains     // text/list -> trueFalse
expressions.filters.punc = Punc             // list -> list of same
expressions.filters.keepsections = KeepSections // indirect -> indirect
// list filters (arrayFilter == true):
expressions.filters.sort = Sort             // list -> list of same
expressions.filters.filter = Filter         // list -> list of same
expressions.filters.find = Find             // list -> single item of same
expressions.filters.any = Any               // list -> trueFalse
expressions.filters.some = Any              // list -> trueFalse
expressions.filters.every = Every           // list -> trueFalse
expressions.filters.all = Every             // list -> trueFalse
expressions.filters.map = MapFilter         // list -> list of anything
expressions.filters.group = Group           // list -> list of buckets, each bucket has _key and _values list
expressions.filters.reduce = Reduce         // list -> anything

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

// const TitleCapRegEx_AsciiOnly = /(^|[^'’]|\W['’])\b([a-z])/gm // not only [a-z], but also \W and \b are ASCII only!
// without \b and \W, this is harder to do...
const TitleCapRegEx = /^\p{Ll}|(?:\s|(?:^|.)\p{P})\p{Ll}/gmu
// 1st case: ^\p{Ll}  - char 0 is lowercase letter
// 2nd case: \s\p{Ll} - char n is whitespace, char n+1 is lowercase letter
// 3rd case: ^\p{P}\p{Ll} - char 0 is punctuation, char 1 lowercase letter
// 4th case: .\p{P}\p{Ll} - char n is ANYTHING (.), char n+1 is punctuation, char n+2 is lowercase letter
//      >> in this case additional logic is required to decide whether it's an exceptional case or not!
const UnicodeWordChar = /\p{L}|\p{N}/u

function Titlecaps (input, forceLower = false) {
  if (!input) return input
  if (typeof input !== 'string') input = input.toString()
  if (forceLower) input = input.toLowerCase()
  return input.replace(TitleCapRegEx, s => {
    // console.log(s)
    if (s.length === 3) { // 4th case above
      return (s[1] === "'" || s[1] === '’') && UnicodeWordChar.test(s[0])
        ? s // EXCEPTION for possessives and mid-word contractions: don't capitalize
        : s.slice(0, 2) + s[2].toUpperCase() // otherwise - do capitalize
    }
    return s.toUpperCase() // all other cases
  })
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
  if (!isFinite(num)) return null
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
  if (!isFinite(quotient)) return null
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
  const num = Number(input)
  if (!isFinite(num)) return null
  return numWords.toWords(num, { useCommas: false })
}

function Ordinal (input) {
  if (input === null || typeof input === 'undefined') return input
  const num = Number(input)
  if (!isFinite(num)) return null
  return numWords.toWordsOrdinal(num, { useCommas: false })
}

function Ordsuffix (input) {
  if (input === null || typeof input === 'undefined') return input
  if (typeof input !== 'number') input = Number(input)
  if (!isFinite(input)) return null
  // English-language exception for 11th, 12th, 13th, 111th, 112th, 113th, 211th, 212th, 213th, etc.
  if (~~(input % 100 / 10) === 1) return 'th'
  switch (input % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function CardinalDec (input, places, zpad, separator) {
  const opts = { places, round: true }
  const num = truncOrRound(input, opts)
  if (num === null || typeof num === 'undefined') return num
  // convert num to string & split into parts
  const str = num.toString() // NOT locale string!
  const parts = str.split('.')
  if (parts.length < 2 && !zpad) { // no fractional part
    return numWords.toWords(num, { useCommas: false })
  }
  places = opts.places
  // check separator
  separator = getStringArg(separator, 'point')
  if (separator === null) return null // invalid (non-string) separator
  let result = numWords.toWords(Number.parseInt(parts[0]), { useCommas: false })
  if (separator) result += ' ' + separator
  const digits = parts.length < 2 ? [] : parts[1].split('')
  let current = 0
  while (current < digits.length) {
    result += ' ' + numWords.toWords(Number.parseInt(digits[current++]))
  }
  if (zpad && current < places) {
    const str0 = ' ' + numWords.toWords(0)
    while (current++ < places) {
      result += str0
    }
  }
  return result
}

function CardinalCur (input, dollarsN, centsN, exactly, separator) {
  // check dollarsN (required string)
  dollarsN = dollarsN && dollarsN.valueOf()
  if (!dollarsN || typeof dollarsN !== 'string') return null
  let [dp, ds] = dollarsN.split('/')
  if (!ds) {
    ds = dp.toLowerCase().endsWith('s') ? dp.slice(0, -1) : dp
  }
  // check centsN (optional string)
  centsN = getStringArg(centsN, '')
  if (centsN === null) return null // unexpected/unsupported value type for centsN
  let [cp, cs] = centsN ? centsN.split('/') : []
  if (cp && !cs) {
    cs = cp.toLowerCase().endsWith('s') ? cp.slice(0, -1) : cp
  }
  // check exactly (optional string, default == '')
  exactly = getStringArg(exactly, '')
  if (exactly === null) return null // invalid (non-string)
  // check separator (optional string, default == 'and')
  separator = getStringArg(separator, 'and')
  if (separator === null) return null // invalid (non-string) separator
  // round input -- either 2 places or 0, depending on centsN
  const num = truncOrRound(input, { places: cp ? 2 : 0, round: true })
  if (num === null || typeof num === 'undefined') return num
  // integer + fractional parts
  const dpart = Math.trunc(num)
  const cpart = Math.round(num % 1 * 100)
  // put string together
  let result = numWords.toWords(dpart, { useCommas: false }) + ' ' + (dpart === 1 ? ds : dp)
  if (cpart) {
    if (separator) {
      result += ' ' + separator
    }
    result += ' ' + numWords.toWords(cpart) + ' ' + (cpart === 1 ? cs : cp)
  } else if (exactly) {
    result += ' ' + exactly
  }
  return result
}

/* function Integer (input, denom) {
  if (input === null || typeof input === 'undefined') return input
  const num = Number(input)
  if (!Number.isFinite(num)) return null
  if (denom === null || typeof denom === 'undefined') {
    denom = 1
  } else {
    denom = Number(denom)
    if (!Number.isFinite(denom) || denom <= 0) return null
  }
  return denom === 1 ? Math.trunc(num) : null
}

function Fractional (input, denom) {
  if (input === null || typeof input === 'undefined') return input
  const num = Number(input)
  if (!Number.isFinite(num)) return null
  if (denom === null || typeof denom === 'undefined') {
    denom = 1
  } else {
    denom = Number(denom)
    if (!Number.isFinite(denom) || denom <= 0) return null
  }
  return num % 1 * denom
}

function Round (input, places) {
  return truncOrRound(input, { places, round: true })
}

function Truncate (input, places) {
  return truncOrRound(input, { places, round: false })
} */

function truncOrRound (number, options) {
  // check number
  if (number === null || typeof number === 'undefined') return number
  const num = Number(number)
  if (!Number.isFinite(num)) return null
  let { places, round } = options
  // check places
  if (places === null || typeof places === 'undefined') {
    places = 0
  } else {
    places = Number(places)
    if (!Number.isFinite(places) || places < 0) return null
  }
  options.places = places
  options.round = Boolean(round)
  // round or truncate as requested
  const factor = Math.pow(10, places)
  return (round ? Math.round(num * factor) : Math.trunc(num * factor)) / factor
}

function getStringArg (str, defValue) {
  if (str && typeof str === 'object') str = str.valueOf()
  if (typeof str === 'string') {
    return str // a string was provided; use it
  } // else
  if (str) return null // invalid argument type
  return defValue // no string provided; use default
}

function Else (input, unansweredFmt) {
  if (input === null || typeof input === 'undefined') return unansweredFmt
  if (typeof input === 'number') {
    if (!isFinite(input)) return unansweredFmt
  }
  return input
}

function Contains (input, value) {
  if (input === null || typeof input === 'undefined' || input === '') return false
  const inputPrimitive = input.valueOf()
  if (typeof inputPrimitive === 'string') {
    return inputPrimitive.includes(value)
  }
  if (input instanceof Scope) throw new Error('Unexpected scope as contains input')
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
  if (!inputList) return inputList
  if (inputList instanceof Scope) throw new Error('Unexpected scope as punc input')
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

function KeepSections (input) {
  if (!input) return input
  if (typeof input !== 'object') return input
  const newInput = input.valueOf()
  if (newInput && (!newInput.contentType || newInput.contentType === 'docx')) {
    newInput.KeepSections = true
  } else {
    console.log('keepsections filter used on something other than a DOCX insert/indirect')
  }
  return newInput
}

// runtime implementation of list filters:

function Sort (input) {
  if (!input) return input
  if (input instanceof Scope) throw new Error('Unexpected scope as sort input')
  if (!Array.isArray(input) || !input.length || arguments.length < 2) return input
  const sortBy = []
  let i = 1
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
    const valA = sortBy[depth].evaluator(a, a) // sort expressions must only  refer to stuff in the current list item
    const valB = sortBy[depth].evaluator(b, b)
    if (valA < valB) { return sortBy[depth].descending ? 1 : -1 }
    if (valA > valB) { return sortBy[depth].descending ? -1 : 1 }
    return compare(a, b, depth + 1)
  }
  return input.slice().sort(compare)
}
Sort.arrayFilter = true

function Filter (input, predicateStr) {
  if (input && input.length === 0) return input
  return callArrayFunc(Array.prototype.filter, input, predicateStr)
}
Filter.arrayFilter = true

function Find (input, predicateStr) {
  if (input && input.length === 0) return null
  return callArrayFunc(Array.prototype.find, input, predicateStr)
}
Find.arrayFilter = true

function Any (input, predicateStr) {
  if (input && input.length === 0) return false
  return callArrayFunc(Array.prototype.some, input, predicateStr)
}
Any.arrayFilter = true
Any.rtlFilter = true

function Every (input, predicateStr) {
  if (input && input.length === 0) return true
  return callArrayFunc(Array.prototype.every, input, predicateStr)
}
Every.arrayFilter = true
Every.rtlFilter = true

function MapFilter (input, mappedStr) {
  return callArrayFunc(Array.prototype.map, input, mappedStr)
}
MapFilter.arrayFilter = true

function Group (input, groupStr) {
  if (!input) return input
  if (input instanceof Scope) throw new Error('Unexpected scope as group input')
  if (!Array.isArray(input) || arguments.length < 2) {
    return input
  }
  if (input.length === 0) return []
  const evaluator = base.compileExpr(unEscapeQuotes(groupStr))
  const grouped = input.reduce(
    (result, item, index) => {
      const yobj = item && item.__yobj
      let key
      if (yobj) {
        key = yobj.evaluate(evaluator)
      } else { // item is a POJO or primitive
        try {
          key = evaluator(item, item) // just evaluate item directly
        } catch (e) {
          if (typeof item !== 'object' && e.toString().toLowerCase().includes('cannot use \'in\' operator')) {
            throw new Error(`Invalid input for 'group' filter: missing context`)
          }
          throw e
        }
      }
      const keyobj = key && key.__yobj // check if the key is a proxy
      if (keyobj) { // if so, get the underlying value
        key = keyobj.bareValue
      }
      key = key && key.valueOf() // ensure wrapped primitives and dates are unwrapped too
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
  return grouped
}
Group.arrayFilter = true

function Reduce (input, reducerStr, initValue = undefined) {
  if (!input) return input
  if (input instanceof Scope) throw new Error('Unexpected scope as reduce input')
  if (!Array.isArray(input) || arguments.length < 2) {
    return input
  }
  if (input.length === 0) return initValue
  // input should now be an array of scope proxy objects (or other plain objects or primitive values)
  const reducer = base.compileExpr(unEscapeQuotes(reducerStr))
  const input0 = input[0]
  const yobj0 = input0 && input0.__yobj
  const list = Scope.pushList(input, yobj0 && yobj0.getParentEffective())
  const reduced = list.items.reduce(
    (result, itemFrame, index) => {
      if (index === 0 && initValue === undefined) {
        return itemFrame.value
      } // else
      const reducerItemFrame = Scope.pushReducerItem(index, list, result)
      return reducerItemFrame.evaluate(reducer)
    },
    initValue
  )
  return reduced
}
Reduce.arrayFilter = true
Reduce.immediateArgs = [1]

// helper functions

function callArrayFunc (func, array, predicateStr) {
  if (!array) return array
  if (array instanceof Scope) throw new Error('Unexpected scope as list filter input')
  if (!Array.isArray(array) || arguments.length < 2) {
    return array // maybe we should throw instead...
  }
  if (typeof predicateStr !== 'string') {
    let filter = 'a list'
    if (callArrayFunc.caller) {
      filter = 'the ' + callArrayFunc.caller.name
    }
    console.log(`Invalid argument passed to ${filter} filter: ${predicateStr}`)
    predicateStr = '' // we should probably throw an error here instead...
  }
  const evaluator = base.compileExpr(unEscapeQuotes(predicateStr))
  const result = func.call(array, (item, index) => {
    // item will TYPICALLY be a scope proxy, but it may not be (depending on where array came from)
    const yobj = item && item.__yobj
    if (yobj) {
      return yobj.evaluate(evaluator) // includes correct handling of primitive values, etc.
    }
    // else item is a POJO or primitive
    try {
      return evaluator(item, item) // just evaluate item directly
    } catch (e) {
      if (typeof item !== 'object' && e.toString().toLowerCase().includes('cannot use \'in\' operator')) {
        throw new Error(`Invalid input for '${func.name}' filter: missing context`)
      }
      throw e
    }
  })
  return result
}
