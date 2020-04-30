/* eslint-disable no-prototype-builtins */
const base = require('./base-templater')
const OD = require('./fieldtypes')

/* parseTemplate parses a text template (passed in as a string)
   into an object tree structure -- essentially a high-level AST for the template.

   CRLF handling:
   any field that's alone on a line of text (preceded by either a CRLF or the beginning of the string, and
   followed by a CRLF), needs to (during parsing) "consume" the CRLF that follows it, to avoid unexpected lines
   in the assembled output.
*/
function parseTemplate (template, bIncludeExpressions = true, bIncludeListPunctuation = true) {
  const templateCache = parseTemplate.cache
  if (templateCache && templateCache.hasOwnProperty(template)) { return templateCache[template] }
  // if any block-level paired fields are on a lines by themselves, remove the CR/LF following those fields
  // (but leave block-level content fields alone)
  const tweaked = template.replace(_blockFieldRE, _blockFieldReplacer)
  // TODO: improve this approach with something that captures & retains each field offset
  let result
  const templateSplit = tweaked.split(_fieldRE)
  if (templateSplit.length < 2) { // no fields
    result = [template]
  } else {
    result = base.parseContentArray(templateSplit, bIncludeExpressions, bIncludeListPunctuation)
    // number the fields after-the-fact
    numberFields(result)
  }
  if (templateCache) {
    templateCache[template] = result
  }
  return result
}
parseTemplate.cache = {}
exports.parseTemplate = parseTemplate

const numberFields = function (parsedContentArray, startAt = 0) {
  for (const contentItem of parsedContentArray) {
    if (contentItem && typeof contentItem === 'object') {
      if (contentItem.type !== OD.Content || contentItem.expr !== '_punc') {
        contentItem.id = (++startAt).toString()
      }
      if (Array.isArray(contentItem.contentArray) && contentItem.contentArray.length > 0) {
        startAt = numberFields(contentItem.contentArray, startAt)
      }
    }
  }
  return startAt
}

