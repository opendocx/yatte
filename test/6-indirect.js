/* eslint-disable no-unused-vars, comma-dangle */
const { describe, it } = require('mocha')
const assert = require('assert')
const fs = require('fs/promises')
const yatte = require('../src/index')
const IndirectAssembler = require('../src/indirect-assembler')
// const testUtil = require('./test-utils')
const Scope = yatte.Scope
const IndirectVirtual = yatte.IndirectVirtual

describe('Aggregating data based on extracted logic files', function () {
  it('data aggregation works with plain/atomless logic trees (empty context)', async function () {
    const template = await fs.readFile('./test/cases/SimpleWill.md', 'utf-8')
    const logic = yatte.extractLogic(template)
    const aggData = new IndirectAssembler({}).assembleData(logic)
    const str = aggData.toJson()
    assert.strictEqual(str, '{"Testator.Name":"[Testator.Name]","Testator.City":"[Testator.City]","Testator.County":"[Testator.County]","Testator.State":"[Testator.State]","Representative.Name":"[Representative.Name]","Representative.City":"[Representative.City]","Representative.County":"[Representative.County]","Representative.State":"[Representative.State]","Representative.Gender.HeShe":"[Representative.Gender.HeShe]","NominateBackup_BOOL":false,"Beneficiaries":[],"GoverningLaw":"[GoverningLaw]","SigningDate|format:\\"Do [day of] MMMM, YYYY\\"":"[SigningDate]","Testator.Gender.HimHer":"[Testator.Gender.HimHer]","Testator.Gender.HisHer":"[Testator.Gender.HisHer]","Witness1Name":"[Witness1Name]","Witness2Name":"[Witness2Name]","GoverningLaw|upper":"[GoverningLaw]","NotaryCounty|upper":"[NotaryCounty]"}')
  })
  it('logic tree data aggregation works with an empty context', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/SimpleWill.logic.json', 'utf-8'))
    const aggData = new IndirectAssembler({}).assembleData(logic)
    const str = aggData.toXml('_odx')
    assert.strictEqual(str, '<?xml version="1.0"?><_odx><C1>[Testator.Name]</C1><C3>[Testator.City]</C3><C4>[Testator.County]</C4><C5>[Testator.State]</C5><C6>[Representative.Name]</C6><C7>[Representative.City]</C7><C8>[Representative.County]</C8><C9>[Representative.State]</C9><C10>[Representative.Gender.HeShe]</C10><C12b>false</C12b><L18></L18><C27>[GoverningLaw]</C27><C29>[SigningDate]</C29><C33>[Testator.Gender.HimHer]</C33><C34>[Testator.Gender.HisHer]</C34><C37>[Witness1Name]</C37><C38>[Witness2Name]</C38><C39>[GoverningLaw]</C39><C40>[NotaryCounty]</C40></_odx>')
  })
  it('data aggregation works with plain/atomless logic trees (populated context)', async function () {
    const template = await fs.readFile('./test/cases/SimpleWill.md', 'utf-8')
    const logic = yatte.extractLogic(template)
    const aggData = new IndirectAssembler(SimpleWillDemoContext).assembleData(logic)
    const str = aggData.toJson()
    assert.strictEqual(str, '{"Testator.Name":"John Smith","Testator.City":"Jonestown","Testator.County":"Lebanon","Testator.State":"Pennsylvania","Representative.Name":"Kim Johnston","Representative.City":"Philadelphia","Representative.County":"Philadelphia","Representative.State":"Pennsylvania","Representative.Gender.HeShe":"she","NominateBackup_BOOL":true,"BackupRepresentative.Name":"Tina Turner","BackupRepresentative.City":"Los Angeles","BackupRepresentative.County":"Los Angeles","BackupRepresentative.State":"California","Beneficiaries":[{"_index":1,"_index|ordsuffix":"st","Name":"Kelly Smith","Address":"1234 Anystreet, Allentown, PA","Relationship":"Daughter","SSNLast4":"5555","PropertyBequeath":"My cat."},{"_index":2,"_index|ordsuffix":"nd","Name":"John Smith Jr.","Address":"54321 Geronimo, Jonestown, PA","Relationship":"Son","SSNLast4":"4444","PropertyBequeath":"My house."},{"_index":3,"_index|ordsuffix":"rd","Name":"Diane Kennedy","Address":"Unknown","Relationship":"Mistress","SSNLast4":"[SSNLast4]","PropertyBequeath":"My misguided affection."},{"_index":4,"_index|ordsuffix":"th","Name":"Tim Billingsly","Address":"Boulder, CO","Relationship":"cat","SSNLast4":"[SSNLast4]","PropertyBequeath":"Everything else."}],"GoverningLaw":"Pennsylvania","SigningDate|format:\\"Do [day of] MMMM, YYYY\\"":"10th day of March, 2019","Testator.Gender.HimHer":"him","Testator.Gender.HisHer":"his","Witness1Name":"John Doe","Witness2Name":"Marilyn Monroe","GoverningLaw|upper":"PENNSYLVANIA","NotaryCounty|upper":"ALLEGHENY"}')
  })
  it('logic tree data aggregation works with a populated context', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/SimpleWill.logic.json', 'utf-8'))
    // now evaluate the helper against this data context, to test its functionality
    const aggData = new IndirectAssembler(SimpleWillDemoContext).assembleData(logic)
    const str = aggData.toXml('_odx')
    assert.strictEqual(str,
      '<?xml version="1.0"?><_odx><C1>John Smith</C1><C3>Jonestown</C3><C4>Lebanon</C4><C5>Pennsylvania</C5><C6>Kim Johnston</C6><C7>Philadelphia</C7><C8>Philadelphia</C8><C9>Pennsylvania</C9><C10>she</C10><C12b>true</C12b><C13>Tina Turner</C13><C14>Los Angeles</C14><C15>Los Angeles</C15><C16>California</C16><L18><L18i><C19>1</C19><C20>st</C20><C21>Kelly Smith</C21><C22>1234 Anystreet, Allentown, PA</C22><C23>Daughter</C23><C24>5555</C24><C25>My cat.</C25><L18p/></L18i><L18i><C19>2</C19><C20>nd</C20><C21>John Smith Jr.</C21><C22>54321 Geronimo, Jonestown, PA</C22><C23>Son</C23><C24>4444</C24><C25>My house.</C25><L18p/></L18i><L18i><C19>3</C19><C20>rd</C20><C21>Diane Kennedy</C21><C22>Unknown</C22><C23>Mistress</C23><C24>[SSNLast4]</C24><C25>My misguided affection.</C25><L18p/></L18i><L18i><C19>4</C19><C20>th</C20><C21>Tim Billingsly</C21><C22>Boulder, CO</C22><C23>cat</C23><C24>[SSNLast4]</C24><C25>Everything else.</C25><L18p/></L18i></L18><C27>Pennsylvania</C27><C29>10th day of March, 2019</C29><C33>him</C33><C34>his</C34><C37>John Doe</C37><C38>Marilyn Monroe</C38><C39>PENNSYLVANIA</C39><C40>ALLEGHENY</C40></_odx>')
  })
  it('js function should not contain multiple definitions for the same data value', async function () {
    const template = await fs.readFile('./test/cases/redundant_ifs.md', 'utf-8')
    const logic = yatte.extractLogic(template)
    const data = { A: true, B: false }
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toXml('top')
    assert.strictEqual(str, '<?xml version="1.0"?><top><A_BOOL>true</A_BOOL><B_BOOL>false</B_BOOL></top>')
  })
  it('xml should include TF answers for content fields separate from if fields', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/Syntax.logic.json', 'utf-8'))
    const data = { IsTaxPlanning: false }
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toXml('top')
    assert.strictEqual(str, '<?xml version="1.0"?><top><C1>false</C1><C1b>false</C1b></top>')
  })
  it('list testing (xml)', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/Lists.logic.json', 'utf-8'))
    const data = BradyTestData
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toXml('top')
    // note: lists do not (currently) get optimized in the XML -- every time a template repeats through a list, another copy of the list is stored in the XML. This is because I haven't done the work yet to optimize that part.
    // it works well enough this way, but in the future (if the XML chunks are so big they're slowing something down) we can optimize it better.
    assert.strictEqual(str,
      '<?xml version="1.0"?><top><L1><L1i><C2>Greg</C2><L1p>, </L1p></L1i><L1i><C2>Marcia</C2><L1p>, </L1p></L1i><L1i><C2>Peter</C2><L1p>, </L1p></L1i><L1i><C2>Jan</C2><L1p>, </L1p></L1i><L1i><C2>Bobby</C2><L1p> and </L1p></L1i><L1i><C2>Cindy</C2><L1p/></L1i></L1><L4><L4i><C2>Greg</C2><C6>09/30/1954</C6><L4p>;</L4p></L4i><L4i><C2>Marcia</C2><C6>08/05/1956</C6><L4p>;</L4p></L4i><L4i><C2>Peter</C2><C6>11/07/1957</C6><L4p>;</L4p></L4i><L4i><C2>Jan</C2><C6>04/29/1958</C6><L4p>;</L4p></L4i><L4i><C2>Bobby</C2><C6>12/19/1960</C6><L4p>; and</L4p></L4i><L4i><C2>Cindy</C2><C6>08/14/1961</C6><L4p>.</L4p></L4i></L4></top>')
  })
  it('list testing (json)', async function () {
    const template = await fs.readFile('./test/cases/Lists.md', 'utf-8')
    const logic = yatte.extractLogic(template)
    const data = BradyTestData
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toJson()
    assert.strictEqual(str,
      '{"Children|punc:\\"1, 2 and 3\\"":[{"Name":"Greg","Children|punc:\\"1, 2 and 3\\"_PUNC":", "},{"Name":"Marcia","Children|punc:\\"1, 2 and 3\\"_PUNC":", "},{"Name":"Peter","Children|punc:\\"1, 2 and 3\\"_PUNC":", "},{"Name":"Jan","Children|punc:\\"1, 2 and 3\\"_PUNC":", "},{"Name":"Bobby","Children|punc:\\"1, 2 and 3\\"_PUNC":" and "},{"Name":"Cindy"}],"Children|punc:\\"1;2; and3.\\"":[{"Name":"Greg","Birthdate|format:\\"MM/DD/YYYY\\"":"09/30/1954","Children|punc:\\"1;2; and3.\\"_PUNC":";"},{"Name":"Marcia","Birthdate|format:\\"MM/DD/YYYY\\"":"08/05/1956","Children|punc:\\"1;2; and3.\\"_PUNC":";"},{"Name":"Peter","Birthdate|format:\\"MM/DD/YYYY\\"":"11/07/1957","Children|punc:\\"1;2; and3.\\"_PUNC":";"},{"Name":"Jan","Birthdate|format:\\"MM/DD/YYYY\\"":"04/29/1958","Children|punc:\\"1;2; and3.\\"_PUNC":";"},{"Name":"Bobby","Birthdate|format:\\"MM/DD/YYYY\\"":"12/19/1960","Children|punc:\\"1;2; and3.\\"_PUNC":"; and"},{"Name":"Cindy","Birthdate|format:\\"MM/DD/YYYY\\"":"08/14/1961","Children|punc:\\"1;2; and3.\\"_PUNC":"."}]}')
  })
  it('should assemble data XML that includes unanswered placeholders', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/SimpleWill2.logic.json', 'utf-8'))
    const data = {
      GoverningLaw: 'Utah',
      SigningDate: new Date(2019, 3, 26),
    }
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toXml('_odx')
    assert.strictEqual(str,
      '<?xml version="1.0"?><_odx><C1>[Testator.Name]</C1><C3>[Testator.City]</C3><C4>[Testator.County]</C4><C5>[Testator.State]</C5><C6>[Representative.Name]</C6><C7>[Representative.City]</C7><C8>[Representative.County]</C8><C9>[Representative.State]</C9><C10>[Representative.Gender.HeShe]</C10><C12b>false</C12b><L18></L18><C27>Utah</C27><C29>26th day of April, 2019</C29><C33>[Testator.Gender.HimHer]</C33><C34>[Testator.Gender.HisHer]</C34><L37></L37><C41>UTAH</C41><C42>[NotaryCounty]</C42><L44></L44><C49>[WitnessNames[0]]</C49><L50></L50></_odx>')
  })
  it('should produce usable XML when an unconditional usage of a variable follows a conditional one', async function () {
    const logic = JSON.parse(await fs.readFile('./test/cases/cond-uncond.logic.json', 'utf-8'))
    const data = {
      x: true,
      a: 'testing'
    }
    // now evaluate the helper against this data context, to test its functionality
    const str = new IndirectAssembler(data).assembleData(logic).toXml('_odx')
    assert.strictEqual(str, '<?xml version="1.0"?><_odx><C1b>true</C1b><C2>testing</C2></_odx>')
  })
  // it('should produce usable XML and a valid assembled document for a simple "if x then x" template', async function () {
  //   // making sure x is emitted only once, whether it is truthy or falsy, so we don't get XML errors
  //   const templatePath = testUtil.GetTemplatePath('self-cond.docx')
  //   const result = await openDocx.compileDocx(templatePath, undefined, undefined, false)
  //   assert.strictEqual(result.HasErrors, false)
  //   const jsFile = result.ExtractedLogic
  //   // const compiledTemplate = result.DocxGenTemplate
  //   const data = {
  //     x: 'testing'
  //   }
  //   // now evaluate the helper against this data context, to test its functionality
  //   let str = new XmlAssembler(data).assembleXml(jsFile)
  //   assert.strictEqual(str, '<?xml version="1.0"?><_odx><C2b>true</C2b><C2>testing</C2></_odx>')
  //   fs.writeFileSync(templatePath + '.asmdata1.xml', str)
  //   let asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled1.docx', data)
  //   assert(!asmResult.HasErrors)
  //   // now evaluate the helper against NO data context, to test its functionality
  //   str = new XmlAssembler({}).assembleXml(jsFile)
  //   assert.strictEqual(str, '<?xml version="1.0"?><_odx><C2b>false</C2b></_odx>')
  //   fs.writeFileSync(templatePath + '.asmdata2.xml', str)
  //   asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled2.docx', {})
  //   assert(!asmResult.HasErrors)
  // })
  // it('should create the expected XML for ifpoa.docx', async function () {
  //   const templatePath = testUtil.GetTemplatePath('ifpoa.docx')
  //   const result = await openDocx.compileDocx(templatePath, undefined, undefined, false)
  //   assert.strictEqual(result.HasErrors, false)
  //   const jsFile = result.ExtractedLogic
  //   // const compiledTemplate = result.DocxGenTemplate
  //   const data = { ClientName: 'John Doe', DPOAType: new String('Contingent') } // eslint-disable-line
  //   let str = new XmlAssembler(data).assembleXml(jsFile)
  //   assert.strictEqual(str, '<?xml version="1.0"?><_odx><C1>John Doe</C1><C3b>true</C3b><C4b>false</C4b></_odx>')
  //   fs.writeFileSync(templatePath + '.asmdata1.xml', str)
  //   let asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled1.docx', data)
  //   assert(!asmResult.HasErrors)
  //   // now evaluate the helper against NO data context, to test its functionality
  //   str = new XmlAssembler({}).assembleXml(jsFile)
  //   assert.strictEqual(str, '<?xml version="1.0"?><_odx><C1>[ClientName]</C1><C3b>false</C3b><C4b>false</C4b></_odx>')
  //   fs.writeFileSync(templatePath + '.asmdata2.xml', str)
  //   asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled2.docx', {})
  //   assert(!asmResult.HasErrors)
  // })
  // it('should create the expected XML for BeneficiaryList.docx', async function () {
  //   const templatePath = testUtil.GetTemplatePath('BeneficiaryList.docx')
  //   const result = await openDocx.compileDocx(templatePath, undefined, undefined, false)
  //   assert.strictEqual(result.HasErrors, false)
  //   const jsFile = result.ExtractedLogic
  //   // const compiledTemplate = result.DocxGenTemplate
  //   const data = {
  //     Beneficiaries: [
  //       { Name: 'Joe Bloggs' },
  //       { Name: 'Bob Syuruncle' },
  //       { Name: 'Joe Blow' },
  //       { Name: 'Astruas Bob' },
  //     ]
  //   }
  //   let str = new XmlAssembler(data).assembleXml(jsFile)
  //   const expectedXml = '<?xml version="1.0"?><_odx><L1><L1i><C2>Joe Bloggs</C2><L1p/></L1i></L1><L4><L4i><C2>Bob Syuruncle</C2><L4p/></L4i><L4i><C2>Joe Blow</C2><L4p/></L4i></L4><C7b>true</C7b><C8>Astruas Bob</C8></_odx>'
  //   assert.strictEqual(str, expectedXml)
  //   fs.writeFileSync(templatePath + '.asmdata1.xml', str)
  //   let asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled1.docx', data)
  //   assert(!asmResult.HasErrors)
  //   // now evaluate again with data in locals, and something else in scope, and make sure it still works
  //   const otherData = Scope.pushObject(data, Scope.pushObject({ global: 'stuff' }))
  //   str = new XmlAssembler(otherData).assembleXml(jsFile)
  //   assert.strictEqual(str, expectedXml)
  //   fs.writeFileSync(templatePath + '.asmdata2.xml', str)
  //   asmResult = openDocx.assembleDocx(templatePath, templatePath + '-assembled2.docx', data)
  //   assert(!asmResult.HasErrors)
  // })
})

