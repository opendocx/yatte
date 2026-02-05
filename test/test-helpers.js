/* eslint-disable no-unused-vars */
const assert = require('assert')

/**
 * Performs a partial deep equality check on AST nodes.
 * Checks that all properties in 'expected' exist and match in 'actual',
 * but allows 'actual' to have additional properties (like toWatch, watchId).
 * toWatch and watchId are always ignored (never compared), so they do not affect
 * whether two ASTs are considered equivalent. This makes tests less brittle when
 * optimization metadata is present.
 *
 * @param {*} actual - The actual AST node
 * @param {*} expected - The expected AST node (subset of properties to check)
 * @param {string} path - Internal: path for error messages
 * @param {WeakSet} visited - Internal: set of visited objects to detect cycles
 */
function assertASTMatches (actual, expected, path = '', visited = new WeakSet()) {
  if (expected === null || expected === undefined) {
    assert.strictEqual(actual, expected, `Mismatch at ${path}: expected ${expected}, got ${actual}`)
    return
  }

  if (typeof expected !== 'object' || Array.isArray(expected)) {
    assert.strictEqual(actual, expected, `Mismatch at ${path}: expected ${expected}, got ${actual}`)
    return
  }

  // Check that actual is also an object
  if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
    assert.fail(`Type mismatch at ${path}: expected object, got ${typeof actual}`)
  }

  // Skip properties that might cause circular references (toWatch, watchId)
  // These are optimization metadata and don't need to be checked in tests
  const skipProperties = ['toWatch', 'watchId']

  // Check all properties in expected exist and match in actual
  for (const key in expected) {
    if (!Object.prototype.hasOwnProperty.call(expected, key)) continue // skip inherited properties
    if (skipProperties.includes(key)) continue // skip optimization metadata

    const expectedValue = expected[key]
    const actualValue = actual[key]

    if (!(key in actual)) {
      assert.fail(`Missing property at ${path}.${key}: expected ${JSON.stringify(expectedValue)}`)
    }

    // Detect cycles for nested objects
    if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
      if (visited.has(expectedValue) || visited.has(actualValue)) {
        // Circular reference detected - just check that both are objects
        assert.strictEqual(typeof actualValue === 'object' && actualValue !== null, true,
          `Circular reference at ${path}.${key}: expected object`)
        continue
      }
      visited.add(expectedValue)
      if (actualValue !== null && typeof actualValue === 'object') {
        visited.add(actualValue)
      }
      assertASTMatches(actualValue, expectedValue, path ? `${path}.${key}` : key, visited)
      visited.delete(expectedValue)
      if (actualValue !== null && typeof actualValue === 'object') {
        visited.delete(actualValue)
      }
    } else if (Array.isArray(expectedValue)) {
      assert(Array.isArray(actualValue), `Type mismatch at ${path}.${key}: expected array, got ${typeof actualValue}`)
      assert.strictEqual(actualValue.length, expectedValue.length, `Array length mismatch at ${path}.${key}`)
      for (let i = 0; i < expectedValue.length; i++) {
        assertASTMatches(actualValue[i], expectedValue[i], `${path}.${key}[${i}]`, visited)
      }
    } else {
      assert.strictEqual(actualValue, expectedValue, `Mismatch at ${path}.${key}: expected ${expectedValue}, got ${actualValue}`)
    }
  }
}

module.exports = {
  assertASTMatches
}
