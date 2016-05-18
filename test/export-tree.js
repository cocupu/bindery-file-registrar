var test = require('tape')
var helper = require('./test-helper')

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
