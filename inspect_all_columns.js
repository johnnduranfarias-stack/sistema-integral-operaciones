const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets["Proyección"];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const allKeys = new Set();
  rows.forEach(row => {
    Object.keys(row).forEach(k => allKeys.add(k));
  });

  console.log("ALL DETECTED KEYS ACROSS ALL ROWS IN PROYECION:", Array.from(allKeys));
} catch (e) {
  console.error("Error:", e);
}
