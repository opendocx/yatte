# Transcript: Yatte, Knackly, Closures, Scope, Activation Frames, and Runtime Lowering

Date of discussion: Friday, June 5, 2026

This document records the substance and design history of a discussion about
JavaScript closures, lexical vs. dynamic scoping, Yatte's runtime model,
Knackly's compiler/type layer, activation frames, captures, memoization, and
possible runtime data-storage designs.

It is written as a structured transcript/notes document rather than an exact
verbatim chat log. It preserves the major questions, answers, terminology, and
design conclusions from the discussion.

---

## 1. Initial question: closures in JavaScript

The discussion began with a request for a brief explanation of closures in
JavaScript, including relevant vocabulary terms and how closures are commonly
implemented in a JavaScript runtime. The specific motivating concern was that
Yatte's runtime scope/context stack behavior did not seem to align well with
traditional closure behavior.

### Explanation of closures

A closure in JavaScript is a function plus the lexical environment in which that
function was created.

Example:

```js
function makeCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = makeCounter();

counter(); // 1
counter(); // 2
```

The returned `increment` function is a closure over `count`.

### Key vocabulary

- Lexical scope: Scope is determined by where code is written, not where it is
  called.
- Environment / lexical environment: A runtime structure holding variable
  bindings.
- Binding: An association between a variable name and a storage location/value.
- Free variable: A variable used by a function but not declared inside it.
  In the example above, `count` is free inside `increment`.
- Scope chain: A chain of environments searched when resolving a variable name.
- Activation frame / call frame: Temporary per-call storage for a function
  invocation.
- Closure environment: The preserved environment captured by a function.
- Context: Often an implementation term for the environment object or record
  attached to a function.
- `this` binding: Separate from lexical closure variables. Normal functions get
  `this` from call style; arrow functions close over lexical `this`.

### Typical JavaScript runtime implementation

Conceptually:

1. When a function is created, the runtime stores a pointer to the current
   lexical environment on the function object.
2. When the function is later called, the runtime creates a new local
   environment for that call.
3. That local environment points back to the function's captured outer
   environment.
4. Variable lookup walks that lexical chain: local bindings first, then captured
   outer bindings, then further ancestors.

For example:

```txt
increment function
  [[Environment]] -> makeCounter environment
                       count = 0
```

After `makeCounter()` returns, its normal call frame is gone, but the environment
containing `count` must stay alive because `increment` still references it.
JavaScript engines usually allocate such captured environments on the heap, or
"promote" escaping variables from stack storage to heap/context storage.

### Initial Yatte-related conclusion

The key distinction:

```txt
call/context stack  -> what is currently executing
lexical scope chain -> where a function/template/block was created
```

Closures depend on lexical scope, not only the current runtime stack.

If Yatte resolves variables primarily against the current runtime stack, it
behaves more like dynamic scoping. Traditional closure behavior requires
functions/templates/blocks that can escape their creation site to carry a
reference to their creation-time lexical environment.

---

## 2. Knackly/Yatte mismatch: lexical assumptions over dynamic behavior

The next point raised was that Knackly, Yatte's primary consumer, was built with
many assumptions of lexical scoping, while Yatte's runtime behavior is closer to
dynamic scoping. This mismatch has caused subtle bugs and ugly workarounds over
the years, such as prefixing identifiers with `this.` to avoid unwanted runtime
lookups.

Yatte's runtime environment is closely based on `angular-expressions`.
`angular-expressions` has a flat, two-tier environment:

```txt
locals
scope
```

Yatte effectively wraps a scope chain inside a proxy object that appears flat to
`angular-expressions`. This is one of the things that creates dynamic-scoping
behavior.

### Proposed direction

The suggested direction was that Knackly should perform:

- free variable analysis,
- lexical binding resolution,
- environment flattening,
- and perhaps closure conversion,

so that Knackly constructs an actual flat environment rather than relying on
Yatte's dynamic `YObject`/scope-chain behavior.

### Important refinement

Flattening must be based on lexical binding analysis, not on whatever the Yatte
runtime scope chain happens to contain at evaluation time.

Otherwise the system simply recreates dynamic behavior in a different shape.

The desired model is:

```txt
compiled expression:
  x -> captured binding #1
  y -> captured binding #2
  this.foo -> explicit receiver access
  Math -> builtin/global
```

Then the runtime environment can be flat:

```js
{
  x: capturedX,
  y: capturedY,
  this: currentObject,
  Math
}
```

The critical distinction is that `x` and `y` were chosen by lexical analysis, not
discovered by walking the active runtime context stack later.

### Terms introduced

- Free variable analysis: Find identifiers used inside a body but declared
  outside it.
- Lexical binding resolution: Decide which declaration each identifier refers to
  based on program/source structure.
- Closure conversion: Transform code so captured outer variables are stored or
  passed explicitly.
- Environment flattening: Represent the needed lexical environment as one flat
  object/map.
- Lexical address / symbol resolution: Replace name lookup with resolved
  references to known bindings.
- Capture by binding vs. capture by value: JavaScript captures bindings/cells,
  not merely current values.

The capture-by-binding nuance matters in JavaScript:

```js
let x = 1;
const f = () => x;
x = 2;
f(); // 2
```

