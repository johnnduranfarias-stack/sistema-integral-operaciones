const XLSX = require('./xlsx.js');
const path = require('path');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Downloads\\Hoja de Reportes de Produccion NUEVO (1).xlsx";

console.log("File exists:", fs.existsSync(resolvedPath));

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  console.log("Successfully read file into buffer. Buffer length:", fileBuffer.length);
  
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log("Sheet names:", workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    console.log(`\nSheet "${sheetName}" has ${rows.length} rows.`);
    console.log("First 10 rows:");
    rows.slice(0, 20).forEach((row, i) => {
      console.log(`Row ${i}:`, row.slice(0, 15));
    });
  });
} catch (e) {
  console.error("Error reading file:", e);
}
