const assert = require('assert');
const templater = require('../text-templater');
const TextEvaluator = require('../text-evaluator');
//const types = require('./types-test');

describe('Assembling text templates', function() {
    it('should assemble a simple template', function() {
        const template = "Hello {[planet]}!";
        const compiled = templater.parseTemplate(template);
        const data = {planet: "World"};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "Hello World!");
    });
    it('should assemble the FullName template', function() {
        const template = "{[First]} {[if Middle]}{[Middle]} {[endif]}{[Last]}{[if Suffix]} {[Suffix]}{[endif]}";
        const compiled = templater.parseTemplate(template);
        const data = {First: "John", Last: "Smith", Suffix: "Jr."};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "John Smith Jr.");
    });
    it('should assemble the if/endif template', function() {
        const template = "{[if true]}A{[endif]}";
        const compiled = templater.parseTemplate(template);
        const data = {};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "A");
    });
    it('should assemble the if/else/endif template', function() {
        const template = "{[if false]}A{[else]}B{[endif]}";
        const compiled = templater.parseTemplate(template);
        const data = {};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "B");
    });
    it('should assemble the if/elseif/endif template', function() {
        const template = "{[if false]}A{[elseif true]}B{[endif]}";
        const compiled = templater.parseTemplate(template);
        const data = {};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "B");
    });
    it('should assemble the if/elseif/else/endif template', function() {
        const template = "{[if false]}A{[elseif false]}B{[else]}C{[endif]}";
        const compiled = templater.parseTemplate(template);
        const data = {};
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "C");
    });
    it('should assemble the oceans template', function() {
        const template = "Oceans are:\n\n{[list Oceans]}\n * {[Name]} (Average depth {[AverageDepth]} m)\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Planet":"Earth",
            "Continents":["Africa","Asia","Europe","North America","South America","Antarctica","Australia/Oceania"],
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
            "IsHome":true,
            "Lifeless":false
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "Oceans are:\n\n * Pacific (Average depth 3970 m)\n * Atlantic (Average depth 3646 m)\n * Indian (Average depth 3741 m)\n * Southern (Average depth 3270 m)\n * Arctic (Average depth 1205 m)\n");
    });
    it('should assemble a filtered list', function() {
        const template = "Continents containing u:\n\n{[list Continents.WithU]}\n * {[.]}\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Planet":"Earth",
            "Continents":["Africa","Asia","Europe","North America","South America","Antarctica","Australia/Oceania"],
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
            "IsHome":true,
            "Lifeless":false
        };
        Object.defineProperty(data.Continents, 'WithU', { get: function() { return this.filter(item => item.includes("u")) } });
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "Continents containing u:\n\n * Europe\n * South America\n * Australia/Oceania\n");
    });
    it('should assemble a dynamically filtered list', function() {
        const template = "{[list Oceans | filter: AverageDepth < 3500]}\n * {[Name]}\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, " * Southern\n * Arctic\n");
    });
    it('should assemble a dynamically sorted list (ascending by name)', function() {
        const template = "{[list Oceans | sort: Name]}\n*{[Name]}\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "*Arctic\n*Atlantic\n*Indian\n*Pacific\n*Southern\n");
    });
    it('should assemble a dynamically sorted list (descending by AverageDepth)', function() {
        const template = "{[list Oceans | sort: -AverageDepth]}\n*{[Name]}\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Oceans":[
                {"Name":"Pacific","AverageDepth":3970},
                {"Name":"Atlantic","AverageDepth":3646},
                {"Name":"Indian","AverageDepth":3741},
                {"Name":"Southern","AverageDepth":3270},
                {"Name":"Arctic","AverageDepth":1205}
            ],
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "*Pacific\n*Indian\n*Atlantic\n*Southern\n*Arctic\n");
    });
    it('should assemble a document with a primitive list, _index and _parent', function() {
        const template = "Continents:\n\n{[list Continents]}\n * {[.]} (#{[_index]} on {[_parent.Planet]})\n{[endlist]}";
        const compiled = templater.parseTemplate(template);
        const data = {
            "Planet":"Earth",
            "Continents":["Africa","Asia","Europe","North America","South America","Antarctica","Australia/Oceania"],
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "Continents:\n\n * Africa (#1 on Earth)\n * Asia (#2 on Earth)\n * Europe (#3 on Earth)\n * North America (#4 on Earth)\n * South America (#5 on Earth)\n * Antarctica (#6 on Earth)\n * Australia/Oceania (#7 on Earth)\n");
    });
    it('should assemble a (simple) full name template', function() {
        const template = '{[ClientFirstName]} {[ClientMiddleName?ClientMiddleName + " ":""]}{[ClientLastName]}';
        const compiled = templater.parseTemplate(template);
        const data = {
            "ClientFirstName":"John",
            "ClientMiddleName":"Jacob",
            "ClientLastName":"Smith"
        };
        const result = (new TextEvaluator(data)).assemble(compiled);
        assert.equal(result, "John Jacob Smith");
    })
})
