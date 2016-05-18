var test = require('tape')
var helper = require('./test-helper')
var fs = require('fs')

test('export entire db to json', function (t) {
  var bfr = helper.freshRegistry()
  var deviceId = fs.statSync("/").dev

  bfr.register(__dirname + "/data", function(err, results) {
    if (err) throw err;
    bfr.exportDb({}, function (json) {
      t.same(Object.keys(json), [deviceId.toString()], "nests entries by device id")
      t.same(Object.keys(json[deviceId]).length, 6, "registers the expected amount of entities")
      var dataDirEntry = json[deviceId][__dirname + '/data']
      t.same(dataDirEntry.path, __dirname + '/data', "stores path")
      t.same(dataDirEntry.size, 170, "stores size")
      t.same(dataDirEntry.birthtime, '2016-05-12T19:23:09.000Z', "stores birthtime")
      t.same(dataDirEntry.children, [ '.hidden', 'sample.txt', 'subdir' ], "stores children (if dir)")
      t.same(dataDirEntry.type, 'dir', "stores type (dir)")

      var fileEntry = json[deviceId][__dirname + '/data/sample.txt']
      t.same(fileEntry.path, __dirname + '/data/sample.txt', "stores path")
      t.same(fileEntry.size, 28, "stores size")
      t.same(fileEntry.birthtime, '2016-05-12T19:37:42.000Z', "stores birthtime")
      t.same(fileEntry.mtime, '2016-05-12T21:05:14.000Z', "stores mtime")
      t.same(fileEntry.children, undefined, "does not store children if file")
      t.same(fileEntry.type, 'file', "stores type (file)")

      var subDirEntry = json[deviceId][__dirname + '/data/subdir']
      t.same(subDirEntry.path, __dirname + '/data/subdir', "stores path")
      t.same(subDirEntry.size, 136, "stores size")
      t.same(subDirEntry.birthtime, '2016-05-12T20:08:51.000Z', "stores birthtime")
      t.same(subDirEntry.mtime, '2016-05-17T16:07:51.000Z', "stores mtime")
      t.same(subDirEntry.children, ['FakeApplication.app', "hells angels kissing - hunter thompson.jpg"], "stores children")
      t.same(subDirEntry.type, 'dir', "stores type (dir)")

      t.same(json[deviceId][__dirname + '/data/subdir/FakeApplication.app'].type, 'file', 'Registers .app directories as files')
      t.notOk(json[deviceId][__dirname + '/data/subdir/FakeApplication.app/innerfile.txt'], 'does not register contents of .app directories')
      t.same(json[deviceId][__dirname + '/data/.hidden'].type, 'file', 'Registers hidden directories as files')

      t.end()
    })

  })
})
