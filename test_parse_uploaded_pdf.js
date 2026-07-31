const fs = require('fs');
const path = require('path');

// Mock PDFParse class require as in server.js
const { PDFParse } = require('pdf-parse');

async function parseImportsPDF(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  await parser.load();
  
  const textBlocks = [];
  const numPages = parser.doc.numPages;
  
  for (let pageIdx = 1; pageIdx <= numPages; pageIdx++) {
    const page = await parser.doc.getPage(pageIdx);
    const textContent = await page.getTextContent();
    
    textContent.items.forEach(item => {
      if (!item.str || !item.str.trim()) return;
      textBlocks.push({
        page: pageIdx,
        x: item.transform[4],
        y: item.transform[5],
        text: item.str
      });
    });
  }

  const rowsMap = {};
  textBlocks.forEach(block => {
    const text = block.text.trim();
    if (text.includes('Formato de Reporte') || text.includes('2.4.1.FP') || text.includes('Actualizado al:') || text === 'Código' || text === 'Versión' || text === 'Fecha') return;
    
    const roundedY = Math.round(block.y);
    let matchedKey = null;
    
    const keys = Object.keys(rowsMap).filter(k => k.startsWith(`${block.page}_`));
    for (const key of keys) {
      const keyY = parseInt(key.split('_')[1]);
      if (Math.abs(keyY - block.y) <= 4.0) {
        matchedKey = key;
        break;
      }
    }
    
    const key = matchedKey || `${block.page}_${roundedY}`;
    if (!rowsMap[key]) {
      rowsMap[key] = [];
    }
    rowsMap[key].push(block);
  });

  const keys = Object.keys(rowsMap);
  const rowsList = [];
  keys.forEach(key => {
    rowsList.push({ key, blocks: rowsMap[key] });
  });

  rowsList.sort((a, b) => {
    const partsA = a.key.split('_').map(Number);
    const partsB = b.key.split('_').map(Number);
    if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
    return partsB[1] - partsA[1];
  });

  const columnsRanges = [
    { index: 0, name: 'oc', minX: 10, maxX: 30 },
    { index: 1, name: 'date', minX: 31, maxX: 55 },
    { index: 2, name: 'provider', minX: 56, maxX: 120 },
    { index: 3, name: 'product', minX: 121, maxX: 210 },
    { index: 4, name: 'quantity', minX: 211, maxX: 235 },
    { index: 5, name: 'unit', minX: 236, maxX: 255 },
    { index: 6, name: 'packing', minX: 256, maxX: 280 },
    { index: 7, name: 'instructions', minX: 281, maxX: 315 },
    { index: 8, name: 'etd', minX: 316, maxX: 350 },
    { index: 9, name: 'eta', minX: 351, maxX: 395 },
    { index: 10, name: 'shipline', minX: 396, maxX: 435 },
    { index: 11, name: 'vessel', minX: 436, maxX: 500 },
    { index: 12, name: 'containers', minX: 501, maxX: 530 },
    { index: 13, name: 'warehouse', minX: 531, maxX: 565 },
    { index: 14, name: 'status', minX: 566, maxX: 615 },
    { index: 15, name: 'bl', minX: 616, maxX: 690 },
    { index: 16, name: 'delivery', minX: 691, maxX: 800 }
  ];

  const rawRows = [];

  rowsList.forEach(row => {
    const rowData = Array(17).fill('');
    
    row.blocks.forEach(block => {
      const col = columnsRanges.find(r => block.x >= r.minX && block.x <= r.maxX);
      if (col) {
        if (rowData[col.index]) {
          rowData[col.index] += ' ' + block.text.trim();
        } else {
          rowData[col.index] = block.text.trim();
        }
      }
    });
    
    const cleanData = rowData.map(val => {
      if (!val) return '';
      return val
        .replace(/\\363/g, 'ó')
        .replace(/\\355/g, 'í')
        .replace(/\\341/g, 'á')
        .replace(/\\351/g, 'é')
        .replace(/\\372/g, 'ú')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .trim();
    });
    
    const cleanOC = cleanData[0].toUpperCase();
    const cleanProd = cleanData[3].toUpperCase();
    
    if (cleanOC.includes('ORDEN') || cleanOC.includes('COMPRA') || cleanOC.includes('FECHA') || cleanOC.includes('PROVEEDOR') || cleanProd.includes('PRODUCTO')) return;
    
    if (cleanData[0] !== '' || cleanData[3] !== '') {
      rawRows.push({
        oc: cleanData[0],
        date: cleanData[1],
        provider: cleanData[2],
        product: cleanData[3],
        quantity: parseFloat(cleanData[4].replace(/,/g, '')) || 0,
        unit: cleanData[5],
        packing: cleanData[6],
        instructions: cleanData[7],
        etd: cleanData[8],
        eta: cleanData[9],
        shipline: cleanData[10],
        vessel: cleanData[11],
        containers: cleanData[12],
        warehouse: cleanData[13],
        status: cleanData[14],
        bl: cleanData[15],
        delivery: cleanData[16]
      });
    }
  });

  const consolidatedRows = [];
  let pendingRow = null;

  rawRows.forEach(row => {
    if (row.oc && !row.product) {
      if (pendingRow) {
        consolidatedRows.push(pendingRow);
      }
      pendingRow = row;
    } else if (!row.oc && row.product) {
      if (pendingRow && !pendingRow.product) {
        pendingRow.product = row.product;
        pendingRow.quantity = row.quantity;
        pendingRow.unit = row.unit;
        pendingRow.packing = row.packing;
        pendingRow.instructions = row.instructions;
        pendingRow.etd = row.etd;
        pendingRow.eta = row.eta;
        pendingRow.shipline = row.shipline;
        pendingRow.vessel = row.vessel;
        pendingRow.containers = row.containers;
        pendingRow.warehouse = row.warehouse;
        pendingRow.status = row.status;
        pendingRow.bl = row.bl;
        pendingRow.delivery = row.delivery;
        consolidatedRows.push(pendingRow);
        pendingRow = null;
      } else {
        if (pendingRow) {
          consolidatedRows.push(pendingRow);
          pendingRow = null;
        }
        consolidatedRows.push(row);
      }
    } else {
      if (pendingRow) {
        consolidatedRows.push(pendingRow);
        pendingRow = null;
      }
      consolidatedRows.push(row);
    }
  });

  if (pendingRow) {
    consolidatedRows.push(pendingRow);
  }

  return consolidatedRows;
}

async function runTest() {
  const filePath = path.join(__dirname, 'backups', 'status_importaciones_2026-07-14T16-16-51-560Z.pdf');
  const buffer = fs.readFileSync(filePath);
  console.log(`Parsing ${filePath} of size ${buffer.length}...`);
  try {
    const rows = await parseImportsPDF(buffer);
    console.log(`SUCCESS! Parsed ${rows.length} rows.`);
    console.log(`First row sample:`, rows[0]);
  } catch (err) {
    console.error(`ERROR PARSING PDF:`, err);
  }
}

runTest();
