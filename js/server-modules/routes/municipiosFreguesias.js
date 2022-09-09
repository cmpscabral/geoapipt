const debug = require('debug')('geoapipt:server')

module.exports = {
  fn: routeFn,
  route: /^\/municipios?\/freguesias?$/
}

function routeFn (req, res, next, { administrations }) {
  debug(req.path, req.query, req.headers)
  res.status(200).sendData(
    administrations.listOfMunicipalitiesWithParishes,
    'Lista de municípios com as respetivas freguesias'
  )
}
