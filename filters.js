const expressions= require('angular-expressions')
const format = require('date-fns/format')
const numeral = require('numeral')
const numWords = require('number-to-words')

// define built-in filters (todo: more needed)
expressions.filters.upper = function(input) {
    if(!input) return input
    return input.toUpperCase()
}
expressions.filters.lower = function(input) {
    if(!input) return input
    return input.toLowerCase()
}
expressions.filters.initcap = function(input, forceLower = false) {
    if(!input) return input
    if (forceLower) input = input.toLowerCase()
    return input.charAt(0).toUpperCase() + input.slice(1)
}
expressions.filters.titlecaps = function(input, forceLower = false) {
    if(!input) return input
    if (forceLower) input = input.toLowerCase()
    return input.replace(/(^| )(\w)/g, s => s.toUpperCase())
}
expressions.filters.date = function(input, fmtStr) {
    if(!input) return input
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
    if (!input) return input
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
    if(!input || !Array.isArray(input) || !input.length || arguments.length < 2) return input;
    const evaluator = expressions.compile(unEscapeQuotes(predicateStr));
    return input.filter(item => evaluator(item));
}
expressions.filters.map = function(input, mappedStr) {
    if(!input || !Array.isArray(input) || !input.length || arguments.length < 2) return input;
    const evaluator = expressions.compile(unEscapeQuotes(mappedStr));
    return input.map(item => evaluator(item));
}
// expressions.filters.group = function(input) {
//     if(!input || !Array.isArray(input) || !input.length || arguments.length < 2) return input;
//     // not implemented yet
//     debugger;
// }
