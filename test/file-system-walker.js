const test = require('blue-tape')
const helper = require('./test-helper')
const MemDB = require('memdb');
const level = require('level')
const fs = require('fs')

const FilesystemWalker = require('../lib/file-system-walker')
const EventEmitter = require('events');

test('emits events', function (t) {
  var eventEmitter = new EventEmitter()
  var deviceId = fs.statSync("/").dev
  var eventCounts = {start: 0, entity: 0, file: 0, directory: 0, done: 0}
  eventEmitter.on('start', function (dir) {
    eventCounts.start++
  })
  .on('file-registered', function (entryKey) {
    eventCounts.file++
    t.true(entryKey.indexOf(deviceId+":"+__dirname + "/data") > -1, "file-registered passes entryKey of the file")
  })
  .on('directory-registered', function (entryKey) {
    eventCounts.directory++
    t.true(entryKey.indexOf(deviceId+":"+__dirname + "/data") > -1, "directory-registered passes entryKey of the dir")
  })
  .on('entity-registered', function (entryKey) {
    eventCounts.entity++
    t.true(entryKey.indexOf(deviceId+":"+__dirname + "/data") > -1, "directory-registered passes entryKey of the dir")
  })
  .on('done', function (dir) {
    eventCounts.done++
  })
  // start, file-registered, directory-registered, end
  return FilesystemWalker.walkAndRegister(__dirname + "/data", MemDB(), eventEmitter)
  .then(function(entryInfo) {
    t.same(entryInfo.path, __dirname + "/data", "passes entryInfo for the root dir into 'done()' callback")
    t.same(eventCounts.start, 1, "emits start event once")
    // Wait a moment to let the final event to trigger
    setTimeout(function(){
      t.same(eventCounts.file, 4, "emits file-registered event 4 times")
    }, 10);
    setTimeout(function(){
      t.same(eventCounts.directory, 2, "emits directory-registered event 2 times")
    }, 10);
    setTimeout(function(){
      t.same(eventCounts.entity, 6, "emits entity-registered event (both dirs and files) 6 times")
    }, 10);
    t.same(eventCounts.done, 1, "emits done event once")
  })
})

test('does not choke on unreadable directories', function (t) {
  var eventEmitter = new EventEmitter()
  var dir = __dirname + "/data/unreadable-dir";
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, 0222);
  }
  return FilesystemWalker.walkAndRegister(dir, MemDB(), eventEmitter)
  .catch(function(err) {
    // if something goes wrong running the test, delete the undreadable dir
    console.log("ERROR: "+err.message+err.stack)
    fs.rmdirSync(dir)
  })
  .then(function(entryInfo) {
    fs.rmdirSync(dir)
    t.same(entryInfo.size, 68)
  })
})

test('put the stats of all files and directories in a database', function (t) {
  var eventEmitter = new EventEmitter()
  var db = MemDB()
  var deviceId = fs.statSync("/").dev

  return FilesystemWalker.walkAndRegister(__dirname + "/data", db, eventEmitter)
  .then(function(entryInfo) {
    dataDirPath = __dirname + '/data'
    var key = helper.entryIdFor(dataDirPath)
    var dataDirStats = fs.statSync(dataDirPath)
    db.get(key, function (err, value) {
      var dataDirEntry = JSON.parse(value)
      t.same(dataDirEntry.path, dataDirPath, "stores path")
      t.same(dataDirEntry.size, 135724, "stores size")
      t.same(dataDirEntry.birthtime, dataDirStats.birthtime.toJSON(), "stores birthtime")
      t.same(dataDirEntry.mtime, dataDirStats.mtime.toJSON(), "stores mtime")
      t.same(dataDirEntry.children, [ '.hidden', 'sample.txt', 'subdir' ], "stores children (if dir)")
      t.same(dataDirEntry.type, 'dir', "stores type (dir)")
    })
    fileEntryPath = __dirname + '/data/sample.txt'
    var fileEntryKey = helper.entryIdFor(fileEntryPath)
    var fileEntryStats = fs.statSync(fileEntryPath)
    db.get(fileEntryKey, function (err, value) {
      var fileEntry = JSON.parse(value)
      t.same(fileEntry.path, __dirname + '/data/sample.txt', "stores path")
      t.same(fileEntry.size, 28, "stores size")
      t.same(fileEntry.birthtime, fileEntryStats.birthtime.toJSON(), "stores birthtime")
      t.same(fileEntry.mtime, fileEntryStats.mtime.toJSON(), "stores mtime")
      t.same(fileEntry.children, undefined, "does not store children if file")
      t.same(fileEntry.type, 'file', "stores type (file)")
    })
    subDir = __dirname + '/data/subdir'
    var subDirKey = helper.entryIdFor(subDir)
    var subDirStats = fs.statSync(subDir)
    db.get(subDirKey, function (err, value) {
      var subDirEntry = JSON.parse(value)
      t.same(subDirEntry.path, __dirname + '/data/subdir', "stores path")
      t.same(subDirEntry.size, 135424, "stores size")
      t.same(subDirEntry.birthtime, subDirStats.birthtime.toJSON(), "stores birthtime")
      t.same(subDirEntry.mtime, subDirStats.mtime.toJSON(), "stores mtime")
      t.same(subDirEntry.children, ['FakeApplication.app', "hells angels kissing - hunter thompson.jpg"], "stores children")
      t.same(subDirEntry.type, 'dir', "stores type (dir)")
    })
    db.get(helper.entryIdFor(__dirname + '/data/subdir/FakeApplication.app'), function (err, value) {
      var entry = JSON.parse(value)
      t.same(entry.type, 'file', 'Registers .app directories as files')
    })
    db.get(helper.entryIdFor(__dirname + '/data/subdir/FakeApplication.app/innerfile.txt'), function (err, value) {
      t.same(err.type, 'NotFoundError', 'does not register contents of .app directories')
    })
    db.get(helper.entryIdFor(__dirname + '/data/.hidden'), function (err, value) {
      var entry = JSON.parse(value)
      t.same(entry.type, 'file', 'Registers hidden directories as files')
    })
  })
})
