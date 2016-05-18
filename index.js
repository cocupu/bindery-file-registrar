var fs = require('fs')
var path = require('path')
var sha1 = require('sha1');
var level = require('level')
const EventEmitter = require('events');

module.exports = FileRegistrar

function FileRegistrar (opts) {
  if (!opts) opts = {}
  this.db = opts.db || level('data.db')
  this.eventEmitter = new EventEmitter()
}

FileRegistrar.prototype.register = function (dir, done) {
  return walk(dir, this.db, this.eventEmitter, done)
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
      jsonBody[device][localKey] = JSON.parse(data.value)
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

var walk = function (dir, db, emitter, done) {
  var results = {};
  emitter.emit('start', dir)

  fs.readdir(dir, function(err, list) {
    if (err) return done(err);

    // include the current dir in the registry
    fs.stat(dir, function(err, stat) {
      var entryKey = stat.dev + ":" + dir
      var entryInfo = {type: 'dir', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: dir, storagePlatform: 'localFs', deviceId: stat.dev, children:list}
      db.put(entryKey, JSON.stringify(entryInfo), function (err) {
        if (err) return console.log('Ooops!', err)
        emitter.emit('directoryRegistered', entryKey)
      })
    })

    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) {
        emitter.emit('done', dir)
        return done(null, results)
      }
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (err) {
          console.log(err)
          emitter.emit('bad-file', file, err)
          next()
        } else {
          var entryKey = stat.dev + ":" + file
          if (stat && stat.isDirectory() && !isBundleDir(file) && !isHidden(file)) {
            // Capture and re-emit fileRegistered and directoryRegistered events from recursive passes
            innerEmitter = new EventEmitter()
            .on('fileRegistered', function (entryKey) { emitter.emit('fileRegistered', entryKey) })
            .on('directoryRegistered', function (entryKey) { emitter.emit('directoryRegistered', entryKey) })
            walk(file, db, innerEmitter, function(err, res) {
              next();
            });
          } else {
            var entryInfo = {type: 'file', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: file, storagePlatform: 'localFs', deviceId: stat.dev}
            // var checksum = sha1(fs.readFileSync(file));
            // entryInfo.checksum = checksum
            // entryInfo.checksumType = 'sha1'
            db.put(entryKey, JSON.stringify(entryInfo), function (err) {
              if (err) return console.log('Ooops!', err)
              emitter.emit('fileRegistered', entryKey)
            })
            next();
          }
        }
      });
    })();
  });
  return emitter
};

function isBundleDir(filepath) {
  var suffixes = [".framework",".app",".lproj",".bundle",".mbox",".noindex",".photoslibrary",".migratedphotolibrary",".db",".ofocus-backup"]
  for (var i in suffixes) {
    if (endsWith(filepath, suffixes[i])) { return true }
  }
  return false
}
function isHidden(filepath) {
  return beginsWith(path.basename(filepath), ".")
}
function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
function beginsWith(str, prefix) {
    return str.indexOf(prefix) == 0;
}
