const expressions= require('angular-expressions');
const format = require('date-fns/format');

// define built-in filters (todo: more needed)
expressions.filters.upper = function(input) {
    if(!input) return input;
    return input.toUpperCase();
}
expressions.filters.lower = function(input) {
    if(!input) return input;
    return input.toLowerCase();
}
expressions.filters.initcap = function(input, forceLower = false) {
    if(!input) return input;
    if (forceLower) input = input.toLowerCase();
    return input.charAt(0).toUpperCase() + input.slice(1);
}
expressions.filters.titlecaps = function(input, forceLower = false) {
    if(!input) return input;
    if (forceLower) input = input.toLowerCase();
    return input.replace(/(^| )(\w)/g, s => s.toUpperCase());
}
expressions.filters.date = function(input, fmtStr) {
    // This condition should be used to make sure that if your input is undefined, your output will be undefined as well and will not throw an error
    if(!input) return input;
    return format(input, fmtStr);
}
expressions.filters.ordsuffix = function(input) {
    if(!input) return input;
    switch (input % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}
