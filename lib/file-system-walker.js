var fs = require('fs')
const path = require('path')
const EventEmitter = require('events');

module.exports = FileSystemWalker

function FileSystemWalker () {}

FileSystemWalker.walkAndRegister = function (dir, db, emitter, done) {
  var entryInfo = {}
  emitter.emit('start', dir)

  fs.readdir(dir, function(err, list) {
    if (err) {
      emitter.emit('bad-dir', dir, err)
      return done();
    }

    // include the current dir in the registry
    fs.stat(dir, function(err, stat) {
      var entryKey = stat.dev + ":" + dir
      entryInfo = {type: 'dir', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: dir, storagePlatform: 'localFs', deviceId: stat.dev, children:list}
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
        return done(null, entryInfo)
      }
      file = path.normalize(dir + '/' + file);
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
            FileSystemWalker.walkAndRegister(file, db, innerEmitter, function(err, res) {
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
