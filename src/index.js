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

function extractLogic (template, bIncludeListPunctuation = true) {
  // returns a 'logic tree' for this template --
  // a filtered, optimized AST representing the logical structure of the template
  return base.buildLogicTree(textTemplater.parseTemplate(template, true, bIncludeListPunctuation))
  // note: parseTemplate uses caching for performance
}
exports.extractLogic = extractLogic

function compileText (template) {
  // returns curried function that will assemble the text template (given the data context as input)
  // (this method currently throws if the template contains an error!)
  // the resulting function includes a "logic" property containing the same thing you'd get from extractLogic()
  const contentArray = textTemplater.parseTemplate(template) // content arrays cached on key of template string
  const compiledTemplateCache = compileText.cache
  let func = compiledTemplateCache && compiledTemplateCache.get(contentArray)
  if (!func) {
    func = (s) =>
      new EvaluationResult(
        (new TextEvaluator(s)).assemble(contentArray),
        [], // TODO: keep track of identifiers that did not produce a value (missing)
        [], // TODO: keep track of other errors encountered during evaluations
      )
    func.logic = base.buildLogicTree(contentArray)
    if (compiledTemplateCache) compiledTemplateCache.set(contentArray, func)
  }
  return func
}
compileText.cache = new Map()
exports.compileText = compileText

function assembleText (template, scope) {
  // non-curried version of assembly: pass in a template AND a context
  try {
    const contentArray = textTemplater.parseTemplate(template)
    const value = (new TextEvaluator(scope)).assemble(contentArray)
    return new EvaluationResult(value, [], []) // TODO: populate the missing & errors collections!!
  } catch (err) {
    return new EvaluationResult(null, [], [err.message]) // TODO: populate the missing & errors collections!!
  }
}
exports.assembleText = assembleText

function assembleMeta (metaTemplate, scope) {
  try {
    const contentArray = textTemplater.parseTemplate(metaTemplate, true, false)
    const nodes = (new MetaEvaluator(scope)).assemble(contentArray)
    const program = {
      type: AST.Program,
      body: nodes.filter(n => !n.error)
    }
    return new EvaluationResult(program, [], nodes.filter(n => n.error)) // TODO: populate the missing collection!!
  } catch (err) {
    return new EvaluationResult(null, [], [err.message])
  }
}
exports.assembleMeta = assembleMeta

exports.FieldTypes = require('./fieldtypes')
exports.Scope = require('./yobj')
