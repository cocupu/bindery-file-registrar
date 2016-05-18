const test = require('tape')
const helper = require('./test-helper')
const fs = require('fs')
const path = require('path')

test('export tree', function (t) {
  var bfr = helper.freshRegistry()
  var rootPath = __dirname + "/data"
  bfr.register(rootPath, function(err, results) {
    if (err) throw err;
    bfr.exportTree(helper.entryIdFor(rootPath), {}, function (json) {
      // console.log(JSON.stringify(json))
      t.same(json.id, helper.entryIdFor(rootPath), "sets the entryId")
      t.same(json.name, "data", "sets name to basename from path")
      t.ok(json.size, "sets the size")
      var subdir = json.children.filter(function(x) { return x.name == "subdir"; })[0];
      t.same(subdir.id, helper.entryIdFor(rootPath+"/subdir"), "adds children to the tree")
      var fakeApplication = subdir.children.filter(function(x) { return x.name == "FakeApplication.app"; })[0];
      t.same(fakeApplication.id, subdir.id+"/FakeApplication.app", "recursively adds sub-children")
    })
    t.end()
  })
})

test('export to json file', function (t) {
  var bfr = helper.freshRegistry()
  var rootPath = __dirname + "/data"
  var exportPath = __dirname + "/../tmp/export.json"
  if (!fs.existsSync(path.dirname(exportPath))){
    fs.mkdirSync(path.dirname(exportPath));
  }
  bfr.register(rootPath, function(err, results) {
    if (err) throw err;
    bfr.exportTreeToFile(helper.entryIdFor(rootPath), exportPath, {}, function (exportJson) {
      var fileJson = JSON.parse(fs.readFileSync(exportPath))
      t.same(fileJson.id, exportJson.id)
      t.end()
    })
  })
})