But Knackly's immutability conventions change the practical requirements, as
discussed later.

---

## 3. Immutability, locals, parameters, and side-effect rules

The next clarification was that Knackly currently has neither parameters nor
local variables, though both are expected future features. The architecture
should avoid decisions that make those features harder later.

Yatte and server-side Knackly evaluation assume immutable data. Assignment is
currently disallowed altogether. When local variables are eventually implemented,
locals should be mutable, but broader data/free variables/parameters should not
be mutable.

The desired rule is:

```txt
No side effects.
```

Client-side Knackly does allow user-driven data mutation, but evaluation itself
does not mutate data. Instead, user actions rebuild scope objects/data structures
to reflect changed input.

### Consequence for closure/capture design

Knackly closures do not necessarily need full JavaScript-style mutable captured
bindings if:

- only locals are assignable,
- parameters are immutable,
- outer/free variables are immutable,
- data is immutable,
- property writes are disallowed.

Instead of JavaScript's general model:

```txt
closure captures mutable binding cells
```

Knackly can likely use:

```txt
closure captures immutable values/references for free variables
closure owns mutable cells only for its own locals
```

### Suggested conceptual split

```txt
lexical environment
  immutable captured bindings:
    outer data
    outer parameters
    outer constants/free variables

activation frame
  mutable local bindings:
    let-style locals for this invocation
```

For server-side evaluation:

- data scope: immutable,
- parameters: immutable,
- free variables: immutable captured bindings,
- locals: mutable within an invocation,
- assignments: allowed only to local variables,
- property writes: disallowed,
- outer variable writes: disallowed,
- parameter writes: disallowed,
- captured free-variable writes: disallowed.

This means free variables can often be captured by immutable value/reference,
rather than by mutable cell.

### Identifier classification

Once Knackly has a compiler/type layer, each identifier should be classified:

```txt
foo
  -> local variable
  -> parameter
  -> captured lexical binding
  -> member of this/current data object
  -> global/builtin
  -> error/unknown
```

Then Yatte/tinq should receive an environment where `foo` means exactly that
binding, or the expression should be rewritten to make the receiver explicit.

---

## 4. Activation frames

The next major topic was the activation frame, a concept that had not previously
been explicit in Yatte/Knackly.

### Definition

An activation frame is the runtime record for one invocation of something
callable.

It is:

```txt
the per-call storage created when a function/template/rule/computation starts
running, and discarded when that invocation finishes.
```

Example:

```js
function addTax(amount, rate) {
  let subtotal = amount;
  return subtotal * (1 + rate);
}

addTax(100, 0.07);
addTax(200, 0.05);
```

Each call has its own frame:

```txt
call #1 frame
  amount = 100
  rate = 0.07
  subtotal = 100

call #2 frame
  amount = 200
  rate = 0.05
  subtotal = 200
```

They do not share locals or parameters.

### What belongs in an activation frame?

Typically:

```txt
activation frame
  parameters
  local variables
  temporary evaluation state
  current receiver / this, depending on language design
  link to lexical parent/captures
```

For Knackly/Yatte:

```txt
activation frame
  params: immutable bindings
  locals: mutable bindings
  captures: immutable lexical bindings
  this: current data object
  globals: builtins/functions
```

The important part is that locals and parameters live in the invocation, not in a
general global/scope object.

### Compiler side

The compiler defines the frame shape.

Example future Knackly-like rule:

```txt
rule Total(amount, rate) {
  let subtotal = amount;
  let tax = subtotal * rate;
  return subtotal + tax;
}
```

The compiler might produce metadata like:

```js
{
  name: "Total",
  params: ["amount", "rate"],
  locals: ["subtotal", "tax"],
  captures: [],
  body: compiledExpressionOrInstructions
}
```

If the rule refers to something outside itself:

```txt
rule Total(amount) {
  let subtotal = amount;
  return subtotal * (1 + defaultTaxRate);
}
```

Then:

```js
{
  params: ["amount"],
  locals: ["subtotal"],
  captures: ["defaultTaxRate"]
}
```

The compiler has not executed the rule. It has determined:

- what storage the invocation needs,
- which names are local,
- which names are parameters,
- which names are captured from lexical scope,
- which names are field accesses or globals,
- and how each identifier should resolve.

### Runtime side

At runtime, when the rule/template/function is invoked, the runtime creates a
fresh frame from the compiler's frame definition:

```js
function invoke(compiledRule, args, lexicalEnv, thisValue) {
  const frame = {
    params: bindParams(compiledRule.params, args),
    locals: initializeLocals(compiledRule.locals),
    captures: captureValues(compiledRule.captures, lexicalEnv),
    this: thisValue
  };

  return evaluate(compiledRule.body, frame);
}
```

### Why activation frames matter

Without activation frames, it is tempting to evaluate everything against "the
current scope object" or "the current context stack."

That blurs several different concepts:

```txt
current data object
current call's parameters
current call's locals
outer lexical variables
runtime parent context
global functions
```

Once blurred together, lookup tends to become dynamic:

```txt
resolve x by walking whatever contexts happen to be active
```

An activation frame lets the compiler/runtime say:

```txt
x was resolved by the compiler as local slot #0
rate was resolved as parameter slot #1
defaultTaxRate was resolved as captured binding #0
this.customer.name is a property read from this
```