describe('Aggregating data based on MULTIPLE (indirect) extracted logic files', function () {
  it('should assemble (correctly) the inserttest.md template', async function () {
    const parentTemplate = { name: './test/cases/inserttest.md', enc: 'utf-8' }
    const childTemplate = { name: './test/cases/inserted.md', enc: 'utf-8' }
    const data = {
      Name: 'John',
      Insert: (scope) => new IndirectVirtual(childTemplate, scope, 'md'),
    }
    data.Insert.logic = true // needed so Yatte treats the function as a "virtual"

    const templateFileToLogicTree = async (obj) => {
      const template = await fs.readFile(obj.name, obj.enc)
      return yatte.extractLogic(template)
    }
    const logic = await templateFileToLogicTree(parentTemplate)
    const asm = await yatte.getIndirectAssembler(logic, data, templateFileToLogicTree)
    const data1 = asm.data.toXml('top')
    const data2 = asm.data.toJson()
    const data3 = asm.indirects[0].assembler.data.toJson()
    assert(data1.startsWith('<?xml version="1.0"?><top><Name>John</Name><Insert>oxpt://DocumentAssembler/insert/'))
    assert(data1.endsWith('</Insert></top>'))
    assert.strictEqual(data3, '{"Name":"John"}')
    // NEED a way to simulate/test the logic needed for complex DOCX insert scenarios...
    //   - when doing the IndirectAssembler, what files are necessary for inserted templates, and how to fetch them dynamically?
    //   - how best to store and use the correspondences between objects and templates,
    //     so when we have a need for a particular template on a particular object, we
    //     can get find our way to the right logic.json file and find our way to extracting
    //     the correct data as needed by that template?

    // ALSO need a simple straightforward test case to illustrate some of the potential use cases.  I'm thinking
    //   parent House object. Has an address, a paint color, and a list of inhabitant objects, and 2 templates
    //       -- a template that just mentions the address and paint color (no inserts)
    //       -- a template about the house and its inhabitants, which inserts the above template about the house AND a template about each inhabitant
    //   child Inhabitant object(s).  Each inhabitant has a Name, Age, Spouse.  And 2 templates...
    //       -- one that uses Name, Age, and (if present) Spouse
    //       -- maybe ALSO a version of the above, that includes name and INSERTS the same template for spouse
    //            - if inhabitant has link to spouse, but spouse does NOT have back-link to inhabitant, this ought to work
    //            - but if spouse has back-link to inhabitant, then this insert will trigger an infinite recursion! (error test case)
    //       -- another that uses stuff outside of inhabitant: refers to address and other inhabitants
    // Also, testing should cover & elucidate Indirect (for inserts) AND Meta templates (for apps), and make clear what's similar vs different about them.

    /*
        Idea is: in your data context, the way all these test cases so far go, you have some placeholder there
        that indicates a "virtual". For these virtuals, let's say they are either Direct or Indirect.  Direct means,
        the template content is available synchronously for direct insertion during assembly.  Indirect means,
        either the template content must be fetched asynchronously, or direct insertion is not possible during assembly,
        or both.  So in your data context, you declare virtuals as one type or the other.

        Then you call assembleData and pass in the logic tree for a template. That goes through and does its thing.
        We may need to bring across async function assembleData() from opendocx -> yatte. That is the one with the
        async callback that is used to fetch stuff about indirect templates as they're discovered. OR... could we rely
        on stuff embedded in the data context itself? As I mentioned above, maybe this idea of Direct vs. Indirect
        Virtuals?  Or are there also Sync vs. Async, meaning 4 combinations in total?
          DirectSync: the object in the data model contains the actual child template so it can be assembled synchronously and automatically
          DirectAsync: the object in the data model contains the location of the child template so it can be automatically retrieved (asynchronously) and assembled later
          IndirectSync: the object in the data model contains the actual child template's schema, so DATA can be assembled synchronously (doc assembly will require some intervention)
          IndirectAsync: AssembleData will need to perform callbacks (sync or async?) to fetch the child template's schema, while DATA is being assembled (doc assembly will require some intervention)
    */
  })
})