const _blockFieldReplacer = function (match, fieldText, eol, offset, string) {
  var cleaned = `{[${fieldText}]}`
  if (!fieldText.match(/^if|\?|else|:|list|#|end|\//)) {
    cleaned += eol
  }
  return cleaned
}
// const _blockFieldRE = /(?<=\n|\r|^)\{\s*\[([^{}]*?)\]\s*\}(\r\n|\n|\r)/g
// positive lookbehind breaks every browser but chrome! (as of mid 2019)
const _blockFieldRE = /^\{\s*\[([^{}]*?)\]\s*\}(\r\n|\n|\r)/gm
const _fieldRE = /\{\s*(\[.*?\])\s*\}/
const _fieldsRE = /\{\s*\[(.*?)\]\s*\}/g

// const extractFields = function (contentArray) {
//     return contentArray
//         .filter(obj => obj != null && typeof obj == "object")
//         .map(obj => {
//             const newObj = { type: obj.type };
//             if (typeof obj.expr == 'string')
//                 newObj.expr = obj.expr;
//             if (obj.exprAst)
//                 newObj.exprAst = obj.exprAst;
//             if (obj.contentArray && obj.contentArray.length > 0)
//                 newObj.contentArray = extractFields(obj.contentArray);
//             return newObj;
//         });
// }
// exports.extractFields = extractFields;

// new-and-improved parsing of text templates... not yet fully implemented :-(
function parseText (template, bIncludeExpressions = true, bIncludeListPunctuation = true) {
  const templateCache = parseText.cache
  if (templateCache && templateCache.hasOwnProperty(template)) { return templateCache[template] }
  // split template into lines (parallel to paragraphs in Word doc)
  const lines = []
  // scan fields in text, embedding metadata in each field about its line no, character offset & chunk no.
  // Each line is now an array of content items, and each field has a L:C:K id.
  for (const line of template.split('\n')) {
    const items = []
    let match
    while ((match = _fieldsRE.exec(line)) !== null) {
      // todo: capture text (if any) prior to field
      const lastEnd = items.length && items[items.length - 1].end
      if (match.index > lastEnd) {
        items.push(line.substring(lastEnd, match.index))
      }
      items.push({
        content: match[1],
        start: match.index,
        end: _fieldsRE.lastIndex
      })
    }
    if (items.length === 0) {
      items.push(line)
    } else {
      const lastEnd = items[items.length - 1].end
      if (line.length > lastEnd) {
        items.push(line.substr(lastEnd))
      }
    }
    lines.push(items)
  }
  // perform some validation on content items as we go: make sure ifs & lists are either in same line as
  // their matching end fields, or on lines by themselves
  // extract all the fields into one content array, in order, which we will pass to the base templater
  const contentArray = []
  lines.forEach((lineArray, lineIndex) => {
    lineArray.forEach((item, itemIndex) => {
      if (typeof item === 'object') {
        item.id = `${lineIndex + 1}:${item.start}:${item.end}:${itemIndex}`
        contentArray.push(item)
      }
    })
  })
  // the base templater only gets a list of fields, it doesn't know whether they're from text or DOCX or PDF etc.
  const result = base.parseContentArray(contentArray, bIncludeExpressions, bIncludeListPunctuation)
  if (templateCache) {
    templateCache[template] = result
  }
  return result
}
parseText.cache = {}
exports.parseText = parseText

class ParsedTextTemplate {
  constructor (template, bIncludeExpressions = true, bIncludeListPunctuation = true) {
    // split template into lines (parallel to paragraphs in Word doc)
    const lines = []
    // scan fields in text, embedding metadata in each field about its line no, character offset & chunk no.
    // Each line is now an array of content items, and each field has a L:C:K id.
    for (const line of template.split('\n')) {
      const items = []
      let match
      while ((match = _fieldsRE.exec(line)) !== null) {
        // todo: capture text (if any) prior to field
        const lastEnd = items.length && items[items.length - 1].end
        if (match.index > lastEnd) {
          items.push(line.substring(lastEnd, match.index))
        }
        items.push({
          content: match[1],
          start: match.index,
          end: _fieldsRE.lastIndex
        })
      }
      if (items.length === 0) {
        items.push(line)
      } else {
        const lastEnd = items[items.length - 1].end
        if (line.length > lastEnd) {
          items.push(line.substr(lastEnd))
        }
      }
      lines.push(items)
    }
    // perform some validation on content items as we go: make sure ifs & lists are either in same line as
    // their matching end fields, or on lines by themselves
    const errors = []
    NormalizeRepeatAndConditional(lines, errors)
    // extract all the fields into one content array, in order, which we will pass to the base templater
    const contentArray = []
    lines.forEach((items, lineIndex) => {
      items.forEach((item, itemIndex) => {
        if (typeof item === 'object') {
          item.id = `${lineIndex + 1}:${item.start}:${item.end}:${itemIndex}`
          contentArray.push(item)
        }
      })
    })
    // the base templater only gets a list of fields, it doesn't know whether they're from text or DOCX or PDF etc.
    this.ast = base.parseContentArray(contentArray, bIncludeExpressions, bIncludeListPunctuation)
  }
}

function NormalizeRepeatAndConditional (lines, errors) {
  const repeatDepth = 0
  const conditionalDepth = 0
  lines.forEach(items => {
    items.filter(item => typeof item === 'object').forEach(field => {

    })
  })
  // foreach (var metadata in xDoc.Descendants().Where(d =>
  //         d.Name == OD.List ||
  //         d.Name == OD.EndList ||
  //         d.Name == OD.If ||
  //         d.Name == OD.ElseIf ||
  //         d.Name == OD.Else ||
  //         d.Name == OD.EndIf))
  // {
  //     if (metadata.Name == OD.List)
  //     {
  //         ++repeatDepth;
  //         metadata.Add(new XAttribute(OD.Depth, repeatDepth));
  //         continue;
  //     }
  //     if (metadata.Name == OD.EndList)
  //     {
  //         metadata.Add(new XAttribute(OD.Depth, repeatDepth));
  //         --repeatDepth;
  //         continue;
  //     }
  //     if (metadata.Name == OD.If)
  //     {
  //         ++conditionalDepth;
  //         metadata.Add(new XAttribute(OD.Depth, conditionalDepth));
  //         continue;
  //     }
  //     if (metadata.Name == OD.ElseIf)
  //     {
  //         metadata.Add(new XAttribute(OD.Depth, conditionalDepth));
  //         continue;
  //     }
  //     if (metadata.Name == OD.Else)
  //     {
  //         metadata.Add(new XAttribute(OD.Depth, conditionalDepth));
  //         continue;
  //     }
  //     if (metadata.Name == OD.EndIf)
  //     {
  //         metadata.Add(new XAttribute(OD.Depth, conditionalDepth));
  //         --conditionalDepth;
  //         continue;
  //     }
  // }
}
