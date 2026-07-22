const XLSX = require('./xlsx.js');
const fs = require('fs');

const path = "C:\\Users\\JDURAN1\\Downloads\\PLANIFICACION 22 DE JUNIO DEL 2026.xlsx";
try {
  const fileBuffer = fs.readFileSync(path);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes("planificac")) || workbook.SheetNames[0];
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
  
  if (headerRowIndex !== -1) {
    const headers = rowsRaw[headerRowIndex].map(h => String(h).trim().toUpperCase());
    const dataRows = rowsRaw.slice(headerRowIndex + 1);
    
    let currentLine = "";
    const parsedRows = [];
    
    dataRows.forEach((row, i) => {
      const firstCell = row[0] !== undefined ? String(row[0]).trim() : "";
      const upperFirst = firstCell.toUpperCase();
      
      // Check if this row changes the current line section
      if (upperFirst.includes("FERPAGRO")) {
        currentLine = "Ferpagro";
      } else if (upperFirst.includes("DOYLE 1")) {
        currentLine = "Doyle 1";
      } else if (upperFirst.includes("DOYLE 2")) {
        currentLine = "Doyle 2";
      } else if (upperFirst.includes("SACKETT") || upperFirst.includes("SACKEETT")) {
        currentLine = "Sackeett";
      } else if (upperFirst.includes("NACIONAL")) {
        currentLine = "Nacional";
      }
      
      // If it's a data row, parse it
      const obj = {};
      headers.forEach((header, colIdx) => {
        if (header) {
          obj[header] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : "";
        }
      });
      obj["LINEA_SECTION"] = currentLine;
      parsedRows.push(obj);
    });
    
    const validRows = parsedRows.filter(obj => {
      const prod = obj["PRODUCTO"] || "";
      const desc = obj["DESCRIP PRODUCTO"] || obj["DESCRIPCION"] || "";
      if (!prod || prod.toUpperCase() === "PRODUCTO" || prod.toUpperCase() === "TOTAL") return false;
      if (!desc && prod.includes("(")) return false;
      return true;
    });
    
    console.log(`Parsed ${validRows.length} valid rows with sections:`);
    // Count rows by line
    const counts = {};
    validRows.forEach(r => {
      counts[r.LINEA_SECTION] = (counts[r.LINEA_SECTION] || 0) + 1;
    });
    console.log("Counts per line:", counts);
    
    // Print first 3 rows of each line
    const printedLines = new Set();
    validRows.forEach(r => {
      const key = r.LINEA_SECTION;
      if (!printedLines.has(key)) {
        console.log(`\n--- SAMPLE FOR LINE ${key} ---`);
        const matches = validRows.filter(x => x.LINEA_SECTION === key).slice(0, 3);
        console.log(JSON.stringify(matches, null, 2));
        printedLines.add(key);
      }
    });
  }
} catch (e) {
  console.error(e);
}
