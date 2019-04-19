"use strict";

class ContextStack {
    constructor () {
        this.stack = [];
    }

    empty () {
        return this.stack.length == 0;
    }
    pushGlobal (contextObj) {
        if (!this.empty())
            throw 'Internal error: execution stack is not empty at beginning of assembly'
        this.push(createGlobalFrame(contextObj))
    }
    popGlobal() {
        const result = this.popObject()
        if (!this.empty())
            throw 'Internal error: execution stack is not empty at end of assembly'
        return result
    }
    pushObject (name, contextObj) {
        let currentFrame = this.peek();
        if (currentFrame && currentFrame.type == "List") {
            this.push(createListItemFrame(name, contextObj, currentFrame));
        } else {
            throw 'Unexpected: pushing non-list stack frames not fully tested'
            this.push(createObjectFrame(name, contextObj, currentFrame));
        }
    }
    popObject () {
        const poppedFrame = this.pop();
        if (poppedFrame.type != 'Object')
            throw `Internal error: expected Object stack frame, got ${poppedFrame.type} instead`;
        return poppedFrame;
    }
    pushList (name, iterable) {
        let newFrame = createListFrame(name, iterable, this.peek());
        this.push(newFrame);
        return indices(newFrame.array.length);
    }
    popList() {
        const poppedFrame = this.pop();
        if (poppedFrame.type != 'List')
            throw `Internal error: expected List stack frame, got ${poppedFrame.type} instead`;
        return poppedFrame;
    }
    push (frame) {
        this.stack.push(frame);
    }
    pop () {
        return this.stack.pop();
    }
    peek () {
        return this.stack.length > 0 ? this.stack[this.stack.length-1] : null;
    }
    peekName() {
        return this.peek().name;
    }

    static IsTruthy(value) {
        let bValue;
        if (value && ContextStack.IsIterable(value)) {
            // checking if a list is empty or not
            if (!ContextStack.IsArray(value)) {
                value = Array.from(value)
            }
            bValue = (value.length > 0) // for purposes of if fields in opendocx, we consider empty lists falsy! (unlike typical JavaScript, where all arrays are considered truthy)
        } else {
            bValue = Boolean(value);
        }
        return bValue;
    }

    static IsArray(obj) {
        return Array.isArray(obj)
    }

    static IsIterable(obj) {
        // checks for null and undefined; also strings (though iterable) should not be iterable *contexts*
        if (obj == null || typeof obj == 'string') {
            return false
        }
        return typeof obj[Symbol.iterator] === 'function'
    }
}
module.exports = ContextStack;

const indices = (length) => new Array(length).fill(undefined).map((value, index) => index)

function createGlobalFrame (contextObj) {
    return { type: 'Object', name: '_top', local: null, global: contextObj, parentFrame: null };
}

function createObjectFrame (name, contextObj, parentFrame) {
    if (typeof contextObj !== 'object') throw 'Cannot create object stack frame for literal value'
    let proto = Object.getPrototypeOf(contextObj)
    if (parentFrame.local) {
        // make a copy of the prototype object for the object, but redirect its prototype chain to point to the parent context
        proto = shallowClone(proto, parentFrame.local)
        Object.defineProperty(proto, '_parent', { value: parentFrame.local });
    }
    return { type: 'Object', name, local: shallowClone(contextObj, proto), global: parentFrame.global, parentFrame };
}

function createListFrame (name, iterable, parentFrame) {
    const array = iterable ? Array.from(iterable) : [];
    let proto = (array.length > 0 && typeof array[0] === 'object') ? Object.getPrototypeOf(array[0]) : null
    if (proto !== null && parentFrame.local) {
        // make a copy of the prototype object for list items, but redirect its prototype chain to point to the parent list item context
        proto = shallowClone(proto, parentFrame.local)
        Object.defineProperty(proto, '_parent', { value: parentFrame.local });
    }
    return { type: 'List', name, array, global: parentFrame.global, itemProto: proto, parentFrame };
}

function createListItemFrame (name, index, listFrame) {
    const item = listFrame.array[index];
    let local;
    if (typeof item === 'object') { // listFrame.itemProto was set in createListFrame
        local = shallowClone(item, listFrame.itemProto)
    } else {
        local = wrapPrimitive(item);
        Object.defineProperty(local, '_parent', { value: listFrame.parentFrame.local })
    }
    Object.defineProperties(local, {
        _index0: { value: index },
        _index: { value: index + 1 },
    });
    return { type: 'Object', name, local, global: listFrame.global, parentFrame: listFrame };
}

function wrapPrimitive(value) {
    let val;
    switch (typeof value) {
        case 'string': val = new String(value); break;
        case 'number': val = new Number(value); break;
        case 'boolean': val = new Boolean(value); break;
        default: throw 'unexpected value type';
    }
    return val;
}

function isPrimitiveWrapper(obj) {
    return obj.constructor && ['String', 'Number', 'Boolean'].includes(obj.constructor.name)
}

function shallowClone(obj, newProto) {
    let clone
    if (newProto && isPrimitiveWrapper(newProto)) {
        const val = newProto.valueOf()
        newProto = { _value: val }
    }
    if (obj === Object.prototype) {
        clone = Object.create(newProto ? newProto : obj)
    } else {
        clone = Object.create(newProto ? newProto : Object.getPrototypeOf(obj))
        Object.getOwnPropertyNames(obj).forEach(key => Object.defineProperty(clone, key, Object.getOwnPropertyDescriptor(obj, key)))
    }
    return clone
}