### Short formulation

```txt
Lexical environment:
  where was this code defined?

Activation frame:
  what storage exists for this specific execution?
```

For every invocable thing - template, rule, function, formula, etc. - the
compiler should create a definition/shape for that thing's activation frame.

---

## 5. Angular-expressions as runtime backend vs. tinq

The discussion then turned to whether it was practical to continue using
`angular-expressions` as the basis of the runtime.

Relevant facts about `angular-expressions`:

- Compiled functions expect up to four parameters:
  - `scope`,
  - `locals`,
  - `assign`,
  - `inputs`.
- Unqualified identifiers are looked up first in `locals` if defined, then in
  `scope`.
- `this` resolves to `scope`.
- `locals$` resolves to `locals`.
- `assign` is used for assignment/mutation behavior.
- `inputs` is used for some optimization/dependency behavior.

### Problems for Knackly/Yatte

`angular-expressions` has no native representation for:

- `this` as separate from the general scope,
- parameters as a distinct environment,
- mutable locals separate from immutable captures,
- immutable free variables,
- explicit globals,
- strict assignment rules where only locals are mutable.

It only has:

```txt
scope
locals
```

### Possible transitional mapping

The least-bad transitional mapping would be:

```txt
angular scope  -> Knackly receiver / this object
angular locals -> Knackly activation frame bindings:
                   params
                   locals
                   captures
                   selected globals
```

Then:

```js
compiled(scope, locals)
```

would mean:

```txt
compiled(thisObject, activationFrameBindings)
```

This could work for read-only expressions if Knackly performs lexical analysis
first and constructs a true flat locals object.

### Caveats

1. Bare identifier fallback to `scope` is dangerous.

   If `foo` is not in `locals`, angular falls back to `scope.foo`, which means
   unresolved names can silently become property reads from `this`.

2. Assignment semantics are likely a deal-breaker.

   If future Knackly assignment means "only locals are mutable", angular's
   default assignment behavior is not aligned.

3. `scope`/`locals` is too small a semantic model.

   Knackly wants distinctions angular does not understand:

   ```txt
   receiver / this
   params
   mutable locals
   immutable captures
   globals
   builtins
   field access
   lexical parents
   ```

### Conclusion

`angular-expressions` may be usable only as a temporary expression backend behind
a stricter Knackly compiler layer. However, given the broader mismatches,
especially around list filtering and assignment/scoping semantics, continuing to
use angular as the semantic core feels too much like a hack.

The better strategic direction is to fix and evolve `tinq` as the replacement
runtime, incorporating:

- activation frames,
- lexical binding resolution,
- explicit captures,
- explicit receiver/this,
- strict assignment rules,
- and better list/filter semantics.

---

## 6. Captures: what they look like in practice

The next deep topic was captures.

Knackly's resolver currently maintains a running context stack while analyzing.
`this` is essentially the top frame of that context stack. When Knackly
encounters a bare identifier, it checks the top frame, then walks up subsequent
frames. The last frame is always `__`, containing built-ins and globally-defined
objects/functions. This lets user-defined identifiers shadow globals, because
globals are last in the lookup order.

The open question was: how should a compiler store/serialize/visualize a
reference to a free variable found somewhere in the middle of a complex context
stack?

### Lexical address

A traditional compiler representation is a lexical address:

```txt
identifier "foo"
  -> frame depth 2
  -> binding name "foo"
```

Meaning:

```txt
current frame      depth 0
parent frame       depth 1
grandparent frame  depth 2  <-- foo lives here
globals frame      last
```

This is useful internally, but fragile as a durable/debug representation.

### Binding descriptor

For Knackly, a better durable representation is a binding descriptor:

```ts
{
  requestedName: "foo",
  resolvedName: "foo",
  kind: "capture",
  sourceFrameId: "ClientContext",
  sourceFrameDepth: 2,
  sourcePath: ["foo"],
  valueType: "Text",
  mutable: false
}
```

After lowering, this might become:

```ts
{
  captureName: "$cap0",
  originalName: "foo",
  source: {
    frameId: "ClientContext",
    path: ["foo"]
  },
  type: "Text"
}
```

The compiled expression no longer means:

```txt
look up foo dynamically
```

It means:

```txt
read capture slot $cap0
```

### Three views of a capture

There are three useful representations of the same binding:

```txt
Human/debug view:
  foo from ParentContext.foo

Compiler view:
  lexical address depth 2, binding foo

Runtime view:
  capture slot 0
```

### Capture timing

A design choice must be explicit:

```txt
capture the resolved value now
```

vs.

```txt
capture the source object/path and read it later
```

For server-side immutable evaluation, capturing the resolved value/reference now
is simpler and cleaner. For browser/client rebuilding, this is also acceptable if
user edits cause relevant compiled/invoked structures to be rebuilt with new
captures.

---

## 7. Dynamic frames produced by formulas

The next concern was how to identify a `sourceFrameId` for dynamic frames.

Simple built-in frames are easy:

- `__` for globals,
- `_` for top-level user data.

Regular properties can use property names and paths.

The complication is that Yatte/Knackly allow formulas to produce complex values,
including objects and arrays of objects, and these computed values can then
become frames on the context stack for further evaluation.

