const XLSX = require('./xlsx.js');
const fs = require('fs');

const resolvedPath = "C:\\Users\\JDURAN1\\Desktop\\Proyecto Sacos Vacíos\\SALDOS SACOS VACIOS.xlsx";
const workbook = XLSX.read(fs.readFileSync(resolvedPath), { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const transitItems = [];

rows.forEach((row, idx) => {
  const code = row["Código Producto"];
  const desc = row["Descripción Producto"];
  const sacoplast = row["Transito Sacoplast"];
  const interama = row["Transito Interama"];
  const plasticsack = row["Transito Plasticsack"];
  const reysac = row["Transito Reysac"];

  if (sacoplast || interama || plasticsack || reysac) {
    transitItems.push({
      index: idx + 1,
      code,
      desc,
      sacoplast,
      interama,
      plasticsack,
      reysac
    });
  }
});

console.log(`Found ${transitItems.length} items with transit values.`);
console.log(JSON.stringify(transitItems.slice(0, 10), null, 2));
