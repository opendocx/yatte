'use strict';

const ContextStack = require('./context-stack');
const OD = require('./fieldtypes');
const base = require('./base-templater');

class TextEvaluator {
    constructor (context) {
        this.context = context;
        this.contextStack = new ContextStack();
    }

    assemble(contentArray) {
        this.contextStack.pushGlobal(this.context);
        const text = contentArray.map(contentItem => ContentReplacementTransform(contentItem, this.contextStack)).join("");
        this.contextStack.popGlobal();
        return text;
    }
}
module.exports = TextEvaluator;

function ContentReplacementTransform(contentItem, contextStack)
{
    if (!contentItem)
        return "";
    if (typeof contentItem === "string")
        return contentItem;
    if (typeof contentItem !== "object")
        throw `Unexpected content '${contentItem}'`;
    const frame = contextStack.peek();
    switch (contentItem.type) {
        case OD.Content:
            try {
                const evaluator = base.compileExpr(contentItem.expr); // these are cached so this should be fast
                let value
                if (contentItem.expr !== 'this') { // generally
                    value = evaluator(frame.global, frame.local); // we need to make sure this is memoized to avoid unnecessary re-evaluation
                } else { // special case: when evaluating 'this', there are no locals, so pass value in as global scope object
                    value = evaluator(frame.local);
                }
                if (value === null || typeof value === 'undefined') {
                    value = '[' + contentItem.expr + ']'; // missing value placeholder
                }
                return value;
            } catch (err) {
                return CreateContextErrorMessage("EvaluationException: " + err);
            }
        break;
        case OD.List:
            let iterable;
            try {
                const evaluator = base.compileExpr(contentItem.expr); // these are cached so this should be fast
                iterable = evaluator(frame.global, frame.local); // we need to make sure this is memoized to avoid unnecessary re-evaluation
            } catch (err) {
                return CreateContextErrorMessage("EvaluationException: " + err);
            }
            const indices = contextStack.pushList(contentItem.expr, iterable);
            const allContent = indices.map(index => {
                contextStack.pushObject('o' + index, index);
                const listItemContent = contentItem.contentArray.map(listContentItem => ContentReplacementTransform(listContentItem, contextStack));
                contextStack.popObject();
                return listItemContent.join("");
            });
            contextStack.popList();
            return allContent.join("");
        break;
        case OD.If:
        case OD.ElseIf:
            let bValue;
            try {
                if (frame.type != 'Object') {
                    throw `Internal error: cannot define a condition directly in a ${frame.type} context`;
                }
                const evaluator = base.compileExpr(contentItem.expr); // these are cached so this should be fast
                const value = evaluator(frame.global, frame.local); // we need to make sure this is memoized to avoid unnecessary re-evaluation
                bValue = ContextStack.IsTruthy(value);
            } catch (err) {
                return CreateContextErrorMessage("EvaluationException: " + err);
            }
            if (bValue)
            {
                const content = contentItem.contentArray
                    .filter(item => (typeof item != "object") || (item == null) || (item.type != OD.ElseIf && item.type != OD.Else))
                    .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack));
                return content.join("");
            }
            let elseCond = contentItem.contentArray.find(item => (typeof item == "object" && item != null && (item.type == OD.ElseIf || item.type == OD.Else)));
            if (elseCond) {
                if (elseCond.type == OD.ElseIf)
                    return ContentReplacementTransform(elseCond, contextStack);
                // else
                const content = elseCond.contentArray
                    .map(conditionalContentItem => ContentReplacementTransform(conditionalContentItem, contextStack));
                return content.join("");
            }
            return "";
        break;
    }
}

function CreateContextErrorMessage(message) {
    return "*** " + message + " ***";
}
