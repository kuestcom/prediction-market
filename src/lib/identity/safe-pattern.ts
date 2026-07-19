/**
 * Accepts a deliberately small, linear-time subset of JavaScript regular
 * expressions. Identity patterns are operator-controlled but are evaluated
 * against user input, so constructs with unbounded or ambiguous backtracking
 * are not allowed.
 */
export function isSafeIdentityPattern(pattern: string) {
  if (pattern.length === 0 || pattern.length > 256) {
    return false
  }

  let index = 0
  if (pattern[index] === '^') {
    index += 1
  }

  while (index < pattern.length) {
    if (pattern[index] === '$') {
      return index === pattern.length - 1
    }

    if (pattern[index] === '[') {
      index += 1
      if (pattern[index] === '^') {
        index += 1
      }
      let hasContent = false
      let closed = false
      while (index < pattern.length) {
        if (pattern[index] === '\\') {
          index += 2
          hasContent = true
          continue
        }
        if (pattern[index] === ']') {
          index += 1
          closed = true
          break
        }
        hasContent = true
        index += 1
      }
      if (!closed || !hasContent) {
        return false
      }
    }
    else if (pattern[index] === '\\') {
      if (index + 1 >= pattern.length) {
        return false
      }
      index += 2
    }
    else {
      const token = pattern[index]!
      if ('^[]()|.*+?{}'.includes(token)) {
        return false
      }
      index += 1
    }

    if (pattern[index] === '{') {
      const quantifier = pattern.slice(index).match(/^\{(\d{1,3})(?:,(\d{1,3}))?\}/)
      if (!quantifier) {
        return false
      }
      const minimum = Number(quantifier[1])
      const maximum = quantifier[2] === undefined ? minimum : Number(quantifier[2])
      if (minimum > maximum || maximum > 256) {
        return false
      }
      index += quantifier[0].length
    }
    else if (index < pattern.length && '*+?'.includes(pattern[index]!)) {
      return false
    }
  }

  try {
    void new RegExp(pattern, 'u')
    return true
  }
  catch {
    return false
  }
}