Knackly's static analysis performs a kind of design-time "pseudo-evaluation",
where it processes a formula and determines possible results and the logical
conditions under which each result appears.

Examples:

- `CurrentParty` might refer to either `Client` or `Spouse` depending on
  conditions.
- `AllParties` might concatenate `Client`, `Spouse`, and `Children` into a flat
  list.

The question was whether, for activation-frame purposes, such dynamic frames can
be identified using the formula name.

### Recommended distinction

Do not make `sourceFrameId` primarily describe the runtime object. Make it
identify the compiler-known binding/frame producer.

Separate three concepts:

```txt
1. Binding identity
   "What compiler-known thing did this resolve to?"

2. Provenance / alternatives
   "What possible concrete data locations or values could this represent?"

3. Runtime slot
   "Where is the actual value stored for this invocation?"
```

For a dynamic formula frame:

```ts
{
  id: "formula:CurrentParty",
  kind: "formulaResult",
  type: "Party",
  alternatives: [
    { source: "_.Client", condition: "condition A" },
    { source: "_.Spouse", condition: "condition B" }
  ]
}
```

The activation frame itself may only need:

```txt
captures:
  $cap0 = value of CurrentParty.Name for this invocation
```

or:

```txt
captures:
  $cap0 = current CurrentParty object
```

depending on whether the capture is a property value or the produced object.

### Stable compiler symbols

Using formula names is reasonable, but the identity should be a stable compiler
symbol, not merely a display string:

```txt
formula:CurrentParty@DocumentModel.SomeTemplate.SomeBlock
```

or internally:

```txt
symbolId: 1842
displayName: "CurrentParty"
kind: "formulaResult"
```

For `AllParties`:

```txt
frame: element-of formula-result(AllParties)
type: Party
alternatives:
  - _.Client
  - _.Spouse
  - _.Children[]
```

A capture from that frame could be:

```txt
capture $cap0
  original: Name
  sourceFrame: element-of(AllParties)
  path: Name
  type: Text
```

At runtime, during a specific iteration, `$cap0` is just the current party's
`Name`.

### Conclusion

Dynamic frames should be first-class compiler frame symbols. Their identity
should come from the lexical/semantic producer of the frame, while their possible
concrete meanings remain analysis metadata.

---

## 8. Named formulas/templates and memoization

The next topic was how the compiler can help the runtime avoid repeated
evaluation of the same formulas/templates when no inputs have changed.

Yatte currently has "Scope" objects that reflect the developer's mental model:

- each scope knows its type,
- each scope knows its parent,
- each scope knows its properties,
- each scope knows its virtuals, such as compiled expressions/templates.

This is pleasant conceptually but complex, especially for memoization.

### Core recommendation

Named formulas/templates should compile into pure functions with explicit
dependencies.

Instead of runtime discovery:

```txt
What does this scope contain?
Who is my parent?
If I evaluate Foo, what might it read?
```

the compiler should know:

```txt
Formula Foo
  symbolId: formula:Party.FullName
  receiver type: Party
  params: []
  captures: [...]
  reads:
    this.FirstName
    this.LastName
  returns: Text
  pure: true
```

### Stable symbols

Every named formula/template should get a stable symbol:

```ts
{
  symbolId: "formula:Party.FullName",
  displayName: "FullName",
  ownerType: "Party",
  kind: "formula",
  returnType: "Text"
}
```

The runtime should not identify formulas primarily by object shape or scope
traversal.

### Dependency metadata

For:

```txt
FullName = FirstName + " " + LastName
```

the compiler can emit:

```ts
reads: [
  { source: "this", path: ["FirstName"] },
  { source: "this", path: ["LastName"] }
]
```

For:

```txt
DisplayName = FormatName(FirstName, LastName)
```

it might emit:

```ts
captures: [
  { slot: 0, symbolId: "global:FormatName" }
],
reads: [
  { source: "this", path: ["FirstName"] },
  { source: "this", path: ["LastName"] }
]
```

### Cache key concept

Formula/template memoization can be based on:

```txt
formula/template symbol
+ receiver identity/version
+ params, if any
+ captured binding identities/versions
```

For example:

```txt
Party.FullName
receiver: Party#123 version 17
captures: FormatName version 3
params: none
```

Because data is immutable, caching often becomes much simpler.

### Templates

Templates can be treated similarly:

```txt
Template RenderParty
  receiver type: Party
  params: [...]
  captures: [...]
  reads: [...]
  output type: Fragment
```

Memoization can use:

```txt
template symbol
+ receiver identity/version
+ params
+ captures
```

### Developer-facing scopes vs. lowered runtime

The developer model can remain:

```txt
Type has properties
Type has formulas
Type has templates
Formula belongs to type
```

But the runtime representation should be lower-level:

```txt
compiled symbols
activation frame shapes
binding tables
dependency summaries
cache keys
```

---

## 9. Lowering data and behavior

The term "lowering" was then discussed.

### Definition

Lowering means taking the nice source/developer model and transforming it into a
runtime model that is less pretty but more explicit and efficient.

Current-style model:

```txt
Source/developer model:
  Party has FirstName, LastName, FullName formula

Runtime model:
  JSON object shaped like Party
  object/prototype extended with FullName()
  scope object wraps this object
  runtime lookup discovers what to do
```

