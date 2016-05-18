var FileRegistrar = require('../')
var MemDB = require('memdb')
var fs = require('fs')

module.exports = TestHelper

function TestHelper (opts) {}

TestHelper.entryIdFor = function (path) {
  var deviceId = fs.statSync(path).dev
  return deviceId.toString()+":"+path
}

TestHelper.freshRegistry = function (opts) {
  if (!opts) opts = {}
  if (!opts.db) opts.db = MemDB()
  return new FileRegistrar(opts)
}
