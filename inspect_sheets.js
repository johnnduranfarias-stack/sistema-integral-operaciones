const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log("ALL SHEET NAMES:", workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Sheet "${sheetName}" has ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log(`Keys in sheet "${sheetName}":`, Object.keys(rows[0]));
      // Print first row as sample
      console.log(`Sample row 0:`, rows[0]);
    }
    console.log("----------------------------------------");
  });
} catch (e) {
  console.error("Error inspecting sheets:", e);
}