Lowered model:

```txt
data storage
type metadata
compiled formula/template functions
memo/cache storage
```

Instead of attaching behavior to data objects, data should remain mostly plain
immutable records, with behavior kept in compiled tables.

### Example compiled model

```ts
const compiledModel = {
  types: {
    Party: {
      fields: {
        FirstName: { slot: 0, type: "Text" },
        LastName: { slot: 1, type: "Text" },
        BirthDate: { slot: 2, type: "Date" }
      },
      formulas: {
        FullName: "formula:Party.FullName"
      }
    }
  },

  formulas: {
    "formula:Party.FullName": {
      receiverType: "Party",
      reads: [
        { source: "this", slot: 0 },
        { source: "this", slot: 1 }
      ],
      eval: compiledFunction
    }
  }
};
```

Pretty JSON:

```json
{
  "FirstName": "Ada",
  "LastName": "Lovelace"
}
```

Conservative lowered runtime value:

```ts
{
  typeId: "Party",
  data: {
    FirstName: "Ada",
    LastName: "Lovelace"
  },
  id: "party:123",
  version: 1
}
```

More aggressive slot-based lowered runtime value:

```ts
{
  typeId: "Party",
  slots: ["Ada", "Lovelace", null],
  id: "party:123",
  version: 1
}
```

### Suggested runtime layers

```txt
RuntimeValue
  typeId
  immutable data
  identity/version

CompiledModel
  type definitions
  field definitions
  formula/template symbols
  compiled evaluator functions
  dependency metadata

EvaluationSession
  memoization cache
  current activation frame stack
```

Formula evaluation becomes:

```ts
evaluateFormula(session, receiver, "FullName") {
  const formula = compiledModel.lookupFormula(receiver.typeId, "FullName");

  const key = makeCacheKey(formula.symbolId, receiver.identityOrHash);

  if (session.cache.has(key)) return session.cache.get(key);

  const frame = createActivationFrame(formula, receiver);
  const result = formula.eval(frame);

  session.cache.set(key, result);
  return result;
}
```

### Memoization storage

Cached formula/template results should usually live in an evaluation session or
cache, not on the data object itself:

```txt
cache key:
  formula symbol
  receiver identity/version
  parameter values
  capture identities/versions
```

This keeps data immutable and avoids prototype/object mutation.

### Conservative vs. aggressive lowering

Conservative:

```ts
{
  typeId: "Party",
  data: originalJsonObject
}
```

Field reads:

```ts
readField(receiver, "FirstName")
```

Aggressive:

```ts
{
  typeId: PARTY,
  slots: ["Ada", "Lovelace"]
}
```

Field reads:

```ts
receiver.slots[0]
```

Hybrid:

```ts
{
  typeId,
  source: originalObject,
  fields: loweredSlotsOrLazyFieldReaders,
  version
}
```

### Main suggestion

Move toward:

```txt
plain immutable data nodes
+ compiled symbol tables
+ per-evaluation memo cache
```

Pretty JSON remains the input/output format and developer mental model. The
lowered runtime model is explicit about type identity, field access, formula
dispatch, activation frames, and cached evaluation results.

---

## 10. Parent/child object storage

The next question was how a parent object containing child object(s) might look
in a lowered runtime. Example: a `Party` object containing an `Address` object.

### Conservative direct-node example

Pretty JSON:

```json
{
  "FirstName": "Ada",
  "Address": {
    "Street": "1 Main",
    "City": "London"
  }
}
```

Runtime nodes might be conceptually:

```ts
const address1 = {
  nodeId: "addr-1",
  typeId: "Address",
  version: 1,
  data: {
    Street: "1 Main",
    City: "London"
  }
};

const party1 = {
  nodeId: "party-1",
  typeId: "Party",
  version: 1,
  data: {
    FirstName: "Ada",
    Address: address1
  }
};
```

This was later clarified as merely a literal representation of an object graph,
not a suggestion that literal `const` declarations exist in real code.

### Slot-lowered example

```ts
const address1 = {
  nodeId: "addr-1",
  typeId: ADDRESS,
  version: 1,
  slots: [
    "1 Main", // Street
    "London"  // City
  ]
};

const party1 = {
  nodeId: "party-1",
  typeId: PARTY,
  version: 1,
  slots: [
    "Ada",    // FirstName
    address1  // Address
  ]
};
```

Arrays:

```ts
const party1 = {
  typeId: PARTY,
  slots: [
    "Ada",
    [child1, child2, child3] // Children
  ]
};
```

The parent stores references to child runtime nodes, not copied child data.

If data is immutable, updating `Address.City` creates a new address node and
usually a new parent party node pointing to it:

```txt
party v1 -> address v1
party v2 -> address v2
```

---

## 11. Memoization with AllParties and nested formulas

The next question explored a specific memoization scenario.

Example:

- `AllParties` produces a list by combining `Client`, `Spouse`, and `Children`.
- In a template:

  ```txt
  {[list AllParties]}
    {[ExpensiveComputation]}
  {[endlist]}
  ```

- The result of `ExpensiveComputation` should presumably be memoized for each
  entry in the list.
- If `Client.ExpensiveComputation` is called separately, should it use the same
  memoized result?
