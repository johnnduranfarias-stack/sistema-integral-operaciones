const XLSX = require('./xlsx.js');
const fs = require('fs');

const path = "C:\\Users\\JDURAN1\\Downloads\\PLANIFICACION 22 DE JUNIO DEL 2026.xlsx";
try {
  const fileBuffer = fs.readFileSync(path);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  if (workbook.SheetNames.includes("Planificacion")) {
    const sheet = workbook.Sheets["Planificacion"];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Total rows in "Planificacion":`, rows.length);
    if (rows.length > 0) {
      console.log("Headers in 'Planificacion':", Object.keys(rows[0]));
      console.log("Sample first 10 rows:");
      console.log(JSON.stringify(rows.slice(0, 10), null, 2));
      
      // Find if there is a row with TOTAL
      const totalRow = rows.find(r => {
        return Object.values(r).some(v => String(v).toUpperCase().includes("TOTAL"));
      });
      console.log("Found TOTAL row in Planificacion:", totalRow);
    }
  } else {
    console.log("Sheet Planificacion not found!");
  }
} catch (e) {
  console.error("Error inspecting:", e);
}
