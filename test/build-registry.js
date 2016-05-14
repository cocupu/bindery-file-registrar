var test = require('tape')
var FileRegistryTool = require('../')
var MemDB = require('memdb');
var fs = require('fs')

test('put the stats of all files and directories in a database', function (t) {
  var db = MemDB()
  var bfr = freshTool({db: db})
  var deviceId = fs.statSync("/").dev

  bfr.register(__dirname + "/data", function(err, results) {
    if (err) throw err;
    bfr.export({}, function (json) {
      t.same(Object.keys(json), [deviceId.toString()], "nests entries by device id")
      var expectedEntries = {}
      expectedEntries[__dirname + '/data'] = '{"type":"dir","size":136,"mtime":"2016-05-12T20:08:51.000Z","birthtime":"2016-05-12T19:23:09.000Z","children":["sample.txt","subdir"]}'
      expectedEntries[__dirname + '/data/sample.txt'] = '{"type":"file","size":28,"checksum":"69c6390b26de19f8c4f6eb387360bb250467f1b5","checksumType":"sha1","mtime":"2016-05-12T21:05:14.000Z","birthtime":"2016-05-12T19:37:42.000Z"}',
      expectedEntries[__dirname + '/data/subdir'] = '{"type":"dir","size":102,"mtime":"2016-05-12T20:09:26.000Z","birthtime":"2016-05-12T20:08:51.000Z","children":["hells angels kissing - hunter thompson.jpg"]}',
      expectedEntries[__dirname + '/data/subdir/hells angels kissing - hunter thompson.jpg'] = '{"type":"file","size":135186,"checksum":"a50b82dd0aaa2536a68b231cb775faec82a0ed9c","checksumType":"sha1","mtime":"2011-12-17T05:11:36.000Z","birthtime":"2011-12-17T05:11:36.000Z"}'
      t.same(json[deviceId], expectedEntries, "stores data about all directories and files")
      t.end()
    })

  })

})

function freshTool (opts) {
  opts.db = opts.db || MemDB()
  return new FileRegistryTool(opts)
}
