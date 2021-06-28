class IndirectVirtual {
  constructor (props, scope, contentType = '') {
    for (const [key, value] of Object.entries(props)) {
      this[key] = value
    }
    this.scope = scope
    // contentType is inherited from props (if it's there) or it can be explicitly specified
    // contentType should be 'text', 'markdown', or 'docx' (for indirects using opendocx)
    if (contentType || !('contentType' in this)) {
      this.contentType = contentType
    }
  }

  // toString () {} // When an indirect is encountered during (synchronous) text-based assembly,
  //                // toString() is called on the instance in order to retrieve the text.
  //                // In (async) docx-based assembly, encountering an indirect causes a special
  //                // placeholder to be inserted so the resulting files can be composed later.
}

module.exports = IndirectVirtual
