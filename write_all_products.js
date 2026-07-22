const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";
const workbook = XLSX.read(fs.readFileSync(resolvedPath), { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

let out = "";
rows.forEach((row, idx) => {
  out += `${idx + 1}. Code: ${row["Código Producto"]} | Total: ${row["TOTAL"]} | Desc: ${row["Descripción Producto"]}\n`;
});

fs.writeFileSync("all_products.txt", out);
console.log("Wrote all products to all_products.txt");
