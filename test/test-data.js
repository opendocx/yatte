const yatte = require('../src/index')

function simVirtuals (virtuals) {
  for (let key in virtuals) {
    let v = virtuals[key]
    if (typeof v === 'function' && !v.ast) {
      v.ast = true // add this property to the function so it looks like a compiled expression
    }
  }
  return virtuals
}
exports.simVirtuals = simVirtuals

function makeObject (proto, obj) {
  return Object.assign(Object.create(proto), obj)
}
exports.makeObject = makeObject

const cont_proto = {
  Description: yatte.compileText('{[Name]} has at least {[LakeCount]} lakes across its {[Corners.length]} corners'),
  LakeCount: yatte.Engine.compileExpr('Lakes.length'),
}
const ocean_proto = {
  Description: yatte.compileText('The {[Name]} Ocean has at least {[IslandCount]} islands'),
  IslandCount: yatte.Engine.compileExpr('Islands.length'),
}
const plan_proto = {
  Description: yatte.compileText('Planet {[Planet]} has {[Corners.length]} corners: {[list Corners|punc:"1, 2, and 3"]}some of its {[ContinentCount]} continents and {[OceanCount]} oceans are in the {[this]}{[endlist]}.'),
  ContinentCount: yatte.Engine.compileExpr('Continents.length'),
  OceanCount: yatte.Engine.compileExpr('Oceans.length'),
}

const Earth_Data = makeObject(plan_proto, {
  Planet: 'Earth',
  Continents: [
    makeObject(cont_proto, { Name: 'Africa', SurfaceArea: 30370000, Lakes: ['Victoria', 'Tanganyika', 'Malawi', 'Turkana', 'Albert', 'Mweru'] }),
    makeObject(cont_proto, { Name: 'Asia', SurfaceArea: 44579000, Lakes: ['Baikal', 'Balkhash', 'Taymyr', 'Issyk-Kul', 'Urmia', 'Qinghai'] }),
    makeObject(cont_proto, { Name: 'Europe', SurfaceArea: 10180000, Lakes: ['Ladoga', 'Onega', 'Vänern', 'Saimaa', 'Peipus'] }),
    makeObject(cont_proto, { Name: 'North America', SurfaceArea: 24709000, Lakes: ['Superior', 'Huron', 'Michigan', 'Great Bear', 'Great Slave'] }),
    makeObject(cont_proto, { Name: 'South America', SurfaceArea: 17840000, Lakes: ['Titicaca', 'Junín', 'Sarococha', 'Poopó'] }),
    makeObject(cont_proto, { Name: 'Antarctica', SurfaceArea: 14000000, Lakes: ['Vostok'] }),
    makeObject(cont_proto, { Name: 'Australia/Oceania', SurfaceArea: 8600000, Lakes: ['Eyre', 'Torrens', 'Carnegie', 'Mackay', 'Frome'] }),
  ],
  Oceans: [
    makeObject(ocean_proto, { Name: 'Pacific', AverageDepth: 3970, Islands: ['New Guinea', 'Honshu', 'Sulawesi', 'Te Waipounamu'] }),
    makeObject(ocean_proto, { Name: 'Atlantic', AverageDepth: 3646, Islands: ['Greenland', 'Great Britain', 'Bahamas', 'Newfoundland'] }),
    makeObject(ocean_proto, { Name: 'Indian', AverageDepth: 3741, Islands: ['Sri Lanka', 'Madagascar', 'Comoros'] }),
    makeObject(ocean_proto, { Name: 'Southern', AverageDepth: 3270, Islands: ['Alexander', 'Berkner', 'Antipodes', 'Tierra del Fuego'] }),
    makeObject(ocean_proto, { Name: 'Arctic', AverageDepth: 1205, Islands: ['Kaffeklubben', 'Bjarnarey', 'Svalbard', 'Severnaya'] }),
  ],
  Corners: ['North', 'East', 'South', 'West'],
})
exports.Earth_Data = Earth_Data

const TV_Family_Data = {
  Families: [
    {
      Surname: 'Brady',
      Children: [
        { Name: 'Greg', Birthdate: new Date(1954, 8, 30) },
        { Name: 'Marcia', Birthdate: new Date(1956, 7, 5) },
        { Name: 'Peter', Birthdate: new Date(1957, 10, 7) },
        { Name: 'Jan', Birthdate: new Date(1958, 3, 29) },
        { Name: 'Bobby', Birthdate: new Date(1960, 11, 19) },
        { Name: 'Cindy', Birthdate: new Date(1961, 7, 14) },
      ]
    },
    {
      Surname: 'Clampett',
      Children: [
        { Name: 'Elly May', Birthdate: new Date(1932, 8, 26) },
        { Name: 'Jethro', Birthdate: new Date(1937, 11, 4) },
      ]
    },
    {
      Surname: 'Addams',
      Children: [
        { Name: 'Puglsey', Birthdate: new Date(1955, 8, 29) },
        { Name: 'Wednesday', Birthdate: new Date(1958, 1, 16) },
      ]
    },
    {
      Surname: 'Robinson',
      Children: [
        { Name: 'Judy', Birthdate: new Date(2045, 1, 26) },
        { Name: 'Penny', Birthdate: new Date(2052, 8, 9) },
        { Name: 'Will', Birthdate: new Date(2054, 1, 1) },
      ]
    },
    {
      Surname: 'Griffiths',
      Children: [
        { Name: 'Opie', Birthdate: new Date(1924, 2, 1) },
      ]
    },
    {
      Surname: 'Partridge',
      Children: [
        { Name: 'Keith', Birthdate: new Date(1950, 3, 12) },
        { Name: 'Laurie', Birthdate: new Date(1952, 11, 10) },
        { Name: 'Danny', Birthdate: new Date(1959, 7, 13) },
        { Name: 'Chris', Birthdate: new Date(1961, 4, 22) },
        { Name: 'Tracy', Birthdate: new Date(1963, 2, 6) },
      ]
    },
    {
      Surname: 'Bradford',
      Children: [
        { Name: 'David', Birthdate: new Date(1952, 6, 6) },
        { Name: 'Mary', Birthdate: new Date(1954, 9, 2) },
        { Name: 'Joanie', Birthdate: new Date(1947, 0, 8) },
        { Name: 'Susan', Birthdate: new Date(1952, 2, 11) },
        { Name: 'Nancy', Birthdate: new Date(1954, 2, 29) },
        { Name: 'Elizabeth', Birthdate: new Date(1959, 11, 5) },
        { Name: 'Tommy', Birthdate: new Date(1960, 6, 15) },
        { Name: 'Nicholas', Birthdate: new Date(1968, 9, 12) },
      ]
    }
  ]
}
exports.TV_Family_Data = TV_Family_Data
