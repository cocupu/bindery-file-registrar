var fs = require('fs')
var sha1 = require('sha1');
var level = require('level')

module.exports = FileRegistrar

function FileRegistrar (opts) {
  if (!opts) opts = {}
  this.db = opts.db || level('data.db')
}

FileRegistrar.prototype.register = function (dir, done) {
  walk(dir, this.db, done)
}

// Note: In theory, this could be done with a pipeline like:
//  this.db.createReadStream()
//  .pipe(filter(isWanted))
//  .pipe(entityToObject)
//  .pipe(concatStream);
// ... but I couldn't figure out how to get that to work. - MZ May 2016
FileRegistrar.prototype.export = function (opts, callback) {
  if (!opts) opts = {}
  var jsonBody = {}
  this.db.createReadStream()
  .on('data', function (data) {
    var dbKey = data.key
    if (shouldIncludeEntry(dbKey, opts)) {
      var device = dbKey.substr(0,dbKey.indexOf(':'))
      var localKey = dbKey.substr(dbKey.indexOf(':')+1);
      if (!jsonBody[device]) jsonBody[device]  = {}
      jsonBody[device][localKey] = data.value
    }
  })
  .on('error', function (err) {
    console.log('Oh my! An error occured on export', err)
  })
  .on('end', function () {
    callback(jsonBody)
  })
}

// filter entries from database for inclusion/exclusion in the export based on opts (`only:` and `exclude:`)
function shouldIncludeEntry(key, opts) {
  return true
}

var walk = function(dir, db, done) {
  var results = {};
  // include the current dir in the registry
  fs.stat(dir, function(err, stat) {
    var entryKey = stat.dev + ":" + dir
    var entryInfo = {type: 'dir', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, children:fs.readdirSync(dir)}
    db.put(entryKey, JSON.stringify(entryInfo), function (err) {
      if (err) return console.log('Ooops!', err)
    })
  })
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) return done(null, results);
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        var entryKey = stat.dev + ":" + file
        if (stat && stat.isDirectory()) {
          var entryInfo = {type: 'dir', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, children:fs.readdirSync(file)}
          db.put(entryKey, JSON.stringify(entryInfo), function (err) {
            if (err) return console.log('Ooops!', err)
          })
          walk(file, db, function(err, res) {
            next();
          });
        } else {
          var checksum = sha1(fs.readFileSync(file));
          var entryInfo = {type: 'file', size: stat.size, checksum: checksum, checksumType: 'sha1', mtime: stat.mtime, birthtime: stat.birthtime}
          db.put(entryKey, JSON.stringify(entryInfo), function (err) {
            if (err) return console.log('Ooops!', err)
          })
          next();
        }
      });
    })();
  });
};