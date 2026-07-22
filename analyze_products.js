const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";
const workbook = XLSX.read(fs.readFileSync(resolvedPath), { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const matchingEspecialidades = [];
const otherProducts = [];

rows.forEach(row => {
  const desc = (row["Descripción Producto"] || "").toUpperCase();
  const code = (row["Código Producto"] || "");
  const total = row["TOTAL"];
  
  if (desc.includes("ESPECIAL") || desc.includes("ESP.")) {
    matchingEspecialidades.push({ code, desc, total });
  } else {
    otherProducts.push({ code, desc, total });
  }
});

console.log("Found matching 'ESPECIAL' or 'ESP.' count:", matchingEspecialidades.length);
if (matchingEspecialidades.length > 0) {
  console.log(JSON.stringify(matchingEspecialidades.slice(0, 10), null, 2));
}

console.log("Total products:", rows.length);
console.log("Sample of other products (first 30):");
otherProducts.slice(0, 30).forEach(p => {
  console.log(`- [${p.code}] (${p.total}) ${p.desc}`);
});
