const textTemplater = require('./text-templater')
const TextEvaluator = require('./text-evaluator')
const MetaEvaluator = require('./meta-evaluator')
const { AST } = require('./estree')
const base = require('./base-templater')
const EvaluationResult = require('./eval-result')
const IndirectVirtual = require('./indirect')
exports.Engine = base
exports.EvaluationResult = EvaluationResult
exports.IndirectVirtual = IndirectVirtual
exports.parseText = textTemplater.parseTemplate
exports.parseTextPermissive = textTemplater.parseRawTemplate
exports.extractTextFields = textTemplater.extractRawFields
exports.validateParsedText = textTemplater.validateParsedTemplate

function extractLogic (template, bIncludeListPunctuation = true) {
  // returns a 'logic tree' for this template --
  // a filtered, optimized AST representing the logical structure of the template
  return base.buildLogicTree(textTemplater.parseTemplate(template, true, bIncludeListPunctuation))
  // note: parseTemplate uses caching for performance
}
exports.extractLogic = extractLogic

function compileText (template) {
  // returns curried function that will assemble the text template (given the data context as input)
  // the resulting function will include a "logic" property containing the AST from extractLogic()
  const compiledTemplateCache = compileText.cache
  let func, contentArray
  try {
    contentArray = textTemplater.parseTemplate(template) // content arrays cached on key of template string
  } catch (err) {
    contentArray = err
  }
  func = compiledTemplateCache && compiledTemplateCache.get(contentArray)
  if (!func) {
    if (contentArray instanceof Error) {
      func = () => new EvaluationResult(null, [], [contentArray.message])
      func.error = contentArray.message
      func.logic = true
    } else {
      func = (s) => {
        const evaluator = new TextEvaluator(s)
        const value = evaluator.assemble(contentArray)
        return new EvaluationResult(value, evaluator.missing, evaluator.errors)
      }
      func.logic = base.buildLogicTree(contentArray)
    }
    if (compiledTemplateCache) compiledTemplateCache.set(contentArray, func)
  }
  return func
}
compileText.cache = new Map()
exports.compileText = compileText

function assembleText (template, scope) {
  // non-curried version of assembly: pass in a template AND a context
  // omits "logic" AST, so useful only for assembling and not additional analysis
  try {
    const contentArray = textTemplater.parseTemplate(template)
    const evaluator = new TextEvaluator(scope)
    const value = evaluator.assemble(contentArray)
    return new EvaluationResult(value, evaluator.missing, evaluator.errors)
  } catch (err) {
    return new EvaluationResult(null, [], [err.message])
  }
}
exports.assembleText = assembleText

function assembleMeta (metaTemplate, scope) {
  try {
    const contentArray = textTemplater.parseTemplate(metaTemplate, true, false)
    const evaluator = new MetaEvaluator(scope)
    const nodes = evaluator.assemble(contentArray)
    const program = {
      type: AST.Program,
      body: nodes.filter(n => !n.error)
    }
    return new EvaluationResult(
      program,
      evaluator.missing,
      evaluator.errors.concat(nodes.filter(n => n.error).map(n => n.error))
    )
  } catch (err) {
    return new EvaluationResult(null, [], [err.message])
  }
}
exports.assembleMeta = assembleMeta

exports.FieldTypes = require('./fieldtypes')
exports.Scope = require('./yobj')