const SimpleWillDemoContext = {
  Testator: {
    Name: 'John Smith',
    City: 'Jonestown',
    State: 'Pennsylvania',
    County: 'Lebanon',
    Gender: { Name: 'Male', HeShe: 'he', HimHer: 'him', HisHer: 'his', HisHers: 'his' }
  },
  GoverningLaw: 'Pennsylvania',
  SigningDate: new Date(2019, 2, 10),
  Witness1Name: 'John Doe',
  Witness2Name: 'Marilyn Monroe',
  NotaryCounty: 'Allegheny',
  NominateBackup: true,
  Representative: {
    Name: 'Kim Johnston',
    City: 'Philadelphia',
    State: 'Pennsylvania',
    County: 'Philadelphia',
    Gender: { Name: 'Female', HeShe: 'she', HimHer: 'her', HisHer: 'her', HisHers: 'hers' }
  },
  BackupRepresentative: {
    Name: 'Tina Turner',
    City: 'Los Angeles',
    State: 'California',
    County: 'Los Angeles',
    Gender: { Name: 'Female', HeShe: 'she', HimHer: 'her', HisHer: 'her', HisHers: 'hers' }
  },
  Beneficiaries: [
    {
      Name: 'Kelly Smith',
      Address: '1234 Anystreet, Allentown, PA',
      Relationship: 'Daughter',
      SSNLast4: '5555',
      PropertyBequeath: 'My cat.'
    },
    {
      Name: 'John Smith Jr.',
      Address: '54321 Geronimo, Jonestown, PA',
      Relationship: 'Son',
      SSNLast4: '4444',
      PropertyBequeath: 'My house.'
    },
    {
      Name: 'Diane Kennedy',
      Address: 'Unknown',
      Relationship: 'Mistress',
      PropertyBequeath: 'My misguided affection.'
    },
    {
      Name: 'Tim Billingsly',
      Address: 'Boulder, CO',
      Relationship: 'cat',
      PropertyBequeath: 'Everything else.'
    },
  ],
}

const BradyTestData = {
  Children: [
    {
      Name: 'Greg',
      Birthdate: new Date(1954, 8, 30)
    },
    {
      Name: 'Marcia',
      Birthdate: new Date(1956, 7, 5)
    },
    {
      Name: 'Peter',
      Birthdate: new Date(1957, 10, 7)
    },
    {
      Name: 'Jan',
      Birthdate: new Date(1958, 3, 29)
    },
    {
      Name: 'Bobby',
      Birthdate: new Date(1960, 11, 19)
    },
    {
      Name: 'Cindy',
      Birthdate: new Date(1961, 7, 14)
    }
  ]
}