- The whole enclosing template may also be memoized.

### Receiver identity

`receiver identity/version` means the object bound to `this` for this invocation.

### Capture identities

`capture identities/versions` should cover the actual resolved captures that the
compiled formula depends on, not the entire context stack.

This distinction is critical:

```txt
use resolved captures only, not whole dynamic context stack
```

Example:

```txt
ExpensiveComputation
  receiver: Party
  captures:
    TaxYear
    Jurisdiction
```

Cache key:

```txt
formula:Party.ExpensiveComputation
this: party-1@v1
captures:
  TaxYear: 2026
  Jurisdiction: Texas@v3
params: none
```

Not:

```txt
entire current context stack
```

### AllParties

For:

```txt
AllParties = [Client] + [Spouse] + Children
```

Memo key:

```txt
formula:Matter.AllParties
this: matter-1@v12
captures: none
params: none
```

Result:

```txt
[
  party-client@v4,
  party-spouse@v2,
  party-child-1@v1
]
```

Then:

```txt
{[list AllParties]}
  {[ExpensiveComputation]}
{[endlist]}
```

sets `this` to each party node in turn:

```txt
ExpensiveComputation(this = party-client@v4)
ExpensiveComputation(this = party-spouse@v2)
ExpensiveComputation(this = party-child-1@v1)
```

Cache keys:

```txt
formula:Party.ExpensiveComputation | this=party-client@v4 | captures=...
formula:Party.ExpensiveComputation | this=party-spouse@v2 | captures=...
formula:Party.ExpensiveComputation | this=party-child-1@v1 | captures=...
```

If `Client.ExpensiveComputation` separately resolves to the same formula symbol
with the same receiver node and same captures, it should reuse the same
memoized result:

```txt
formula:Party.ExpensiveComputation | this=party-client@v4 | captures=...
```

If captures differ, it should not reuse the result.

### Nested calls and parent template memoization

The enclosing template can also have a memo key:

```txt
template:RenderAllParties
this: matter-1@v12
captures: whatever template captures
params: none
```

The template body may internally call:

```txt
AllParties
ExpensiveComputation(client)
ExpensiveComputation(spouse)
...
```

Those sub-results can be memoized independently. The template result can also be
memoized as a whole.

Useful mental model:

```txt
Each formula/template invocation has its own cache key.

Nested calls do not become part of the parent key directly.
They are separate memoized invocations.

The parent key only needs to represent the parent's direct semantic inputs.
```

Because data is immutable, if `AllParties` changes, the `Matter` node/version
changes and the template's receiver key changes, causing recomputation.

---

## 12. Runtime storage: where nodes live

After seeing examples like `const address1 = ...`, the question was: what data
structure do these runtime nodes live inside?

Possible storage strategies were discussed.

### Option 1: Direct object graph

The root object directly contains child node objects:

```ts
const root = {
  nodeId: "matter-1",
  typeId: "Matter",
  version: 1,
  data: {
    Client: {
      nodeId: "party-1",
      typeId: "Party",
      version: 1,
      data: {
        Address: {
          nodeId: "addr-1",
          typeId: "Address",
          version: 1,
          data: {
            City: "London"
          }
        }
      }
    }
  }
};
```

Pros:

- simple,
- easy to debug,
- easy migration from current JSON model.

Cons:

- harder to share nodes,
- harder to canonicalize identity,
- harder to maintain central version/index metadata,
- cache keys may need stable IDs/hashes attached to nodes.

This is probably the easiest transitional model.

### Option 2: Flat node store keyed by nodeId

```ts
const store = {
  nodes: {
    "matter-1": {
      nodeId: "matter-1",
      typeId: "Matter",
      version: 1,
      fields: {
        Client: { ref: "party-1" }
      }
    },

    "party-1": {
      nodeId: "party-1",
      typeId: "Party",
      version: 1,
      fields: {
        FirstName: "Ada",
        Address: { ref: "addr-1" }
      }
    },

    "addr-1": {
      nodeId: "addr-1",
      typeId: "Address",
      version: 1,
      fields: {
        City: "London"
      }
    }
  },

  rootRef: { ref: "matter-1" }
};
```

Arrays:

```ts
Children: [{ ref: "child-1" }, { ref: "child-2" }]
```

Pros:

- clear identity,
- easier memoization keys,
- easier sharing/deduplication,
- easier indexing,
- easier persistence/debug tooling.

Cons:

- more indirection,
- less natural than JSON,
- must dereference refs during evaluation.

This is essentially a small immutable object heap.

### Option 3: Store grouped by type

```ts
const store = {
  Matter: {
    "matter-1": { version: 1, fields: { Client: { ref: "party-1" } } }
  },
  Party: {
    "party-1": { version: 1, fields: { FirstName: "Ada" } }
  },
  Address: {
    "addr-1": { version: 1, fields: { City: "London" } }
  }
};
```

Pros:

- useful for querying all nodes of a type,
- can be compact/efficient,
- type-specific storage layouts are easier.

Cons:

- lookup requires type plus id, or a global id index,
- more complicated if IDs are globally unique anyway,
- unnecessary unless querying by type is important.

Querying by type did not seem necessary for Knackly/Yatte's stated use cases.

### Option 4: Hybrid object graph plus side tables

