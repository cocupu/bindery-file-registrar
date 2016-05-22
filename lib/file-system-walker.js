var fs = require('fs')
const path = require('path')
const EventEmitter = require('events');
const Identifiers = require('./identifiers');


module.exports = FileSystemWalker

function FileSystemWalker () {}

FileSystemWalker.walkAndRegister = function (dirPath, db, emitter) {
  return registerFileOrDirectory(dirPath, db, emitter)
}

// example usage
// getSize(__dirname + "/../test/data").then(function(size){
//     console.log('Final Result: ', JSON.stringify(size));
// }).catch(console.error.bind(console));
function registerFileOrDirectory(dirPath, db, emitter){
  emitter.emit('start', dirPath)
  return getStat(dirPath).then(function(stat){
    var entryInfo = entryInfoFor(dirPath, stat)
    if (entryInfo.type === 'dir') {
      return registerDirectory(entryInfo, db, emitter)
    } else {  // if file return size directly
      return registerFile(entryInfo, db, emitter)
    }
  });
}

function writeEntityToDatabase (entryInfo, db, callback) {
  var entryKey = Identifiers.entryIdFor(entryInfo.path, entryInfo.deviceId)
  db.put(entryKey, JSON.stringify(entryInfo), function (err) {
    if (err) return console.log('Ooops!', err)
    callback(entryKey)
  })
}

function registerFile (entryInfo, db, emitter) {
  var deferred = Promise.defer()
  writeEntityToDatabase(entryInfo, db, function (entryKey) {
    emitter.emit('entity-registered', entryKey)
    emitter.emit('file-registered', entryKey)
    deferred.resolve(entryInfo)
  })
  return deferred.promise
}

function registerDirectory (entryInfo, db, emitter) {
  var deferred = Promise.defer()
  getFiles(entryInfo.path)
  .catch(function(err) {
    var entryKey = Identifiers.entryIdFor(entryInfo.path, entryInfo.deviceId)
    emitter.emit('bad-path', entryKey +" "+err.code+": "+err.message)
    deferred.resolve(entryInfo)
  })
  .then(function(files){    // getting list of inner files
    entryInfo.children = files
    var promises = files.map(function(file){
      return path.join(entryInfo.path, file);
    }).map(function (childPath) {
      // Capture and re-emit fileRegistered and directoryRegistered events from recursive passes
      innerEmitter = new EventEmitter()
      .on('file-registered', function (entryKey) { emitter.emit('file-registered', entryKey) })
      .on('directory-registered', function (entryKey) { emitter.emit('directory-registered', entryKey) })
      .on('entity-registered', function (entryKey) { emitter.emit('entity-registered', entryKey) })
      return registerFileOrDirectory(childPath, db, innerEmitter)
    });    // recursively getting size of each file
    return Promise.all(promises);
  }).then(function (childEntries) {  // success callback once all the promise are fullfiled i. e size is collected
      childEntries.forEach(function(childEntryInfo){ // iterate through array and sum things
        entryInfo.size = entryInfo.size+childEntryInfo.size;
      });
      writeEntityToDatabase(entryInfo, db, function (entryKey) {
        emitter.emit('entity-registered', entryKey)
        emitter.emit('directory-registered', entryKey)
        emitter.emit('done', entryInfo.path)
        deferred.resolve(entryInfo)
      })
  });
  return deferred.promise
}

function entryInfoFor (itemPath, stat) {
  entryInfo = {size: stat.size, mtime: stat.mtime, birthtime: stat.birthtime, path: itemPath, deviceId: stat.dev}
  entryInfo.storagePlatform = 'localFs'
  if (stat.isDirectory() && !isBundleDir(itemPath) && !isHidden(itemPath)) {
    entryInfo.type = 'dir'
  } else {
    entryInfo.type = 'file'
  }
  return entryInfo
}

// promisified get stats method
function getStat(filePath){
  return new Promise(function(resolve, reject){
    fs.lstat(filePath, function(err, stat){
      if(err) return reject(err);
      resolve(stat);
    });
  });
}

// promisified get files method
function getFiles(dir){
  return new Promise(function(resolve, reject){
    fs.readdir(dir, function(err, stat){
      if(err) return reject(err);
      resolve(stat);
    });
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
