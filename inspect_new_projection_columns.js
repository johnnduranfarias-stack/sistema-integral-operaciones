const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  if (workbook.SheetNames.includes("Proyección")) {
    const sheet = workbook.Sheets["Proyección"];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Sheet "Proyección" has ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log(`ALL KEYS IN NEW PROYECION SHEET:`, Object.keys(rows[0]));
      console.log("Sample row 0:", rows[0]);
      console.log("Sample row 1:", rows[1]);
      console.log("Sample row 2:", rows[2]);
    }
  } else {
    console.log("Sheet 'Proyección' NOT found!");
  }
} catch (e) {
  console.error("Error inspecting sheet:", e);
}
