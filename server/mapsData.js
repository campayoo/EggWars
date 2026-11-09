// ============================================================================
// server/mapsData.js — (compatibilidad) Los mapas ahora viven en shared/mapdefs.js,
// compartidos por cliente y servidor. Este archivo sólo los re-exporta.
// ============================================================================
const MapDefs = require('../shared/mapdefs.js');

const MAPS_DATA = {};
for (const def of MapDefs.LIST) {
  const d = MapDefs.build(def.id);
  MAPS_DATA[def.id] = {
    id: def.id, name: def.name, description: def.desc,
    halfSize: d.halfSize, gravity: d.gravity,
    spawns: d.spawns, teamSpawns: d.teamSpawns,
  };
}

module.exports = { MAPS_DATA };
