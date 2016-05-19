const fs = require('fs')
const path = require('path')
const Identifiers = require('./identifiers')

module.exports = Exporter

function Exporter () {}

Exporter.exportTree = function (rootEntry, db, opts, done) {
  if (!opts) opts = {}
  var jsonBody = {}
  db.get(rootEntry, function (err, value) {
    if (err) {
      console.log(err.message)
      done()
    } else {
      var entry = JSON.parse(value)
      jsonBody.name = path.basename(entry.path)
      jsonBody.size = entry.size
      jsonBody.id = rootEntry
      if (entry.children) {
        jsonBody.children = []
        for (var i in entry.children) {
          var childPath = path.normalize(entry.path+"/"+entry.children[i])
          Exporter.exportTree(Identifiers.entryIdFor(childPath, entry.deviceId), db, opts, function (childJson) {
            if (childJson) jsonBody.children.push(childJson)
            // if all of the children have been appended, return the jsonBody
            if (jsonBody.children.length == entry.children.length) { done(jsonBody) }
          })
        }
      } else {
        done(jsonBody)
      }
    }
  })
}

Exporter.exportTreeToFile = function (rootEntry, destinationPath, db, opts, done) {
    Exporter.exportTree (rootEntry, db, opts, function (exportedJSON) {
      fs.writeFile(destinationPath, JSON.stringify(exportedJSON), function (err) {
        if (err) return console.log(err);
        done(exportedJSON)
      })
    })
}

// Note: In theory, this could be done with a pipeline like:
//  this.db.createReadStream()
//  .pipe(filter(isWanted))
//  .pipe(entityToObject)
//  .pipe(concatStream);
// ... but I couldn't figure out how to get that to work. - MZ May 2016
Exporter.exportDb = function (db, opts, callback) {
  if (!opts) opts = {}
  var jsonBody = {}
  db.createReadStream()
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
