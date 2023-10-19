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
  let result
  if (templateCache && templateCache.hasOwnProperty(template)) {
    result = templateCache[template]
  } else {
    try {
      // if any block-level paired fields are on a lines by themselves, remove the CR/LF following those fields
      // (but leave block-level content fields alone)
      const tweaked = template.replace(_blockFieldRE, _blockFieldReplacer)
      // TODO: improve this approach with something that captures & retains each field offset
      const templateSplit = tweaked.split(_fieldRE)
      if (templateSplit.length < 2) { // no fields
        result = [template]
      } else {
        result = base.parseContentArray(templateSplit, bIncludeExpressions, bIncludeListPunctuation)
        // number the fields after-the-fact
        numberFields(result)
      }
    } catch (err) {
      result = (typeof err === 'string') ? new Error(err) : err
    }
    if (templateCache) {
      templateCache[template] = result
    }
  }
  if (result instanceof Error) {
    throw result
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

function parseRawTemplate (template, format = 'raw') {
  // todo: behave differently when format === 'md' for markdown...
  //       in that case only certain line breaks are significant,
  //       so maybe we use a markdown parser to reliably split into paragraphs?
  const lines = splitLines(template)
  let fieldId = 0
  // scan fields in text, embedding metadata in each field about its line no, character offset & chunk no.
  // Each line is now an array of content items, and each field has a L:C:K id.
  const lineItems = []
  lines.forEach((line, lineIdx) => {
    const items = []
    let match
    while ((match = _fieldsRE.exec(line)) !== null) {
      // capture text (if any) prior to field
      const lastEnd = items.length && items[items.length - 1].end
      if (match.index > lastEnd) {
        items.push(line.substring(lastEnd, match.index))
      }
      const parsedContent = base.parseFieldContent(match[1])
      parsedContent.id = String(++fieldId)
      parsedContent.line = lineIdx
      parsedContent.start = match.index
      parsedContent.end = _fieldsRE.lastIndex
      items.push(parsedContent)
    }
    if (items.length === 0) {
      items.push(line)
    } else {
      const lastEnd = items[items.length - 1].end
      if (line.length > lastEnd) {
        items.push(line.substr(lastEnd))
      }
    }
    lineItems.push(items)
  })
  return lineItems
}
exports.parseRawTemplate = parseRawTemplate

function extractRawFields (template) {
  const parsed = parseRawTemplate(template)
  const result = parsed.reduce((allFields, lineItems) => {
    lineItems.forEach(li => {
      if (li && typeof li === 'object') {
        allFields.push(li)
      }
    })
    return allFields
  }, [])
  return result
}
exports.extractRawFields = extractRawFields

function serializeTemplate (contentObj) {
  if (!contentObj) return ''
  if (typeof contentObj === 'string') return contentObj
  if (Array.isArray(contentObj)) {
    const hasSubArrays = contentObj.some(sub => Array.isArray(sub))
    return contentObj.map(co => serializeTemplate(co))
      .join(hasSubArrays ? '\n' : '')
  }
  switch (contentObj.type) {
    case OD.Content: {
      if (contentObj.expr) return '{[' + contentObj.expr + ']}'
      // else !expr
      return '{[' + ' '.repeat(contentObj.end - contentObj.start - 4) + ']}'
    }
    case OD.List: {
      if (contentObj.contentArray) {
        return '{[list ' + contentObj.expr + ']}' +
          serializeTemplate(contentObj.contentArray) +
          '{[endlist]}'
      } else {
        if (contentObj.expr) return '{[list ' + contentObj.expr + ']}'
        // else !expr
        return '{[list' + ' '.repeat(contentObj.end - contentObj.start - 8) + ']}'
      }
    }
    case OD.EndList: return '{[endlist' + (contentObj.comment || '') + ']}'
    case OD.If: {
      if (contentObj.contentArray) {
        return '{[if ' + contentObj.expr + ']}' +
          serializeTemplate(contentObj.contentArray) +
          '{[endif]}'
      } else {
        if (contentObj.expr) return '{[if ' + contentObj.expr + ']}'
        // else !expr -- how many spaces?
        return '{[if' + ' '.repeat(contentObj.end - contentObj.start - 6) + ']}'
      }
    }
    case OD.ElseIf: {
      if (contentObj.contentArray) {
        return '{[elseif ' + contentObj.expr + ']}' +
          serializeTemplate(contentObj.contentArray)
      } else {
        if (contentObj.expr) return '{[elseif ' + contentObj.expr + ']}'
        // else !expr
        return '{[elseif' + ' '.repeat(contentObj.end - contentObj.start - 10) + ']}'
      }
    }
    case OD.Else: {
      if (contentObj.contentArray) {
        return '{[else]}' + serializeTemplate(contentObj.contentArray)
      } else {
        return '{[else' + (contentObj.comment || '') + ']}'
      }
    }
    case OD.EndIf: return '{[endif' + (contentObj.comment || '') + ']}'
    default: return ''
  }
}
exports.serializeTemplate = serializeTemplate

function toContentArray (parsed) {
  // text templates (currently) allow free placement of paired (if/endif, list/endlist) fields,
  // without the limitations placed on such fields in DOCX templates. So first *remove* distinctions
  // about which lines/blocks/paragraphs things are in.
  const contentArray = []
  if (parsed.some(p => !Array.isArray(p))) {
    // parsed appears to be an array of line items rather than an array of lines...
    // so nest it inside an array of lines
    parsed = [parsed]
  }
  parsed.forEach((lineItems, lineIndex, allLines) => {
    const isLastLine = (lineIndex === allLines.length - 1)
    if (lineItems.length === 0) { // empty line
      if (!isLastLine) contentArray.push('\n')
    } else {
      lineItems.forEach((lineItem, itemIndex, lineItems) => {
        const isLastItem = (itemIndex === lineItems.length - 1)
        if (typeof lineItem === 'string') {
          contentArray.push(isLastItem && !isLastLine ? lineItem + '\n' : lineItem)
        } else {
          contentArray.push(lineItem)
          if (isLastItem && !isLastLine && (lineItem.type === OD.Content || itemIndex > 0)) {
            // fields that end a line are followed by a line break
            // UNLESS it's a paired field (non-Content field) that is alone on its line --
            // those fields DON'T get the line break
            contentArray.push('\n')
          }
        }
      })
    }
  })
  return contentArray
}

/**
 * Takes a parsed template (parsed using parseRawTemplate), validates its field nesting,
 * and converts it into a nested ContentArray. Throws if it encounters errors with field nesting.
 * @param {Array<*>} parsed a template array as parsed by parseRawTemplate (i.e. parseTextPermissive)
 */
function validateParsedTemplate (parsed) {
  return base.validateContentArray(toContentArray(parsed))
}
exports.validateParsedTemplate = validateParsedTemplate

const LBRE = /\r\n|\r|\n/g
const normalizeLineBreaks = (str) => {
  return str.replace(LBRE, '\n')
}
exports.normalizeLineBreaks = normalizeLineBreaks
const splitLines = (str) => {
  return str.split(LBRE)
}
