class IndirectVirtual {
  constructor (props, scope) {
    for (const [key, value] of Object.entries(props)) {
      this[key] = value
    }
    this.scope = scope
  }
}

module.exports = IndirectVirtual
