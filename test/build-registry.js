var test = require('tape')
var FileRegistryTool = require('../')
var MemDB = require('memdb');
var level = require('level')
var fs = require('fs')

test('put the stats of all files and directories in a database', function (t) {
  var db = MemDB()
  var bfr = freshTool({db: db})
  var deviceId = fs.statSync("/").dev

  bfr.register(__dirname + "/data", function(err, results) {
    if (err) throw err;
    bfr.export({}, function (json) {
      t.same(Object.keys(json), [deviceId.toString()], "nests entries by device id")
      t.same(Object.keys(json[deviceId]).length, 4)
      var dataDirEntry = json[deviceId][__dirname + '/data']
      t.same(dataDirEntry.path, __dirname + '/data')
      t.same(dataDirEntry.size, 136)
      t.same(dataDirEntry.birthtime, '2016-05-12T19:23:09.000Z')
      t.same(dataDirEntry.mtime, '2016-05-12T20:08:51.000Z')
      t.same(dataDirEntry.children, [ 'sample.txt', 'subdir' ])
      t.same(dataDirEntry.type, 'dir')

      var fileEntry = json[deviceId][__dirname + '/data/sample.txt']
      t.same(fileEntry.path, __dirname + '/data/sample.txt')
      t.same(fileEntry.size, 28)
      t.same(fileEntry.birthtime, '2016-05-12T19:37:42.000Z')
      t.same(fileEntry.mtime, '2016-05-12T21:05:14.000Z')
      t.same(fileEntry.children, undefined)
      t.same(fileEntry.type, 'file')

      var subDirEntry = json[deviceId][__dirname + '/data/subdir']
      t.same(subDirEntry.path, __dirname + '/data/subdir')
      t.same(subDirEntry.size, 102)
      t.same(subDirEntry.birthtime, '2016-05-12T20:08:51.000Z')
      t.same(subDirEntry.mtime, '2016-05-12T20:09:26.000Z')
      t.same(subDirEntry.children, ["hells angels kissing - hunter thompson.jpg"])
      t.same(subDirEntry.type, 'dir')

      t.end()
    })

  })

})

function freshTool (opts) {
  opts.db = opts.db || MemDB()
  return new FileRegistryTool(opts)
}
