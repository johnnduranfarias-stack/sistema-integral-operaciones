const fs = require('fs');

function generateSimplePDF(title, content) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  // Object 1: Catalog
  doc.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  
  // Object 2: Pages
  doc.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  
  // Object 3: Page 1
  doc.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj"); // Letter size: 612x792 pt
  
  // Object 4: Resources (Fonts)
  doc.push("4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj");
  
  // Object 5: Content stream
  const textLines = content.split('\n');
  let stream = "BT\n/F1 16 Tf\n50 720 Td\n18 TL\n";
  stream += `(${title}) Tj T*\n`;
  stream += "/F2 10 Tf\n12 TL\n"; // Switch to normal font and smaller leading
  textLines.forEach(line => {
    // Escape parentheses and backslashes
    const escapedLine = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
    stream += `(${escapedLine}) Tj T*\n`;
  });
  stream += "ET";
  
  doc.push(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  
  // Trailer
  doc.push("xref\n0 6\n0000000000 65535 f\n");
  doc.push("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n310\n%%EOF");
  
  return Buffer.from(doc.join('\n'), 'utf8');
}

const title = "FERPACIFIC - REPORTE DE ALERTAS CRITICAS";
const content = `Estimado Johnny, en muy poco tiempo te podrias quedar sin estos sacos si no los solicitas ahora.

Detalle de productos criticos:
- 12.01.01.1088.01 | SACO VACIO LAMINADO SULFATO DE AMONIO (Fisico: 29,186 ud, Sugerido: 101,537 ud)
  Observacion IA: Deficit proyectado de 101,537 sacos a 3 meses.
- 12.01.01.1047.01 | SACO UREA PRILADA (Fisico: 22,285 ud, Sugerido: 0 ud)
  Observacion IA: Cobertura con transito.`;

const pdfBuffer = generateSimplePDF(title, content);
fs.writeFileSync('C:\\Users\\JDURAN1\\.gemini\\antigravity\\scratch\\sacos-vacios-app\\test_output.pdf', pdfBuffer);
console.log("PDF generado en test_output.pdf");
