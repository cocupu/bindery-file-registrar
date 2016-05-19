var fs = require('fs')
const path = require('path')
const EventEmitter = require('events');
const Identifiers = require('./identifiers');


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
      var entryKey = Identifiers.entryIdFor(dir, stat.dev)
      entryInfo = {type: 'dir', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: dir, storagePlatform: 'localFs', deviceId: stat.dev, children:list}
      db.put(entryKey, JSON.stringify(entryInfo), function (err) {
        if (err) return console.log('Ooops!', err)
        emitter.emit('directory-registered', entryKey)
        emitter.emit('entity-registered', entryKey)
      })
    })
    var i = 0;
    (function next() {
      var childBaseName = list[i++];
      if (!childBaseName) {
        emitter.emit('done', dir)
        return done(null, entryInfo)
      }
      childPath = path.normalize(dir + '/' + childBaseName);
      fs.stat(childPath, function(err, stat) {
        if (err) {
          console.log(err)
          emitter.emit('bad-file', childPath, err)
          next()
        } else {
          // var entryKey = Identifiers.entryIdFor(childPath, stat.dev)
          if (stat && stat.isDirectory() && !isBundleDir(childPath) && !isHidden(childPath)) {
            registerDirectory(childPath, stat, db, emitter, function (dirEntryInfo) {
              next()
            })
          } else {
            registerFile(childPath, stat, db, emitter, function (fileEntryInfo) {})
            next();
          }
        }
      });
    })();
  });
  return emitter
};

function registerFile (path, stat, db, emitter, done) {
  var entryKey = Identifiers.entryIdFor(path, stat.dev)
  var entryInfo = {type: 'file', size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: path, storagePlatform: 'localFs', deviceId: stat.dev}
  // var checksum = sha1(fs.readFileSync(file));
  // entryInfo.checksum = checksum
  // entryInfo.checksumType = 'sha1'
  db.put(entryKey, JSON.stringify(entryInfo), function (err) {
    if (err) return console.log('Ooops!', err)
    emitter.emit('file-registered', entryKey)
    emitter.emit('entity-registered', entryKey)
    done(entryInfo)
  })
}

function registerDirectory (path, stat, db, emitter, done) {
  var entryKey = Identifiers.entryIdFor(path, stat.dev)
  // Capture and re-emit fileRegistered and directoryRegistered events from recursive passes
  innerEmitter = new EventEmitter()
  .on('file-registered', function (entryKey) { emitter.emit('file-registered', entryKey) })
  .on('directory-registered', function (entryKey) { emitter.emit('directory-registered', entryKey) })
  .on('entity-registered', function (entryKey) { emitter.emit('entity-registered', entryKey) })
  FileSystemWalker.walkAndRegister(path, db, innerEmitter, function(err, res) {
    done();
  });
}

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
