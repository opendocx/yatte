const expressions= require('angular-expressions')
const format = require('date-fns/format')
const dateparse = require('date-fns/parse')
const numeral = require('numeral')
const numWords = require('number-to-words')

// define built-in filters (todo: more needed)
expressions.filters.upper = function(input) {
    if(!input) return input
    if (typeof input !== 'string') input = input.toString()
    return input.toUpperCase()
}
expressions.filters.lower = function(input) {
    if(!input) return input
    if (typeof input !== 'string') input = input.toString()
    return input.toLowerCase()
}
expressions.filters.initcap = function(input, forceLower = false) {
    if(!input) return input
    if (typeof input !== 'string') input = input.toString()
    if (forceLower) input = input.toLowerCase()
    return input.charAt(0).toUpperCase() + input.slice(1)
}
expressions.filters.titlecaps = function(input, forceLower = false) {
    if(!input) return input
    if (typeof input !== 'string') input = input.toString()
    if (forceLower) input = input.toLowerCase()
    return input.replace(/(^| )(\w)/g, s => s.toUpperCase())
}
expressions.filters.date = function(input, fmtStr) {
    if(!input) return input
    if (!(input instanceof Date)) input = dateparse(input)
    return format(input, fmtStr)
}
expressions.filters.number = function(input, positiveFmt, negativeFmt, zeroFmt) {
    if (input === null || typeof input === 'undefined') return input
    const num = Number(input)
    let fmtStr
    if (num == 0) {
        fmtStr = zeroFmt || positiveFmt || '0,0'
    } else if (num < 0) {
        fmtStr = negativeFmt || positiveFmt || '0,0'
    } else {
        fmtStr = positiveFmt || '0,0'
    }
    if (/^[a-zA-Z]/.test(fmtStr)) { // starts with a letter --> spelled out number
        if (fmtStr[0].toLowerCase()==='o') { // starts with an 'o' --> ordinal
            return numWords.toWordsOrdinal(num)
        } // else
        return numWords.toWords(num)
    } // else
    const n = numeral(num)
    return n.format(fmtStr)
}
expressions.filters.ordsuffix = function(input) {
    if (input === null || typeof input === 'undefined') return input
    if (typeof input !== 'number') input = Number(input)
    switch (input % 10) {
        case 1: return "st"
        case 2: return "nd"
        case 3: return "rd"
        default: return "th"
    }
}
expressions.filters.tf = function(input, trueStr, falseStr) {
    if (input === null || typeof input === 'undefined') return input
    const bool = Boolean(input)
    if (trueStr || falseStr) {
        trueStr = trueStr ? String(trueStr) : ''
        falseStr = falseStr ? String(falseStr) : ''
        return bool ? trueStr : falseStr
    } // else
    return bool ? 'true' : 'false'
}
expressions.filters.else = function(input, unansweredFmt) {
    if (input === null || typeof input === 'undefined') return unansweredFmt
    return input;
}

expressions.filters.punc = function(inputList, example = '1, 2 and 3') {
    if(!inputList || !Array.isArray(inputList) || !inputList.length) return inputList;
    let p1 = example.indexOf('1')
    let p2 = example.indexOf('2')
    let p3 = example.indexOf('3')
    if (p1 >= 0 && p2 > p1) {
        let between = example.slice(p1 + 1, p2)
        if (p3 > p2) {
            let last2 = example.slice(p2 + 1, p3)
            let only2
             if (last2 !== between && last2.startsWith(between)) // as with an oxford comma: "1, 2, and 3"
                only2 = last2.slice(between.trimRight().length)
            else
                only2 = last2
            let suffix = example.slice(p3 + 1)
            inputList['punc'] = { between, last2, only2, suffix } // the context stack has ensured this array is a shallow copy, so we modify it in-place
        } else if (p3 < 0) {
            let suffix = example.slice(p2 + 1)
            inputList['punc'] = { between, last2: between, only2: between, suffix }
        }
    }
    return inputList
}

const unEscapeQuotes = function(str) {
    return str.replace(/&quot;/g,'"')
}

// list filtering
expressions.filters.sort = function(input) {
    if(!input || !Array.isArray(input) || !input.length || arguments.length < 2) return input;
    const sortBy = [];
    let i = 1;
    while (i < arguments.length) {
        let argument = unEscapeQuotes(arguments[i++]);
        sortBy.push({
            descending: argument[0] === '-',
            evaluator: expressions.compile('+-'.includes(argument[0]) ? argument.substr(1) : argument)
        })
    }
    function compare(a, b, depth) {
        if (!depth) {
            depth = 0;
        }
        if (depth >= sortBy.length)
            return 0;
        const valA = sortBy[depth].evaluator(a);
        const valB = sortBy[depth].evaluator(b);
        if (valA < valB)
            return sortBy[depth].descending ? 1 : -1;
        if (valA > valB)
            return sortBy[depth].descending ? -1 : 1;
        return compare(a, b, depth + 1);
    }
    return input.slice().sort(compare);
}
expressions.filters.filter = function(input, predicateStr) {
    return callArrayFunc(Array.prototype.filter, input, predicateStr)
}
expressions.filters.find = function(input, predicateStr) {
    return callArrayFunc(Array.prototype.find, input, predicateStr)
}
expressions.filters.some = function(input, predicateStr) {
    return callArrayFunc(Array.prototype.some, input, predicateStr)
}
expressions.filters.every = function(input, predicateStr) {
    return callArrayFunc(Array.prototype.every, input, predicateStr)
}
expressions.filters.map = function(input, mappedStr) {
    return callArrayFunc(Array.prototype.map, input, mappedStr)
}
expressions.filters.group = function(input, groupStr) {
    if(!input || !Array.isArray(input) || !input.length || arguments.length < 2) {
        return input
    }
    const evaluator = expressions.compile(unEscapeQuotes(groupStr))
    return input.reduce(
        (result, item) => {
            let key = evaluator(item)
            let bucket = result.find(b => b._key === key)
            if (!bucket) {
                bucket = {_key: key, _values: []}
                result.push(bucket)
            }
            bucket._values.push(item)
            return result
        },
        []
    )
}

function callArrayFunc(func, array, predicateStr) {
    if (!array || !Array.isArray(array) || !array.length || arguments.length < 2) {
        return array
    }
    const evaluator = expressions.compile(unEscapeQuotes(predicateStr))
    return func.call(array, item => evaluator(item))
}
