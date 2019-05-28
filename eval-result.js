"use strict";

class EvaluationResult {
    constructor(value, missing = [], errors = []) {
        this.value = value
        this.missing = missing
        this.errors = errors
    }
    valueOf() {
        return ((typeof this.value === 'object') && (this.value !== null)) ? this.value.valueOf() : this.value
    }
    toString() {
        return (typeof this.value === 'string')
                  ? this.value
                  : isDef(this.value)
                     ? this.value.toString()
                     : '(missing)'
    }
}
module.exports = EvaluationResult
