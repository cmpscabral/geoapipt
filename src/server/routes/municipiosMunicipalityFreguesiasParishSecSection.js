const fs = require('fs')
const path = require('path')
const appRoot = require('app-root-path')
const debug = require('debug')('geoapipt:server')

const { normalizeName } = require(path.join(__dirname, '..', 'utils', 'commonFunctions.js'))
const isResponseJson = require(path.join(appRoot.path, 'src', 'server', 'utils', 'isResponseJson.js'))

const geojsonDir = path.join(appRoot.path, 'res', 'geojson')
const sectionsCensosDir = path.join(appRoot.path, 'res', 'censos', 'data', 'seccoes')

module.exports = {
  fn: routeFn,
  route: '/municipios?/:municipality?/freguesias?/:parish?/sec/:section?'
}

async function routeFn (req, res, next, { administrations, regions }) {
  debug(req.path, req.query, req.headers)

  if (!req.params.municipality || !req.params.parish || !req.params.section) {
    next()
    return
  }

  const municipality = req.params.municipality
  const parish = req.params.parish
  const section = req.params.section.padStart(3, '0')

  let parishResults = [...administrations.parishesDetails]

  const parishToFind = normalizeName(parish)
  const municipalityToFind = normalizeName(municipality)

  parishResults = parishResults.filter(parish => {
    const name0 = normalizeName(parish.nome)
    const name1 = normalizeName(parish.nomecompleto)
    const name2 = normalizeName(parish.nomecompleto2)
    const name3 = normalizeName(parish.nomecompleto3)
    return (
      (
        parishToFind === name0 ||
        parishToFind === name1 ||
        parishToFind === name2 ||
        parishToFind === name3
      ) &&
      municipalityToFind === normalizeName(parish.municipio)
    )
  })

  parishResults = JSON.parse(JSON.stringify(parishResults)) // deep clone

  if (parishResults.length === 1) {
    const parish = parishResults[0]

    const parishCode = parish.codigoine.padStart(6, '0')
    const municipalityCode = parishCode.slice(0, 4)
    const sectionFullCode = parishCode + section

    const municipality = administrations.municipalitiesDetails
      .find(e => parseInt(e.codigoine) === municipalityCode)

    const sectionObj = {
      freguesia: parish,
      municipio: municipality
    }

    const geojsonFile = path.join(geojsonDir, 'seccoes', '2021', `${municipalityCode}.json`)
    const censosFile = path.join(sectionsCensosDir, parishCode, `${sectionFullCode}.json`)

    if (!fs.existsSync(geojsonFile)) {
      res.status(404).sendData({ error: `Ficheiro Geojson ${path.relative(appRoot.path, geojsonFile)} não encontrado!` })
      return
    }
    if (!fs.existsSync(censosFile)) {
      res.status(404).sendData({ error: `Ficheiro de Censos ${path.relative(appRoot.path, censosFile)} não encontrado!` })
      return
    }

    const dataFromFiles = await Promise.all([fs.promises.readFile(geojsonFile), fs.promises.readFile(censosFile)])
    const sectionsGeojson = JSON.parse(dataFromFiles[0])
    const sectionsCensos = JSON.parse(dataFromFiles[1])

    const sectionGeojson = sectionsGeojson.features
      .find(el => el.properties.DTMNFRSEC21.padStart(9, '0') === sectionFullCode.padStart(9, '0'))

    if (sectionGeojson) {
      sectionObj.geojson = sectionGeojson
    }

    if (sectionsCensos) {
      for (const key of sectionsCensos) {
        if (key.startsWith('censos')) {
          sectionObj[key] = sectionsCensos[key]
        }
      }
    }

    if (isResponseJson(req)) {
      res.status(200).sendData({ data: sectionObj })
    } else {
      // html/text response
      const dataToShowOnHtml = JSON.parse(JSON.stringify(sectionObj)) // deep clone

      delete dataToShowOnHtml.freguesia
      delete dataToShowOnHtml.municipio

      if (sectionGeojson) {
        delete dataToShowOnHtml.geojson
      }

      res.status(200).sendData({
        data: sectionObj,
        input: {
          Secção: section,
          Freguesia: `${parish.nomecompleto} (<a href="/municipio/${parish.municipio.toLowerCase()}">${parish.municipio}</a>)`
        },
        dataToShowOnHtml: dataToShowOnHtml,
        pageTitle: `Dados sobre a Secção da Freguesia ${parish.nomecompleto} (${parish.municipio})`,
        template: 'routes/seccao'
      })
    }
  } else {
    res.status(404).sendData({ error: `Secção ${section} da freguesia ${parish} do município ${municipality} não encontrada!` })
  }
}
