const fs = require('fs')
const path = require('path')
const appRoot = require('app-root-path')
const debug = require('debug')('geoapipt:server')
const { normalizeName } = require(path.join(__dirname, '..', 'utils', 'commonFunctions.js'))

const municipalitiesGeojsonDir = path.join(appRoot.path, '..', 'resources', 'res', 'geojson', 'municipalities')
const isResponseJson = require(path.join(appRoot.path, 'src', 'server', 'utils', 'isResponseJson.js'))

module.exports = {
  fn: routeFn,
  route: '/municipios?/:municipality?'
}

function routeFn (req, res, next, { administrations }) {
  debug(req.path, req.query, req.headers)

  if (req.params.municipality === 'freguesia' || req.params.municipality === 'freguesias') {
    next()
    return
  }

  // if name is not provided in query, consider parameter from url instead
  // example /municipio/évora
  if (req.params.municipality && !req.query.nome) {
    req.query.nome = req.params.municipality
  }

  // ### validate request query ###
  // check if all parameters of request exist in municipalitiesDetails
  const keysOfMunicipalitiesDetails = administrations.keysOfMunicipalitiesDetails
  const allowableQueryParams = keysOfMunicipalitiesDetails.concat('json', 'key')

  const invalidParameters = []
  for (const param in req.query) {
    if (!req.query[param] || !allowableQueryParams.includes(param)) {
      invalidParameters.push(param)
    }
  }
  if (invalidParameters.length) {
    res.status(404).sendData({ error: `These parameters are invalid or don't exist for ${req.path}: ${invalidParameters}` })
    return
  }
  // ### request query is valid from here ###

  const arrayOfQueryParam = Object.keys(req.query)

  if (
    !arrayOfQueryParam.some(par => keysOfMunicipalitiesDetails.includes(par))
  ) {
    // no query paramters were provided
    // shows just a list of all municipalities in this case
    const _result = administrations.listOfMunicipalitiesNames
    const result = JSON.parse(JSON.stringify(_result)) // deep clone

    if (isResponseJson(req)) {
      res.status(200).sendData({ data: result })
    } else {
      let resultHtml = result
      resultHtml = resultHtml.map(el => `<a href="/municipio/${encodeURIComponent(el.toLowerCase())}">${el}</a>`)

      res.status(200).sendData({
        data: resultHtml,
        input: 'Lista de todos os municípios',
        pageTitle: 'Lista dos municípios de Portugal'
      })
    }
  } else {
    // search municipality first by name and then by other fields (nif, codigopostal, etc.)
    const { nome } = req.query
    let results = [...administrations.municipalitiesDetails]

    // search for name
    if (nome) {
      const municipalityToFind = normalizeName(nome)
      results = results.filter(
        municipality => normalizeName(municipality.nome) === municipalityToFind
      )
    }

    // remaining filters: ['codigo', 'nif', 'codigopostal'...] except 'nome'
    // remove 'nome' from keysOfMunicipalitiesDetails
    const filters = keysOfMunicipalitiesDetails.filter(par => par !== 'nome')

    for (const filter of filters) {
      if (req.query[filter]) {
        results = results.filter(p => p[filter] == req.query[filter]) // eslint-disable-line eqeqeq
      }
    }

    results = JSON.parse(JSON.stringify(results)) // deep clone

    if (results.length > 1) {
      res.status(200).sendData({
        data: results,
        input: 'Lista de municípios',
        pageTitle: `Dados sobre municípios: ${results.map(e => `${e.nome}`).join(', ')}`
      })
    } else if (results.length === 1) {
      const result = results[0]
      const municipalityGeojsons = JSON.parse(
        fs.readFileSync(path.join(municipalitiesGeojsonDir, result.codigoine.padStart(4, '0') + '.json'))
      )

      if (municipalityGeojsons) {
        result.geojsons = municipalityGeojsons
      }

      if (isResponseJson(req)) {
        res.status(200).sendData({ data: result })
      } else {
        // html/text response
        const dataToShowOnHtml = JSON.parse(JSON.stringify(result)) // deep clone

        // no need to show geojsons on html page
        if (municipalityGeojsons) {
          delete dataToShowOnHtml.geojsons
          dataToShowOnHtml.centros = Object.assign({}, municipalityGeojsons.municipio.properties.centros)
        }

        // information already available in section Censos
        delete dataToShowOnHtml.populacao

        res.status(200).sendData({
          data: result,
          input: {
            Município: `${result.nome} (<a href="/municipio/${nome}/freguesias">Freguesias</a>)`
          },
          dataToShowOnHtml: dataToShowOnHtml,
          pageTitle: `Dados sobre o Município de ${result.nome}`,
          template: 'routes/municipality'
        })
      }
    } else {
      res.status(404).sendData({ error: 'Município não encontrado!' })
    }
  }
}
