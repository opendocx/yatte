module.exports = {
  extends: [
    'standard',
    'eslint:recommended',
  ],
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
    'shared-node-browser': true,
    mocha: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  rules: {
    'comma-dangle': ['error', 'only-multiline'],
    'dot-notation': 'off',
    'operator-linebreak': 'off', //[ 'error', 'before' ],
    'no-multi-spaces': 'off',
    'indent': [ 'error', 2, { 'SwitchCase': 1 } ],
    'linebreak-style': [ 'error', 'unix' ],
    'no-multi-spaces': 'off',
    'max-len': [ 'warn', { 'code': 120} ]
  }
}
