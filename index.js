const fs = require('fs')
const path = require('path')
const sha1 = require('sha1');
const level = require('level')
const EventEmitter = require('events');

const TreeExporter = require('./lib/exporter')
const Identifiers = require('./lib/identifiers')
const FileSystemWalker = require('./lib/file-system-walker')

module.exports = FileRegistrar

function FileRegistrar (opts) {
  if (!opts) opts = {}
  this.db = opts.db || level('data.db')
  this.eventEmitter = new EventEmitter()
}

FileRegistrar.prototype.register = function (dir) {
  return FileSystemWalker.walkAndRegister(dir, this.db, this.eventEmitter)
}

FileRegistrar.prototype.exportTree = function (rootEntry, opts, callback) {
  TreeExporter.exportTree(rootEntry, this.db, opts, callback)
}

FileRegistrar.prototype.exportTreeToFile = function (rootEntry, destinationPath, opts, callback) {
  TreeExporter.exportTreeToFile(rootEntry, destinationPath, this.db, opts, callback)
}

FileRegistrar.prototype.exportDb = function (opts, callback) {
  TreeExporter.exportDb(this.db, opts, callback)
}

FileRegistrar.entryIdFor = function (path, deviceId) {
  return Identifiers.entryIdFor(path, deviceId)
}
