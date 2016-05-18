var test = require('tape')
var helper = require('./test-helper')
var MemDB = require('memdb');
var level = require('level')
var fs = require('fs')

test('emits events', function (t) {
  var deviceId = fs.statSync("/").dev
  var bfr = helper.freshRegistry()
  var eventCounts = {start: 0, fileRegistered: 0, directoryRegistered: 0, done: 0}
  bfr.eventEmitter.on('start', function (dir) {
    eventCounts.start++
  })
  .on('fileRegistered', function (entryKey) {
    eventCounts.fileRegistered++
    t.true(entryKey.indexOf(deviceId+":"+__dirname + "/data") > -1, "fileRegistered passes entryKey of the file")
  })
  .on('directoryRegistered', function (entryKey) {
    eventCounts.directoryRegistered++
    t.true(entryKey.indexOf(deviceId+":"+__dirname + "/data") > -1, "directoryRegistered passes entryKey of the dir")
  })
  .on('done', function (dir) {
    eventCounts.done++
  })
  // start, fileRegistered, directoryRegistered, end
  bfr.register(__dirname + "/data", function(err, results) {
    t.same(eventCounts.start, 1, "emits start event once")
    // Wait a moment to let the final event to trigger
    setTimeout(function(){
      t.same(eventCounts.fileRegistered, 4, "emits fileRegistered event 4 times")
    }, 10);
    setTimeout(function(){
      t.same(eventCounts.directoryRegistered, 2, "emits directoryRegistered event 2 times")
    }, 10);
    t.same(eventCounts.done, 1, "emits done event once")
    t.end()
  })
})

test('does not choke on unreadable directories', function (t) {
  var dir = __dirname + "/data/unreadable-dir";
  var bfr = helper.freshRegistry()
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, 0222);
  }
  bfr.register(dir, function(err, results) {
    fs.rmdirSync(dir)
    t.same(typeof(err), 'undefined')
    t.end()
  })
})

test('put the stats of all files and directories in a database', function (t) {
  var db = MemDB()
  var bfr = helper.freshRegistry({db: db})
  var deviceId = fs.statSync("/").dev

  bfr.register(__dirname + "/data", function(err, results) {
    if (err) throw err;
    var dataDirKey = helper.entryIdFor(__dirname + '/data')
    db.get(dataDirKey, function (err, value) {
      var dataDirEntry = JSON.parse(value)
      t.same(dataDirEntry.path, __dirname + '/data', "stores path")
      t.same(dataDirEntry.size, 170, "stores size")
      t.same(dataDirEntry.birthtime, '2016-05-12T19:23:09.000Z', "stores birthtime")
      t.same(dataDirEntry.children, [ '.hidden', 'sample.txt', 'subdir' ], "stores children (if dir)")
      t.same(dataDirEntry.type, 'dir', "stores type (dir)")
    })
    var fileEntryKey = helper.entryIdFor(__dirname + '/data/sample.txt')
    db.get(fileEntryKey, function (err, value) {
      var fileEntry = JSON.parse(value)
      t.same(fileEntry.path, __dirname + '/data/sample.txt', "stores path")
      t.same(fileEntry.size, 28, "stores size")
      t.same(fileEntry.birthtime, '2016-05-12T19:37:42.000Z', "stores birthtime")
      t.same(fileEntry.mtime, '2016-05-12T21:05:14.000Z', "stores mtime")
      t.same(fileEntry.children, undefined, "does not store children if file")
      t.same(fileEntry.type, 'file', "stores type (file)")
    })
    var subDirKey = helper.entryIdFor(__dirname + '/data/subdir')
    db.get(subDirKey, function (err, value) {
      var subDirEntry = JSON.parse(value)
      t.same(subDirEntry.path, __dirname + '/data/subdir', "stores path")
      t.same(subDirEntry.size, 136, "stores size")
      t.same(subDirEntry.birthtime, '2016-05-12T20:08:51.000Z', "stores birthtime")
      t.same(subDirEntry.mtime, '2016-05-17T16:07:51.000Z', "stores mtime")
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
      t.end()
    })
  })
})
