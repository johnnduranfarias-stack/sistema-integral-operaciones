const XLSX = require('./xlsx.js');
const fs = require('fs');

const path = "C:\\Users\\JDURAN1\\Downloads\\PLANIFICACION 22 DE JUNIO DEL 2026.xlsx";
try {
  const fileBuffer = fs.readFileSync(path);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes("planificac")) || workbook.SheetNames[0];
  console.log("Selected sheet name:", sheetName);
  
  const sheet = workbook.Sheets[sheetName];
  const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
  let headerRowIndex = -1;
  for (let i = 0; i < rowsRaw.length; i++) {
    const row = rowsRaw[i];
    const hasProducto = row.some(cell => String(cell).trim().toLowerCase() === "producto");
    const hasDescrip = row.some(cell => String(cell).trim().toLowerCase().includes("descrip"));
    if (hasProducto && hasDescrip) {
      headerRowIndex = i;
      break;
    }
  }
  
  console.log("Header row index:", headerRowIndex);
  if (headerRowIndex !== -1) {
    const headers = rowsRaw[headerRowIndex].map(h => String(h).trim().toUpperCase());
    console.log("Cleaned headers:", headers);
    
    const dataRows = rowsRaw.slice(headerRowIndex + 1);
    const parsedObjects = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, colIdx) => {
        if (header) {
          obj[header] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : "";
        }
      });
      return obj;
    });
    
    console.log(`Parsed ${parsedObjects.length} objects.`);
    console.log("Sample parsed rows (first 5):");
    console.log(JSON.stringify(parsedObjects.slice(0, 5), null, 2));
    
    // Filter logic: ignore rows where PRODUCTO is empty, or equals "TOTAL", or equals header names,
    // or is a header line divider (like "FERPAGRO(8) 3926" where description is empty)
    const validRows = parsedObjects.filter(obj => {
      const prod = obj["PRODUCTO"] || "";
      const desc = obj["DESCRIP PRODUCTO"] || obj["DESCRIPCION"] || "";
      if (!prod || prod.toUpperCase() === "PRODUCTO" || prod.toUpperCase() === "TOTAL") return false;
      // If it looks like a divider row
      if (!desc && prod.includes("(")) return false;
      return true;
    });
    
    console.log(`Filtered down to ${validRows.length} valid rows.`);
    console.log("Sample valid rows (first 5):");
    console.log(JSON.stringify(validRows.slice(0, 5), null, 2));
  }
} catch (e) {
  console.error("Error:", e);
}
