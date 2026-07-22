const XLSX = require('./xlsx.js');
const path = require('path');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";

console.log("File exists:", fs.existsSync(resolvedPath));

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  console.log("Successfully read file into buffer. Buffer length:", fileBuffer.length);
  
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  console.log("Sheet names:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert sheet to JSON array
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  console.log(`Total rows in sheet "${sheetName}":`, rows.length);
  
  console.log("First 15 rows:");
  console.log(JSON.stringify(rows.slice(0, 15), null, 2));
} catch (e) {
  console.error("Error reading file:", e);
}
