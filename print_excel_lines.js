const XLSX = require('./xlsx.js');
const fs = require('fs');

const path = "C:\\Users\\JDURAN1\\Downloads\\PLANIFICACION 22 DE JUNIO DEL 2026.xlsx";
try {
  const fileBuffer = fs.readFileSync(path);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes("planificac")) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
  for (let i = 0; i < rowsRaw.length; i++) {
    const row = rowsRaw[i];
    // Print rows where the first column has something but others are mostly empty, or it looks like a line divider
    const firstCell = String(row[0]).trim();
    const otherCellsFilled = row.slice(1).filter(cell => String(cell).trim() !== "").length;
    
    if (firstCell !== "" && otherCellsFilled === 0) {
      console.log(`Row ${i} (Single Cell): "${firstCell}"`);
    } else if (firstCell.includes("(") || firstCell.includes(")") || firstCell.toUpperCase().includes("LÍNEA") || firstCell.toUpperCase().includes("LINEA")) {
      console.log(`Row ${i} (Suspect):`, row.slice(0, 5));
    }
  }
} catch (e) {
  console.error("Error:", e);
}