Keep direct object references, but maintain side metadata:

```ts
const root = { /* nested runtime nodes */ };

const metadata = new WeakMap();

metadata.set(partyObject, {
  nodeId: "party-1",
  typeId: "Party",
  version: 1
});
```

Memoization can key by object identity:

```ts
cache.get(formulaSymbol, partyObject)
```

Pros:

- minimal disruption,
- preserves natural object graph,
- object identity works well if immutable nodes are rebuilt on change.

Cons:

- harder to serialize/debug,
- WeakMap metadata is invisible,
- stable IDs require extra care.

This may be a good incremental bridge from the current Yatte model.

### Recommended mental model

```ts
type RuntimeStore = {
  root: RuntimeRef;
  nodesById: Map<NodeId, RuntimeNode>;
  cache: EvaluationCache;
};

type RuntimeNode = {
  id: NodeId;
  typeId: TypeId;
  version: number;
  fields: Record<string, RuntimeValue>;
};

type RuntimeValue =
  | null
  | boolean
  | number
  | string
  | RuntimeRef
  | RuntimeValue[];

type RuntimeRef = {
  id: NodeId;
};
```

Or, in words:

```txt
RuntimeStore = heap of immutable typed nodes
RuntimeRef = pointer into that heap
RuntimeNode = typed object with fields
EvaluationCache = memoized formula/template results
```

---

## 13. Node IDs: compiler or runtime?

The next question was who assigns node IDs.

The examples used IDs like `party-1`, but querying by type is not needed, and it
was unclear how such IDs would be generated if there are arbitrary array
elements.

### Answer

For normal input data:

```txt
node IDs are runtime/data-store identities, not compiler IDs
```

The compiler knows:

```txt
Matter.Client has type Party
Matter.Children has element type Party
Party.Address has type Address
```

But the compiler does not know how many children exist in a particular runtime
document, so it cannot assign IDs to those nodes.

The compiler assigns IDs to symbols:

```txt
type: Party
field: Party.Address
formula: Party.FullName
template: Matter.Main
param: SomeTemplate.party
local: loop.index
capture slot: cap0
```

The runtime assigns identities to data instances:

```txt
this particular Matter
this particular Client
this particular Child[0]
this particular Address
```

### Runtime ID options

#### Option 1: Path-based IDs

Derive IDs from location in the input tree:

```txt
_
_.Client
_.Client.Address
_.Children[0]
_.Children[1]
```

Example:

```txt
nodeId = "$.Client.Address"
```

Pros:

- easy,
- deterministic,
- no counters needed,
- great for debugging.

Cons:

- identity changes if an array is reordered,
- identity changes if data moves,
- not ideal if the same object appears in multiple places.

For document-generation/server-side immutable evaluation, this may be good
enough.

#### Option 2: Generated opaque IDs

Assign IDs as the runtime traverses the JSON:

```txt
n1, n2, n3, n4
```

No need to count parties specifically. Maintain one global counter:

```ts
nextNodeId++;
```

Pros:

- simple,
- type-independent,
- compact.

Cons:

- IDs depend on traversal order,
- less human-readable,
- need stable ordering for deterministic output.

#### Option 3: Domain IDs when available

If source data has stable IDs:

```json
{
  "Children": [
    { "Id": "child-a", "Name": "Anna" },
    { "Id": "child-b", "Name": "Ben" }
  ]
}
```

runtime node IDs can incorporate those:

```txt
Party:child-a
Party:child-b
```

Pros:

- stable across reorder/move,
- good for client-side updates.

Cons:

- not all data has IDs,
- collisions/missing IDs must be handled.

#### Option 4: Object identity / WeakMap

If keeping direct runtime objects, identity can be the object reference itself:

```txt
cache key uses object reference + version
```

Pros:

- no explicit IDs needed,
- easy in JS runtime,
- works well with immutable rebuilt objects.

Cons:

- not serializable,
- harder to debug,
- less useful across evaluation sessions.

### Suggested starting point

Given the current model, path-based IDs are attractive initially:

```txt
_
_.Client
_.Spouse
_.Children[0]
_.Children[0].Address
```

They align with the existing mental model of scopes/context paths and make
debugging easier. Later, if reorder stability matters, domain IDs or opaque
persistent IDs can be added.

---

## 14. Versions

The final conceptual question was about the repeated notation `@ version n` in
memoization keys.

### Meaning of version

A version distinguishes:

```txt
same logical object, different state
```

Example:

```txt
_.Client @ v1
  FirstName = "Ada"

_.Client @ v2
  FirstName = "Grace"
```

A memoized value for:

```txt
formula:Party.FullName
receiver: _.Client @ v1
```

must not be reused after the client changes to `v2`.

### Server-side immutable evaluation

On the server, if data is loaded once and never mutated during evaluation,
versions can be trivial:

```txt
all nodes version = 1
```

or omitted entirely if object identity/path identity is sufficient.

### Client-side runtime

On the client, when the user edits data, versions can be bumped.

Two broad models:

#### Model 1: Mutable nodes with version bumps

```txt
same node id: _.Client
version changes: 1 -> 2 -> 3
```

Cache key includes:

```txt
_.Client @ v3
```

Old cache entries naturally stop matching. They can be cleared periodically.

Pros:

