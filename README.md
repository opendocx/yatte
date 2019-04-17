yatte
=====

**Yet Another Text Templating Engine**

This package is still somewhat experimental in nature. If it interests you, please try it out and share your feedback.

Why another templating engine?
------------------------------

There are a number of really great templating engines out there. (See Prior Art below.) Why bother creating another one?
* syntax targeted for use by reasonably technical people who are _not_ software developers
* feature set that attempts to balance richness with ease of learning and reading templates
* designed to be a foundation for common syntax and execution model across different types of files, not exclusively text or html

Installation
------------

[![NPM](https://nodei.co/npm/yatte.png)](https://nodei.co/npm/yatte/)

Templates
---------

Template markup is accomplished using "fields" to describe how the content should be modified when text is being "assembled." Fields are currently set apart from regular text using a somewhat odd combination of delimiters (see below). There are plans to allow easier-to-type delimiters in the future, but for now, at least it's unambiguous.

Yatte currently supports three types of fields: Content, If, and List. More samples (and possibly additional types of fields!) are coming soon.

#### _Content_ fields cause additional text to be added (merged) into the template text.
```
{[First]} {[Last]}
```

Content fields can contain either simple identfiers or expressions. Expressions use a subset of standard JavaScript syntax, and identifiers in those expressions can refer to any type of JavaScript construct: variables, objects, functions, etc..

#### _if_ fields cause a portion of the template text to be included or excluded based on logical conditions.
```
{[First]} {[if Middle]}{[Middle]} {[endif]}{[Last]}
```

An _if_ field contains an expression that is evaluated for purposes of determining whether to include the text between _if_ and _endif_.  If this expression evaluates to a true (or truthy) value, the text between the fields is included; otherwise it is excluded from the assembled text.

_If_ fields can also include alternatives ("_else_") or chains of alternatives ("_elseif_").

#### _list_ fields cause text to be repeated as many times as is dictated by the data provided by the caller. Lists can also be nested as deeply as necessary. 
```
My beneficiaries are:
{[list beneficiaries]}
* {[Name]}, currently of {[Address]}
{[endlist]}
```

As with _if_ fields, the _list_ field contains an expression – "beneficiaries" in the example above. However, for _list_ fields, this expression is expected to evaluate to a list of items.  (Specifically, in JavaScript parlance, it must evaluate to any _iterable_ – often, but not necessarily, an array.)  When this expression is evaluated, the resulting list of values is kept in temporary memory and is used to determine both how many repetitions of the template content are necessary, and then for each repetition, that item in the array (or iterable) serves as the data context for all expressions evaluated until the _endlist_ field is reached.

Usage
-----

yatte's public API includes two methods:

#### assembleText
```javascript
function assembleText(templateText, dataContext)
```
Given a text template (a string) and a data context (any JavaScript object), assembleText simply "assembles" a text result:

```javascript
const yatte = require("yatte");
const assert = require('assert');

const template = "Hello {[World]}!";
const data = { World: "Earth" };
const result = yatte.assembleText(template, data);
assert.equal(result, "Hello World!");
```

#### compileText
```javascript
function compileText(templateText)
```
compileText() is used to "compile" a text string into a yatte template. This pre-processes that text and returns a curried function that can be used (later) to assemble text when given a data context:

```javascript
const yatte = require("yatte");
const assert = require('assert');

const template = "Hello {[World]}!";
const evaluator = yatte.compileText(template);
// ... later ...
const data = { World: "Earth" };
const result = evaluator(data);
assert.equal(result, "Hello Earth!");
```

Prior Art
---------

Yatte's approach to compiling and assembling text was inspired by the pure functional transformations in
* [Open-Xml-Power-Tools](https://github.com/EricWhiteDev/Open-Xml-PowerTools), maintained by Eric White.

Yatte's creator also drew inspiration from these fantastic text templating engines:
* [Dust.js](https://www.dustjs.com/)
* [Swig](http://node-swig.github.io/swig-templates/)
* [Nunjucks](https://mozilla.github.io/nunjucks/)
* [Mustache](https://mustache.github.io/)
* [Handlebars](https://handlebarsjs.com/)

Yatte's powerful ability to parse and evaluate JavaScript expressions is indebted to:
* [angular-expressions](https://github.com/peerigon/angular-expressions#readme), which was (in turn) derived from [Angular](https://angular.io/).

Sponsors
--------

Development of Yatte was made possible through the sponsorship of [REAL Automators, Inc.](https://realautomators.com/).