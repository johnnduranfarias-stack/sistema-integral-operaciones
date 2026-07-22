const XLSX = require('./xlsx.js');
const fs = require('fs');

const path = "C:\\Users\\JDURAN1\\Downloads\\PLANIFICACION 22 DE JUNIO DEL 2026.xlsx";
try {
  const fileBuffer = fs.readFileSync(path);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const match = rows.find(r => Object.values(r).some(v => String(v).includes("01.02.01.1538.1")));
    if (match) {
      console.log(`Found 01.02.01.1538.1 in sheet "${sheetName}":`, match);
    } else {
      console.log(`Not found in sheet "${sheetName}"`);
    }
  });
} catch (e) {
  console.error("Error searching:", e);
}