- simple mental model,
- stable IDs,
- easy cache invalidation.

Cons:

- must be disciplined about bumping versions,
- parent/derived versions may also need updating.

#### Model 2: Immutable replacement nodes

```txt
old client node object is replaced by new client node object
```

Object identity itself changes, so version may be unnecessary, or version is only
debug metadata.

Pros:

- clean memoization,
- old versions can support undo/time travel,
- no accidental mutation.

Cons:

- more allocation,
- parent nodes usually need replacement too.

### Parent version propagation

If `Client.Address.City` changes, either object identity or versions need to
reflect that change up the graph.

With immutable replacement:

```txt
Address v1 -> Address v2
Client v1  -> Client v2, because it points to Address v2
Matter v1  -> Matter v2, because it points to Client v2
```

This safely invalidates formulas on `Matter`, `Client`, and `Address`.

With mutable nodes and version bumps, equivalent propagation or
dependency-aware invalidation is required.

### Keeping old versions

Old versions can be:

- immediately discarded,
- left in cache until cleanup,
- retained intentionally for undo/history.

The main purpose of versioning here is cache correctness, not necessarily
history retention.

### Short formulation

```txt
@ version n means:
  the state of this runtime node at the time this memoized result was computed.
```

When user data changes, the changed node and usually its ancestors get new
versions or new identities so stale memoized results are not reused.

---

## 15. Consolidated design direction

The overall direction that emerged from the discussion:

1. Yatte's current scope-chain-through-flat-proxy model behaves too much like
   dynamic scoping.
2. Knackly has long assumed lexical scoping, causing subtle bugs and workarounds.
3. Knackly should perform lexical binding resolution and free-variable analysis.
4. Invocable things should have compiler-defined activation-frame shapes.
5. Activation frames should distinguish:
   - receiver / `this`,
   - immutable params,
   - mutable locals,
   - immutable captures,
   - globals/builtins.
6. Captures should be explicit binding records/slots, not dynamic stack lookups.
7. Dynamic frames from formulas should be represented by stable compiler symbols
   for the producing formula/frame, with provenance alternatives tracked as
   analysis metadata.
8. Continuing to rely on `angular-expressions` appears strategically unwise
   because its `scope`/`locals` model is too small and its assignment/list
   behavior mismatches Yatte/Knackly's needs.
9. The experimental `tinq` runtime should likely be revisited and updated with
   the concepts above.
10. Runtime data should likely be lowered toward immutable typed nodes plus
    compiled symbol tables plus an evaluation cache.
11. Formula/template memoization should be based on explicit symbols, receiver
    identity/version, params, and resolved captures.
12. Node identity should be assigned by the runtime/data store, not the compiler.
13. Compiler IDs should identify symbols, fields, formulas, templates, params,
    locals, captures, and frame producers.
14. Runtime IDs should identify specific data instances.
15. Versions or immutable replacement should be used to prevent stale memoized
    results after client-side data changes.

---

## 16. Vocabulary recap

- Activation frame: Per-invocation runtime storage for params, locals, receiver,
  captures, etc.
- Binding: Association between a name and a storage location/value.
- Binding descriptor: Compiler record describing what a resolved identifier
  means.
- Capture: A binding from an outer lexical environment made available to an
  inner invocable.
- Closure conversion: Transforming implicit free-variable access into explicit
  environment/capture access.
- Context stack: Current Yatte/Knackly-style analysis/runtime stack of frames.
- Dynamic scoping: Name resolution based on the active call/runtime stack.
- Environment flattening: Creating a flat runtime environment containing
  exactly the bindings needed.
- Free variable: A variable used inside a body but declared/resolved outside it.
- Lexical address: Internal compiler representation such as depth plus binding
  name/slot.
- Lexical binding resolution: Deciding identifier meaning from source/program
  structure.
- Lexical scoping: Name resolution based on where code is defined.
- Lowering: Transforming a source/developer-friendly model into a more explicit
  runtime representation.
- Receiver: The object bound to `this` for a formula/template/function
  invocation.
- Runtime node: A typed runtime representation of an input/data object.
- Runtime store: The data structure/heap holding runtime nodes and references.
- Symbol: Compiler-assigned identity for types, fields, formulas, templates,
  params, locals, captures, etc.
- Version: A marker distinguishing different states of the same logical runtime
  object.

---

## 17. A possible future architecture sketch

```txt
Source model
  types
  fields
  formulas
  templates
  rules

Compiler
  parse
  type check
  lexical binding resolution
  free-variable analysis
  activation-frame shape generation
  capture-slot generation
  dependency analysis
  lowering to IR/evaluator functions

Compiled model
  type table
  field table
  formula/template symbol table
  frame definitions
  capture descriptors
  dependency summaries
  evaluator code/IR

Runtime store
  immutable typed data nodes
  runtime node identities
  versions or immutable replacement
  refs between parent/child nodes

Evaluation session
  activation frame stack
  memoization cache
  evaluation diagnostics/provenance

Invocation
  choose compiled symbol
  bind receiver
  bind params
  bind captures
  initialize locals
  evaluate body
  memoize result
```

This architecture keeps the developer-facing mental model intact while moving
runtime execution toward explicit lexical semantics, safer assignment rules, and
more reliable memoization.
