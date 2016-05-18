var fs = require('fs')

module.exports = Identifiers

function Identifiers () {}

Identifiers.entryIdFor = function (path, deviceId) {
  if (!deviceId) deviceId = fs.statSync(path).dev
  return deviceId.toString()+":"+path
}
