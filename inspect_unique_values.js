const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets["Proyección"];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const uniqueTipos = new Set();
  const uniqueLineas = new Set();
  const lineaMap = {};

  rows.forEach(row => {
    uniqueTipos.add(row["Tipo"]);
    uniqueLineas.add(row["Linea"]);
    
    const l = row["Linea"] || "Vacio";
    const t = row["Tipo"] || "Vacio";
    if (!lineaMap[l]) lineaMap[l] = new Set();
    lineaMap[l].add(t);
  });

  console.log("UNIQUE TIPOS:", Array.from(uniqueTipos));
  console.log("UNIQUE LINEAS:", Array.from(uniqueLineas));
  console.log("LINEA TO TIPO MAPPING:");
  for (const l in lineaMap) {
    console.log(`- Linea: "${l}" -> Tipos:`, Array.from(lineaMap[l]));
  }
} catch (e) {
  console.error("Error:", e);
}
