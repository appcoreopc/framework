'use strict'

const compiler = require('@risingstack/nx-compile')
const exposed = require('../core/symbols')

const filterRegex = /(?:[^\|]|\|\|)+/g
const argsRegex = /\S+/g
const tokenCache = new Map()

function expression (node) {
  node.$compileExpression = $compileExpression
}
expression.$name = 'expression'
module.exports = expression

function $compileExpression (rawExpression) {
  if (typeof rawExpression !== 'string') {
    throw new TypeError('first argument must be a string')
  }
  const expression = parseExpression(this, rawExpression)

  return function evaluateExpression () {
    let value = expression.exec()
    for (let filter of expression.filters) {
      const args = filter.argExpressions.map(evaluateArgExpression)
      value = filter.effect(value, ...args)
    }
    return value
  }
}

function parseExpression (node, rawExpression) {
  let tokens = tokenCache.get(rawExpression)
  if (!tokens) {
    tokens = rawExpression.match(filterRegex)
    tokenCache.set(rawExpression, tokens)
  }
  const expression = {
    exec: compiler.compileExpression(tokens[0], node[exposed.contextState]),
    filters: []
  }

  const filters = node[exposed.filters]
  for (let i = 1; i < tokens.length; i++) {
    let filterTokens = tokens[i].match(argsRegex) || []
    const filterName = filterTokens.shift()
    if (!filters) {
      throw new Error(`there is no filter named ${filterName} on ${node}`)
    }
    const effect = filters.get(filterName)
    if (!effect) {
      throw new Error(`there is no filter named ${filterName} on ${node}`)
    }
    expression.filters.push({effect, argExpressions: filterTokens.map(compileArgExpression, node)})
  }
  return expression
}

function evaluateArgExpression (argExpression) {
  return argExpression()
}

function compileArgExpression (argExpression) {
  return compiler.compileExpression(argExpression, this[exposed.contextState])
}
