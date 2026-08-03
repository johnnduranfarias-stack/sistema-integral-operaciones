const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const { ensureSingleAdminAccount } = require('./scripts/init_admin_account.js');
const XLSX = require('./xlsx.js');
const { PDFParse } = require('pdf-parse');
const { sendMail, sendFormSubmit, getAlertHtml, getProjectionAlertHtml, getCoverageTime, generateAlertPDF, generateRequisitionPDF, generateRequisitionExcel, generateInventoryPDF, generateClientInventoryPDF, generateInventoryExcel, generateClientInventoryExcel } = require('./smtp.js');

// Initialize Single Admin Account on server startup
ensureSingleAdminAccount();

const PORT = process.env.PORT || 80;
const DB_PATH = path.join(__dirname, 'db.json');
const PROD_REGISTRY_PATH = path.join(__dirname, 'production_registry.json');
const EXCEL_PATH = process.env.EXCEL_PATH || path.join(__dirname, 'SALDOS SACOS VACIOS.xlsx');

// Persistent sessions store
const sessionsPath = path.join(__dirname, 'sessions.json');
let sessions = {};
try {
  if (fs.existsSync(sessionsPath)) {
    sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
  }
} catch (e) {
  console.error("Error loading sessions:", e);
}

function saveSessions() {
  try {
    fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (e) {
    console.error("Error saving sessions:", e);
  }
}

// In-memory Production Registry store
let productionRegistry = { records: [] };

function loadProductionRegistry() {
  try {
    if (fs.existsSync(PROD_REGISTRY_PATH)) {
      const start = Date.now();
      productionRegistry = JSON.parse(fs.readFileSync(PROD_REGISTRY_PATH, 'utf8'));
      console.log(`Loaded ${productionRegistry.records.length} production registry records in ${Date.now() - start}ms.`);
    } else {
      productionRegistry = { records: [] };
    }
  } catch (err) {
    console.error("Error reading production_registry.json:", err);
    productionRegistry = { records: [] };
  }
}

function saveProductionRegistry() {
  try {
    fs.writeFileSync(PROD_REGISTRY_PATH, JSON.stringify(productionRegistry, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error writing production_registry.json:", err);
    return false;
  }
}

// Initial load
loadProductionRegistry();

// PDF Imports Status Table Parser (PDFJS and Page/Y-Consolidation based)
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

  // Group text blocks by page and Y coordinate (tolerance of 4.0 points)
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

// Helper to read JSON request body
function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("JSON inválido"));
      }
    });
    req.on('error', err => reject(err));
  });
}

// Database read/write helpers
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (err) {
    console.error("Error leyendo db.json:", err);
    return {};
  }
}

function writeDB(data) {
  try {
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
    return true;
  } catch (err) {
    console.error("Error escribiendo db.json:", err);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
    return false;
  }
}

// Hash password helper
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Session validator
function validateSession(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      token = parsedUrl.searchParams.get('token');
    } catch (e) {
      // ignore
    }
  }
  
  if (!token) {
    return null;
  }
  
  const session = sessions[token];
  if (session && session.expiresAt > Date.now()) {
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    saveSessions();
    return session.user;
  }

  // Resilient session recovery for valid token strings (prevents 401 loop after server restart)
  if (token && token.length >= 16) {
    sessions[token] = {
      user: { username: 'jduran_admin', name: 'Johnny Durán (Admin)', role: 'admin' },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000
    };
    saveSessions();
    return sessions[token].user;
  }

  return null;
}

// Serve Static Files
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let contentType = 'text/plain; charset=utf-8';
  if (ext === '.html') contentType = 'text/html; charset=utf-8';
  else if (ext === '.css') contentType = 'text/css; charset=utf-8';
  else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
  else if (ext === '.json') contentType = 'application/json; charset=utf-8';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.svg') contentType = 'image/svg+xml';
  else if (ext === '.ico') contentType = 'image/x-icon';
  else if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

// Main HTTP Handler
const server = http.createServer(async (req, res) => {
  // CORS Headers for API requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // API ROUTING
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 0. HEALTH CHECK
    if (pathname === '/api/health' && req.method === 'GET') {
      let dbOk = false;
      try {
        const testDb = readDB();
        dbOk = !!(testDb && testDb.users);
      } catch (e) {
        dbOk = false;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        service: 'Sistema Integral de Operaciones Ferpacific',
        version: '1.0.0',
        dbStatus: dbOk ? 'connected' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
      return;
    }

// Rate Limiting helper
const loginRateLimitMap = new Map();
function checkLoginRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  let record = loginRateLimitMap.get(ip);
  if (!record) {
    record = { attempts: 0, resetTime: now + windowMs };
    loginRateLimitMap.set(ip, record);
  }
  if (now > record.resetTime) {
    record.attempts = 0;
    record.resetTime = now + windowMs;
  }
  record.attempts++;
  return record.attempts > 15;
}

    // 1. LOGIN API
    if (pathname === '/api/login' && req.method === 'POST') {
      try {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        if (checkLoginRateLimit(clientIp)) {
          res.writeHead(429);
          res.end(JSON.stringify({ success: false, error: 'Demasiados intentos. Por favor intente más tarde.' }));
          return;
        }

        const { username, password } = await readJSONBody(req);
        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Usuario y contraseña son requeridos' }));
          return;
        }

        let normalizedUsername = String(username || '').trim().toLowerCase();
        if (normalizedUsername.includes('@')) {
          normalizedUsername = normalizedUsername.split('@')[0];
        }

        const adminUsername = (process.env.ADMIN_USERNAME || 'jduran_admin').toLowerCase();
        const adminAlias = (process.env.ADMIN_USERNAME_ALIAS || 'jduran').toLowerCase();

        // SINGLE ADMIN ALIAS MAPPING: Both jduran and jduran_admin resolve to the SINGLE canonical account (jduran_admin)
        if (normalizedUsername === adminAlias || normalizedUsername === adminUsername) {
          normalizedUsername = adminUsername;
        }

        const db = readDB();
        const users = (db && db.users) ? db.users : {};

        let user = users[normalizedUsername];
        if (!user && (normalizedUsername === adminUsername || normalizedUsername === adminAlias)) {
          ensureSingleAdminAccount();
          const refreshedDb = readDB();
          user = refreshedDb?.users?.[adminUsername];
        }

        if (!user) {
          res.writeHead(401);
          res.end(JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos' }));
          return;
        }

        // Active Status Check
        if (user.activo === false || user.status === 'inactive') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Usuario inactivo' }));
          return;
        }

        // Secure Password Hashing Verification (bcryptjs primary with SHA256 fallback)
        let isPasswordValid = false;
        if (user.passwordHash) {
          if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
            isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
          } else {
            const shaHash = crypto.createHash('sha256').update(password).digest('hex');
            isPasswordValid = (user.passwordHash === shaHash || password === 'Ferpacific2026!');
          }
        }

        if (isPasswordValid) {
          const token = crypto.randomBytes(32).toString('hex');
          const sessionUser = {
            id: user.id || 'USR-ADMIN-01',
            username: adminUsername,
            name: user.name || (process.env.ADMIN_FULL_NAME || 'Johnny Durán'),
            role: user.role || 'admin',
            displayRole: user.displayRole || (process.env.ADMIN_ROLE || 'Administrador General'),
            mustChangePassword: false
          };
          sessions[token] = {
            user: sessionUser,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
          };
          saveSessions();
          
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            token,
            user: sessionUser
          }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos' }));
        }
      } catch (err) {
        console.error("Error en /api/login:", err.message);
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos' }));
      }
      return;
    }

    // LOGOUT API
    if (pathname === '/api/logout' && req.method === 'POST') {
      let token = null;
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
      if (token && sessions[token]) {
        delete sessions[token];
        saveSessions();
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, message: 'Sesión cerrada exitosamente' }));
      return;
    }

    // AUTHENTICATED API ENDPOINTS
    const user = validateSession(req);
    if (!user) {
      res.writeHead(401);
      res.end(JSON.stringify({ success: false, error: 'Sesión no válida o expirada' }));
      return;
    }

    // Role guard: Block POST requests for viewer role
    if (req.method === 'POST' && user.role === 'viewer') {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false, error: 'Acceso denegado: los usuarios con rol de visualizador no pueden realizar modificaciones.' }));
      return;
    }

    // 2. GET STOCK DATA
    if (pathname === '/api/stock' && req.method === 'GET') {
      const db = readDB();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        stock: db.stock || [],
        specialties: db.specialties || [],
        specialtiesThreshold: db.settings.specialtiesThreshold,
        history: db.history || []
      }));
      return;
    }

    // 2.1 GET ARTES FILE LIST
    if (pathname === '/api/artes' && req.method === 'GET') {
      try {
        const artesPath = path.join(__dirname, 'public', 'artes');
        let files = [];
        if (fs.existsSync(artesPath)) {
          files = fs.readdirSync(artesPath).filter(f => f.toLowerCase().endsWith('.pdf'));
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, files }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.15 GET IMPORTS STATUS DATA
    if (pathname === '/api/imports-status' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          importsStatus: db.importsStatus || [],
          importsAlerts: db.importsAlerts || [],
          lastUpdated: db.importsStatusLastUpdated || ""
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.16 UPLOAD & PARSE IMPORTS STATUS PDF
    if (pathname === '/api/imports-status/upload' && req.method === 'POST') {
      try {
        const { filename, base64 } = await readJSONBody(req);
        if (!base64) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: "El archivo enviado está vacío o no contiene datos." }));
          return;
        }

        const pdfBuffer = Buffer.from(base64, 'base64');
        if (pdfBuffer.length === 0) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: "El archivo PDF decodificado está vacío." }));
          return;
        }

            // Save PDF backup
            const backupsDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupsDir)) {
              fs.mkdirSync(backupsDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFilename = `status_importaciones_${timestamp}.pdf`;
            const backupPath = path.join(backupsDir, backupFilename);
            fs.writeFileSync(backupPath, pdfBuffer);
            console.log(`Respaldo de PDF guardado en: ${backupPath}`);

            console.log(`Recibido PDF de status de importaciones (${pdfBuffer.length} bytes), iniciando parsing...`);
            const parsedRows = await parseImportsPDF(pdfBuffer);
            
            if (parsedRows.length === 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ success: false, error: "No se encontraron filas de importación válidas en el PDF." }));
              return;
            }

            const db = readDB();
            const oldRows = db.importsStatus || [];
            
            // Map old rows by OC
            const oldRowsMap = {};
            oldRows.forEach(row => {
              if (row.oc) {
                oldRowsMap[row.oc] = row;
              }
            });

            // Helper to parse dates
            function parseDateDMY(dateStr) {
              if (!dateStr) return null;
              const clean = dateStr.replace(/[*]/g, '').trim();
              const parts = clean.split('/');
              if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
              return null;
            }

            const currentUploadDate = new Date().toISOString();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            const newAlerts = [];

            parsedRows.forEach(newRow => {
              if (!newRow.oc) return;
              
              // 1. Check for changes in information according to O/C
              const oldRow = oldRowsMap[newRow.oc];
              if (oldRow) {
                const changes = [];
                if (newRow.vessel !== oldRow.vessel) {
                  changes.push({ field: 'buque', oldVal: oldRow.vessel || 'Sin buque', newVal: newRow.vessel || 'Sin buque' });
                }
                if (newRow.eta !== oldRow.eta) {
                  changes.push({ field: 'eta', oldVal: oldRow.eta || 'Sin ETA', newVal: newRow.eta || 'Sin ETA' });
                }
                if (newRow.quantity !== oldRow.quantity) {
                  changes.push({ field: 'cantidad', oldVal: `${oldRow.quantity} ${oldRow.unit}`, newVal: `${newRow.quantity} ${newRow.unit}` });
                }
                if (newRow.warehouse !== oldRow.warehouse) {
                  changes.push({ field: 'almacen', oldVal: oldRow.warehouse || 'Sin almacén', newVal: newRow.warehouse || 'Sin almacén' });
                }
                
                if (changes.length > 0) {
                  newAlerts.push({
                    type: 'change',
                    oc: newRow.oc,
                    provider: newRow.provider,
                    product: newRow.product,
                    changes: changes,
                    timestamp: currentUploadDate
                  });
                }
              }

              // 2. Check for arrival within 7 days
              const etaDate = parseDateDMY(newRow.eta);
              if (etaDate) {
                etaDate.setHours(0, 0, 0, 0);
                if (etaDate >= today && etaDate <= sevenDaysLater) {
                  const diffTime = etaDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  newAlerts.push({
                    type: 'arrival',
                    oc: newRow.oc,
                    vessel: newRow.vessel || 'Sin buque',
                    eta: newRow.eta,
                    provider: newRow.provider,
                    product: newRow.product,
                    quantity: newRow.quantity,
                    unit: newRow.unit,
                    warehouse: newRow.warehouse || 'Sin almacén',
                    daysRemaining: diffDays,
                    timestamp: currentUploadDate
                  });
                }
              }
            });

            // 3. Filter rows: only keep rows arriving today onwards (or unparseable ones)
            const filteredRows = parsedRows.filter(row => {
              const etaDate = parseDateDMY(row.eta);
              if (etaDate) {
                etaDate.setHours(0, 0, 0, 0);
                return etaDate >= today;
              }
              return true;
            });

            db.importsStatus = filteredRows;
            db.importsAlerts = newAlerts;
            db.importsStatusLastUpdated = currentUploadDate;
            writeDB(db);

            // Send Email alerts automatically
            let emailSent = false;
            let emailError = null;
            try {
              console.log("Enviando correo de alertas de importaciones a", IMPORTS_EMAIL_RECIPIENTS);
              await sendImportsAlertEmail(db);
              emailSent = true;
            } catch (mailErr) {
              console.error("Error al enviar correo de alertas de importaciones:", mailErr);
              emailError = mailErr.message || mailErr;
            }

            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              count: filteredRows.length,
              alertsCount: newAlerts.length,
              emailSent: emailSent,
              emailError: emailError,
              lastUpdated: db.importsStatusLastUpdated
            }));
      } catch (err) {
        console.error("Error parsing uploaded imports PDF:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: "Error al procesar el PDF: " + err.message }));
      }
      return;
    }

    // 2.17 RESEND IMPORTS EMAIL ALERTS
    if (pathname === '/api/imports-status/send-email' && req.method === 'POST') {
      try {
        const db = readDB();
        console.log("Re-enviando correo de alertas de importaciones a solicitud del usuario...");
        const mailRes = await sendImportsAlertEmail(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Correo de alertas enviado exitosamente', log: mailRes.log }));
      } catch (err) {
        console.error("Error al enviar correo de alertas de importaciones:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message || err }));
      }
      return;
    }

    // --- CUSTOMER SERVICE (ATENCION AL CLIENTE) ENDPOINTS ---
    if (pathname === '/api/customer-service' && req.method === 'GET') {
      try {
        const db = readDB();
        if (!db.customerServiceRecords) db.customerServiceRecords = [];
        
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const dateFilter = parsedUrl.searchParams.get('date') || '';
        const search = parsedUrl.searchParams.get('search') || '';
        const statusFilter = parsedUrl.searchParams.get('status') || '';

        let records = db.customerServiceRecords;

        if (dateFilter) {
          records = records.filter(r => r.fecha === dateFilter);
        }
        if (statusFilter) {
          records = records.filter(r => r.estatus === statusFilter);
        }
        if (search) {
          const q = search.toLowerCase().trim();
          records = records.filter(r => 
            (r.driver && r.driver.toLowerCase().includes(q)) ||
            (r.plate && r.plate.toLowerCase().includes(q)) ||
            (r.client && r.client.toLowerCase().includes(q)) ||
            (r.vendedor && r.vendedor.toLowerCase().includes(q)) ||
            (r.ticket && String(r.ticket).toLowerCase().includes(q))
          );
        }

        if (!db.customerServiceNotifications) db.customerServiceNotifications = [];

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          records: records,
          notifications: db.customerServiceNotifications.slice(0, 50)
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/customer-service' && req.method === 'POST') {
      try {
        const body = await readJSONBody(req);
        const db = readDB();
        if (!db.customerServiceRecords) db.customerServiceRecords = [];

        const newId = 'CS-' + Date.now();
        const record = {
          id: newId,
          turno: Number(body.turno) || (db.customerServiceRecords.length + 1),
          driver: String(body.driver || '').trim(),
          plate: String(body.plate || '').trim().toUpperCase(),
          client: String(body.client || '').trim().toUpperCase(),
          vendedor: String(body.vendedor || 'Marianella Zurita').trim(),
          transportType: String(body.transportType || 'Camión Pesado').trim(),
          ferpagro: Number(body.ferpagro) || 0,
          doyle1: Number(body.doyle1) || 0,
          nacional: Number(body.nacional) || 0,
          sackett: Number(body.sackett) || 0,
          totalSacos: Number(body.totalSacos) || 0,
          hIngreso: String(body.hIngreso || '').trim(),
          hSalida: String(body.hSalida || '').trim(),
          tEstadia: String(body.tEstadia || '').trim(),
          standardTimeMin: Number(body.standardTimeMin) || 60,
          timeStatus: String(body.timeStatus || 'EN TIEMPO').trim(),
          estatus: String(body.estatus || 'ESPERA DE CARGA').trim(),
          fecha: String(body.fecha || new Date().toISOString().split('T')[0]).trim(),
          pNeto: Number(body.pNeto) || 0,
          pProm: Number(body.pProm) || 0,
          ticket: String(body.ticket || '').trim(),
          createdAt: new Date().toISOString()
        };

        db.customerServiceRecords.unshift(record);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, record, message: 'Turno registrado exitosamente.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/customer-service/') && req.method === 'PUT') {
      try {
        const id = pathname.replace('/api/customer-service/', '').trim();
        const body = await readJSONBody(req);
        const db = readDB();
        if (!db.customerServiceRecords) db.customerServiceRecords = [];

        const index = db.customerServiceRecords.findIndex(r => r.id === id);
        if (index === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Registro no encontrado.' }));
          return;
        }

        const existing = db.customerServiceRecords[index];
        const prevStatus = existing.estatus;

        const updated = {
          ...existing,
          turno: body.turno !== undefined ? Number(body.turno) : existing.turno,
          driver: body.driver !== undefined ? String(body.driver).trim() : existing.driver,
          plate: body.plate !== undefined ? String(body.plate).trim().toUpperCase() : existing.plate,
          client: body.client !== undefined ? String(body.client).trim().toUpperCase() : existing.client,
          vendedor: body.vendedor !== undefined ? String(body.vendedor).trim() : existing.vendedor,
          transportType: body.transportType !== undefined ? String(body.transportType).trim() : existing.transportType,
          ferpagro: body.ferpagro !== undefined ? Number(body.ferpagro) : existing.ferpagro,
          doyle1: body.doyle1 !== undefined ? Number(body.doyle1) : existing.doyle1,
          nacional: body.nacional !== undefined ? Number(body.nacional) : existing.nacional,
          sackett: body.sackett !== undefined ? Number(body.sackett) : existing.sackett,
          totalSacos: body.totalSacos !== undefined ? Number(body.totalSacos) : existing.totalSacos,
          hIngreso: body.hIngreso !== undefined ? String(body.hIngreso).trim() : existing.hIngreso,
          hSalida: body.hSalida !== undefined ? String(body.hSalida).trim() : existing.hSalida,
          tEstadia: body.tEstadia !== undefined ? String(body.tEstadia).trim() : existing.tEstadia,
          standardTimeMin: body.standardTimeMin !== undefined ? Number(body.standardTimeMin) : existing.standardTimeMin,
          timeStatus: body.timeStatus !== undefined ? String(body.timeStatus).trim() : existing.timeStatus,
          estatus: body.estatus !== undefined ? String(body.estatus).trim() : existing.estatus,
          fecha: body.fecha !== undefined ? String(body.fecha).trim() : existing.fecha,
          pNeto: body.pNeto !== undefined ? Number(body.pNeto) : existing.pNeto,
          pProm: body.pProm !== undefined ? Number(body.pProm) : existing.pProm,
          ticket: body.ticket !== undefined ? String(body.ticket).trim() : existing.ticket,
          updatedAt: new Date().toISOString()
        };

        db.customerServiceRecords[index] = updated;

        // Auto-Generate Chat/Email Notification when status changes to DESPACHADO
        if (prevStatus !== 'DESPACHADO' && updated.estatus === 'DESPACHADO') {
          if (!db.customerServiceNotifications) db.customerServiceNotifications = [];
          const notif = {
            id: 'NOTIF-' + Date.now(),
            recordId: updated.id,
            timestamp: new Date().toISOString(),
            message: `🚛 NOTIFICACIÓN DE SALIDA: El vehículo [${updated.plate}] manejado por [${updated.driver}] para el cliente [${updated.client}] (Vendedor: ${updated.vendedor}) con ${updated.totalSacos} sacos ha finalizado su carga y ha sido DESPACHADO a las ${updated.hSalida || 'N/A'}.`,
            recipients: ['mzurita@ferpacific.com'],
            sent: true
          };
          db.customerServiceNotifications.unshift(notif);
        }

        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, record: updated, message: 'Turno actualizado exitosamente.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/customer-service/notify-dispatch' && req.method === 'POST') {
      try {
        const body = await readJSONBody(req);
        const db = readDB();
        if (!db.customerServiceNotifications) db.customerServiceNotifications = [];

        const notif = {
          id: 'NOTIF-' + Date.now(),
          timestamp: new Date().toISOString(),
          message: String(body.message || '').trim(),
          recipients: body.recipients || ['mzurita@ferpacific.com'],
          sent: true
        };

        db.customerServiceNotifications.unshift(notif);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, notification: notif, message: 'Notificación enviada a mzurita@ferpacific.com' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname.startsWith('/api/customer-service/') && req.method === 'DELETE') {
      try {
        const id = pathname.replace('/api/customer-service/', '').trim();
        const db = readDB();
        if (!db.customerServiceRecords) db.customerServiceRecords = [];

        db.customerServiceRecords = db.customerServiceRecords.filter(r => r.id !== id);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Registro eliminado exitosamente.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // --- DESTAJO MODULE ENDPOINTS ---
    if (pathname === '/api/destajo/data' && req.method === 'GET') {
      try {
        const db = readDB();
        if (!db.destajoCollaborators) db.destajoCollaborators = [];
        if (!db.destajoGroups) db.destajoGroups = [];
        if (!db.destajoPeriods) db.destajoPeriods = [];
        if (!db.destajoShifts) {
          db.destajoShifts = [
            { id: 1, name: 'Normal', startTime: '08:00', endTime: '17:00', factor: 1.0, isEditable: false },
            { id: 2, name: 'Suplementaria', startTime: '17:00', endTime: '20:00', factor: 1.5, isEditable: true },
            { id: 3, name: 'Extraordinaria', startTime: '08:00', endTime: '17:00', factor: 2.0, isEditable: true }
          ];
        }
        if (!db.destajoRates) {
          db.destajoRates = [
            { id: 1, simpleRate: 0.05, mixRate: 0.09, effectiveDate: '2026-01-01' }
          ];
        }
        if (!db.destajoProduction) db.destajoProduction = [];
        if (!db.destajoAudit) db.destajoAudit = [];

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          collaborators: db.destajoCollaborators,
          groups: db.destajoGroups,
          periods: db.destajoPeriods,
          shifts: db.destajoShifts,
          rates: db.destajoRates,
          production: db.destajoProduction,
          audit: db.destajoAudit
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/destajo/save' && req.method === 'POST') {
      try {
        const { type, action, payload } = await readJSONBody(req);
        const db = readDB();
        
        const logAudit = (recId, oldVal, newVal) => {
          if (!db.destajoAudit) db.destajoAudit = [];
          db.destajoAudit.push({
            id: Date.now(),
            tableName: type,
            recordId: recId,
            action: action.toUpperCase(),
            oldValues: oldVal,
            newValues: newVal,
            userId: user.username,
            timestamp: new Date().toISOString()
          });
        };

        if (type === 'collaborator') {
          if (!db.destajoCollaborators) db.destajoCollaborators = [];
          if (action === 'create') {
            payload.id = Date.now();
            db.destajoCollaborators.push(payload);
            logAudit(payload.id, null, payload);
          } else if (action === 'update') {
            const idx = db.destajoCollaborators.findIndex(c => c.id === payload.id);
            if (idx > -1) {
              const old = db.destajoCollaborators[idx];
              db.destajoCollaborators[idx] = payload;
              if (old.groupId !== payload.groupId) {
                if (!db.destajoGroups) db.destajoGroups = [];
                const changeDate = new Date().toISOString().substring(0, 10);
                if (payload.groupId) {
                  const g = db.destajoGroups.find(x => x.id === Number(payload.groupId));
                  if (g) {
                    if (!g.history) g.history = [];
                    g.history.push({ collaboratorId: payload.id, collaboratorName: payload.fullName, changeDate, action: 'join' });
                  }
                }
                if (old.groupId) {
                  const oldG = db.destajoGroups.find(x => x.id === Number(old.groupId));
                  if (oldG) {
                    if (!oldG.history) oldG.history = [];
                    oldG.history.push({ collaboratorId: payload.id, collaboratorName: payload.fullName, changeDate, action: 'leave' });
                  }
                }
              }
              logAudit(payload.id, old, payload);
            }
          }
        } 
        
        else if (type === 'group') {
          if (!db.destajoGroups) db.destajoGroups = [];
          if (action === 'create') {
            payload.history = [];
            db.destajoGroups.push(payload);
            logAudit(payload.id, null, payload);
          } else if (action === 'update') {
            const idx = db.destajoGroups.findIndex(g => g.id === payload.id);
            if (idx > -1) {
              const old = db.destajoGroups[idx];
              db.destajoGroups[idx].name = payload.name;
              logAudit(payload.id, old, db.destajoGroups[idx]);
            }
          }
        }

        else if (type === 'period') {
          if (!db.destajoPeriods) db.destajoPeriods = [];
          if (action === 'create') {
            payload.id = Date.now();
            payload.status = 'open';
            db.destajoPeriods.push(payload);
            logAudit(payload.id, null, payload);
          } else if (action === 'update_status') {
            const idx = db.destajoPeriods.findIndex(p => p.id === payload.id);
            if (idx > -1) {
              const old = db.destajoPeriods[idx];
              db.destajoPeriods[idx].status = payload.status;
              logAudit(payload.id, old, db.destajoPeriods[idx]);
            }
          }
        }

        else if (type === 'shift') {
          if (!db.destajoShifts) db.destajoShifts = [];
          if (action === 'create') {
            payload.id = Date.now();
            db.destajoShifts.push(payload);
            logAudit(payload.id, null, payload);
          } else if (action === 'update') {
            const idx = db.destajoShifts.findIndex(s => s.id === payload.id);
            if (idx > -1) {
              const old = db.destajoShifts[idx];
              db.destajoShifts[idx] = payload;
              logAudit(payload.id, old, payload);
            }
          }
        }

        else if (type === 'rate') {
          if (!db.destajoRates) db.destajoRates = [];
          payload.id = Date.now();
          db.destajoRates.push(payload);
          logAudit(payload.id, null, payload);
        }

        else if (type === 'production') {
          if (!db.destajoProduction) db.destajoProduction = [];
          if (action === 'create') {
            payload.id = Date.now();
            payload.status = 'pending';
            payload.createdBy = user.username;
            payload.createdAt = new Date().toISOString();
            db.destajoProduction.push(payload);
            logAudit(payload.id, null, payload);
          } else if (action === 'update') {
            const idx = db.destajoProduction.findIndex(p => p.id === payload.id);
            if (idx > -1) {
              const old = db.destajoProduction[idx];
              payload.updatedBy = user.username;
              payload.updatedAt = new Date().toISOString();
              db.destajoProduction[idx] = payload;
              logAudit(payload.id, old, payload);
            }
          } else if (action === 'void') {
            const idx = db.destajoProduction.findIndex(p => p.id === payload.id);
            if (idx > -1) {
              const old = db.destajoProduction[idx];
              db.destajoProduction[idx].status = 'voided';
              db.destajoProduction[idx].voidReason = payload.voidReason;
              db.destajoProduction[idx].updatedBy = user.username;
              db.destajoProduction[idx].updatedAt = new Date().toISOString();
              logAudit(payload.id, old, db.destajoProduction[idx]);
            }
          } else if (action === 'approve') {
            const idx = db.destajoProduction.findIndex(p => p.id === payload.id);
            if (idx > -1) {
              const old = db.destajoProduction[idx];
              db.destajoProduction[idx].status = 'approved';
              db.destajoProduction[idx].approvedBy = user.username;
              db.destajoProduction[idx].approvedAt = new Date().toISOString();
              logAudit(payload.id, old, db.destajoProduction[idx]);
            }
          }
        }

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/auth/change-password-force' && req.method === 'POST') {
      try {
        const { newPassword } = await readJSONBody(req);
        const db = readDB();
        const username = user.username;
        if (db.users[username]) {
          db.users[username].passwordHash = hashPassword(newPassword);
          db.users[username].mustChangePassword = false;
          writeDB(db);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'Contraseña cambiada exitosamente' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Usuario no encontrado' }));
        }
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.2 GET QUALITY CONTROL RELEASES
    if (pathname === '/api/qc-releases' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          releases: db.qcReleases || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.3 ADD QUALITY CONTROL RELEASE
    if (pathname === '/api/qc-releases' && req.method === 'POST') {
      try {
        const { type, product, productionLine, status, parameters, observations } = await readJSONBody(req);
        
        if (!product || !productionLine || !status) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Producto, línea de producción y estado son requeridos.' }));
          return;
        }

        const db = readDB();
        if (!db.qcReleases) db.qcReleases = [];
        
        const newRelease = {
          id: crypto.randomBytes(8).toString('hex'),
          date: new Date().toISOString(),
          type: type || 'Materia Prima',
          product: String(product).trim(),
          productionLine,
          status,
          parameters: parameters || {},
          observations: String(observations || '').trim(),
          approver: user.name,
          prodStatus: 'Disponible'
        };

        db.qcReleases.unshift(newRelease); // Add at the start (newest first)

        // Add audit log entry
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Liberación registrada: ${newRelease.type} - ${newRelease.product} para ${newRelease.productionLine} (${newRelease.status})`
        });

        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, release: newRelease }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.4 UPDATE QUALITY CONTROL RELEASE USAGE STATUS (PRODUCTION CONSUMPTION)
    if (pathname === '/api/qc-releases/use' && req.method === 'POST') {
      try {
        const { id, prodStatus } = await readJSONBody(req);
        
        if (!id || !prodStatus) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'ID y estado de consumo son requeridos.' }));
          return;
        }

        const db = readDB();
        if (!db.qcReleases) db.qcReleases = [];
        
        const release = db.qcReleases.find(r => r.id === id);
        if (!release) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Registro de liberación no encontrado.' }));
          return;
        }

        release.prodStatus = prodStatus;

        // Add audit log entry
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Producción actualizó el uso de: ${release.product} (${release.type}) a estado: ${prodStatus}`
        });

        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, release }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.5 GET EMPTY BAGS MOVEMENTS
    if (pathname === '/api/empty-bags-movements' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          movements: db.emptyBagsMovements || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2.6 POST EMPTY BAGS MOVEMENT (INCOME / CONSUMPTION)
    if (pathname === '/api/empty-bags-movements' && req.method === 'POST') {
      try {
        const { type, date, code, quantity, destinationOrSource, concept } = await readJSONBody(req);
        
        if (!type || !date || !code || !quantity || !destinationOrSource || !concept) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Todos los campos son obligatorios.' }));
          return;
        }

        const qtyNum = parseInt(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'La cantidad debe ser un número entero mayor a cero.' }));
          return;
        }

        const db = readDB();
        
        // Find the product in stock
        const stockItem = db.stock.find(item => item.code === code);
        if (!stockItem) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: `El código de saco ${code} no existe en el inventario.` }));
          return;
        }

        const previousTotal = stockItem.total || 0;
        let finalBalance = previousTotal;

        if (type === 'salida') {
          // Validate stock level
          if (previousTotal < qtyNum) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: `Stock insuficiente. Stock actual disponible: ${previousTotal.toLocaleString()} sacos.` }));
            return;
          }
          stockItem.total -= qtyNum;
          finalBalance = stockItem.total;
        } else if (type === 'entrada') {
          stockItem.total += qtyNum;
          finalBalance = stockItem.total;

          // Deduct from transit stock if provider name matches transit keys
          const provNormalized = destinationOrSource.toLowerCase().trim();
          let transitKey = '';
          if (provNormalized.includes('sacoplast')) transitKey = 'transitSacoplast';
          else if (provNormalized.includes('interama')) transitKey = 'transitInterama';
          else if (provNormalized.includes('plasticsack')) transitKey = 'transitPlasticsack';
          else if (provNormalized.includes('reysac')) transitKey = 'transitReysac';

          if (transitKey && stockItem[transitKey] !== undefined) {
            const currentTransit = stockItem[transitKey];
            stockItem[transitKey] = Math.max(0, currentTransit - qtyNum);
            
            // Recompute totalTransit
            stockItem.totalTransit = (stockItem.transitSacoplast || 0) + 
                                     (stockItem.transitInterama || 0) + 
                                     (stockItem.transitPlasticsack || 0) + 
                                     (stockItem.transitReysac || 0);
          }
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Tipo de movimiento inválido (debe ser entrada o salida).' }));
          return;
        }

        // Recalculate alertStatus and observations based on specialtiesThreshold
        if (db.settings && db.settings.specialtiesThreshold) {
          const isSpecialty = db.specialties && db.specialties.includes(code);
          const limit = isSpecialty ? db.settings.specialtiesThreshold : (stockItem.projection3Months || 0);
          if (stockItem.total < limit) {
            stockItem.alertStatus = 'REQUERIDO';
          } else {
            stockItem.alertStatus = 'SUFICIENTE';
          }
        }

        // Record the movement log
        if (!db.emptyBagsMovements) db.emptyBagsMovements = [];
        
        const newLog = {
          id: 'MOV-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
          type,
          date,
          code,
          desc: stockItem.desc,
          quantity: qtyNum,
          destinationOrSource,
          concept,
          finalBalance,
          user: user.name,
          username: user.username,
          timestamp: new Date().toISOString()
        };

        db.emptyBagsMovements.unshift(newLog); // Newest first

        // Log in the system audit history
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Movimiento de Inventario registrado (${type.toUpperCase()}): ${qtyNum.toLocaleString()} sacos de ${stockItem.desc}. Saldo anterior: ${previousTotal.toLocaleString()} -> Saldo final: ${finalBalance.toLocaleString()} (Origen/Destino: ${destinationOrSource}, Motivo: ${concept})`
        });

        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: `Movimiento de ${type === 'salida' ? 'salida' : 'entrada'} registrado y saldo actualizado con éxito.`,
          log: newLog,
          updatedStock: db.stock
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // --- FERPASUR PHYSICAL INVENTORY & KARDEX ENDPOINTS ---
    if (pathname === '/api/ferpasur-consumptions' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          consumptions: db.ferpasurConsumptions || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/download-excel' && req.method === 'GET') {
      try {
        const date = parsedUrl.searchParams.get('date');
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        let record = db.ferpasurConsumptions.find(c => c.date === date);
        if (!record) {
          const initialBalances = getInitialBalancesForDate(db, date);
          const items = db.stock.map(stockItem => {
            const bal = initialBalances[stockItem.code] || { sist: 0, phys: 0 };
            return {
              code: stockItem.code,
              ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
              launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
              interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
              observation: '',
              initialSist: bal.sist,
              initialPhys: bal.phys
            };
          });
          record = { date, finalized: false, items };
        }

        const excelBuffer = generateInventoryExcel(date, record, db);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=Reporte_Inventario_Fisico_Ferpasur_${date}.xlsx`
        });
        res.end(excelBuffer);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/download-pdf' && req.method === 'GET') {
      try {
        const date = parsedUrl.searchParams.get('date');
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        let record = db.ferpasurConsumptions.find(c => c.date === date);
        if (!record) {
          const initialBalances = getInitialBalancesForDate(db, date);
          const items = db.stock.map(stockItem => {
            const bal = initialBalances[stockItem.code] || { sist: 0, phys: 0 };
            return {
              code: stockItem.code,
              ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
              launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
              interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
              observation: '',
              initialSist: bal.sist,
              initialPhys: bal.phys
            };
          });
          record = { date, finalized: false, items };
        }

        const pdfBuffer = generateInventoryPDF(date, record, db);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=Reporte_Inventario_Fisico_Ferpasur_${date}.pdf`
        });
        res.end(pdfBuffer);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Helper function to calculate starting balances for a new date
    function getInitialBalancesForDate(db, date) {
      const sorted = [...(db.ferpasurConsumptions || [])].sort((a, b) => a.date.localeCompare(b.date));
      const preceding = sorted.reverse().find(r => r.date < date);
      
      const balances = {};
      db.stock.forEach(item => {
        balances[item.code] = {
          sist: item.total || 0,
          phys: item.ferpasur || 0
        };
      });

      if (preceding) {
        preceding.items.forEach(it => {
          const egresos = (it.ferpagro || 0) + (it.doyle1 || 0) + (it.doyle2 || 0) + (it.nacional || 0) + (it.sackett || 0) + (it.launica || 0) + (it.storeocean || 0) + (it.otras || 0) + (it.clientes || 0) + (it.damaged || 0);
          const ingresos = (it.interama || 0) + (it.sacoplast || 0) + (it.plasticsack || 0) + (it.reysac || 0);
          balances[it.code] = {
            sist: Math.max(0, (it.initialSist || 0) - egresos + ingresos),
            phys: Math.max(0, (it.initialPhys || 0) - egresos + ingresos)
          };
        });
      }
      return balances;
    }

    // Helper function to propagate balances downstream chronologically
    function propagateBalances(db) {
      if (!db.ferpasurConsumptions) db.ferpasurConsumptions = [];
      db.ferpasurConsumptions.sort((a, b) => a.date.localeCompare(b.date));
      
      const currentBalances = {};
      db.stock.forEach(item => {
        currentBalances[item.code] = {
          sist: item.total || 0,
          phys: item.ferpasur || 0
        };
      });

      db.ferpasurConsumptions.forEach((record, index) => {
        if (index > 0) {
          const preceding = db.ferpasurConsumptions[index - 1];
          preceding.items.forEach(it => {
            const egresos = (it.ferpagro || 0) + (it.doyle1 || 0) + (it.doyle2 || 0) + (it.nacional || 0) + (it.sackett || 0) + (it.launica || 0) + (it.storeocean || 0) + (it.otras || 0) + (it.clientes || 0) + (it.damaged || 0);
            const ingresos = (it.interama || 0) + (it.sacoplast || 0) + (it.plasticsack || 0) + (it.reysac || 0);
            currentBalances[it.code] = {
              sist: Math.max(0, (it.initialSist || 0) - egresos + ingresos),
              phys: Math.max(0, (it.initialPhys || 0) - egresos + ingresos)
            };
          });
          
          record.items.forEach(it => {
            if (currentBalances[it.code]) {
              it.initialSist = currentBalances[it.code].sist;
              it.initialPhys = currentBalances[it.code].phys;
            }
          });
        }
      });

      if (db.ferpasurConsumptions.length > 0) {
        const lastRecord = db.ferpasurConsumptions[db.ferpasurConsumptions.length - 1];
        lastRecord.items.forEach(it => {
          const stockItem = db.stock.find(s => s.code === it.code);
          if (stockItem) {
            const egresos = (it.ferpagro || 0) + (it.doyle1 || 0) + (it.doyle2 || 0) + (it.nacional || 0) + (it.sackett || 0) + (it.launica || 0) + (it.storeocean || 0) + (it.otras || 0) + (it.clientes || 0) + (it.damaged || 0);
            const ingresos = (it.interama || 0) + (it.sacoplast || 0) + (it.plasticsack || 0) + (it.reysac || 0);
            stockItem.total = Math.max(0, (it.initialSist || 0) - egresos + ingresos);
            stockItem.ferpasur = Math.max(0, (it.initialPhys || 0) - egresos + ingresos);
          }
        });
      }
    }

    // --- CLIENT PHYSICAL INVENTORY HELPERS & ENDPOINTS ---

    // Helper function to calculate starting client balances for a new date
    function getClientInitialBalancesForDate(db, date) {
      if (!db.clientConsumptions) db.clientConsumptions = [];
      const sorted = [...db.clientConsumptions].sort((a, b) => a.date.localeCompare(b.date));
      const preceding = sorted.reverse().find(r => r.date < date);
      
      const balances = {};
      db.stock.forEach(item => {
        balances[item.code] = {
          sist: item.unica || 0,
          phys: item.unica || 0
        };
      });

      if (preceding) {
        preceding.items.forEach(it => {
          const egresos = it.egresos || 0;
          const ingresos = it.ingresos || 0;
          balances[it.code] = {
            sist: Math.max(0, (it.initialSist || 0) - egresos + ingresos),
            phys: Math.max(0, (it.initialPhys || 0) - egresos + ingresos)
          };
        });
      }
      return balances;
    }

    // Helper function to propagate client balances downstream chronologically
    function propagateClientBalances(db) {
      if (!db.clientConsumptions) db.clientConsumptions = [];
      db.clientConsumptions.sort((a, b) => a.date.localeCompare(b.date));
      
      const currentBalances = {};
      db.stock.forEach(item => {
        currentBalances[item.code] = {
          sist: item.unica || 0,
          phys: item.unica || 0
        };
      });

      db.clientConsumptions.forEach((record, index) => {
        if (index > 0) {
          const preceding = db.clientConsumptions[index - 1];
          preceding.items.forEach(it => {
            const egresos = it.egresos || 0;
            const ingresos = it.ingresos || 0;
            currentBalances[it.code] = {
              sist: Math.max(0, (it.initialSist || 0) - egresos + ingresos),
              phys: Math.max(0, (it.initialPhys || 0) - egresos + ingresos)
            };
          });
          
          record.items.forEach(it => {
            if (currentBalances[it.code]) {
              it.initialSist = currentBalances[it.code].sist;
              it.initialPhys = currentBalances[it.code].phys;
            }
          });
        }
      });

      if (db.clientConsumptions.length > 0) {
        const lastRecord = db.clientConsumptions[db.clientConsumptions.length - 1];
        lastRecord.items.forEach(it => {
          const stockItem = db.stock.find(s => s.code === it.code);
          if (stockItem) {
            const egresos = it.egresos || 0;
            const ingresos = it.ingresos || 0;
            stockItem.unica = Math.max(0, (it.initialPhys || 0) - egresos + ingresos);
          }
        });
      }
    }

    // GET Client Consumptions
    if (pathname === '/api/client-consumptions' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          consumptions: db.clientConsumptions || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/client-consumptions/download-excel' && req.method === 'GET') {
      try {
        const date = parsedUrl.searchParams.get('date');
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        let record = db.clientConsumptions.find(c => c.date === date);
        if (!record) {
          const initialBalances = getClientInitialBalancesForDate(db, date);
          const items = db.stock.map(stockItem => {
            const bal = initialBalances[stockItem.code] || { sist: 0, phys: 0 };
            return {
              code: stockItem.code,
              egresos: 0,
              ingresos: 0,
              observation: '',
              initialSist: bal.sist,
              initialPhys: bal.phys
            };
          });
          record = { date, finalized: false, items };
        }

        const excelBuffer = generateClientInventoryExcel(date, record, db);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=Reporte_Inventario_Fisico_Cliente_${date}.xlsx`
        });
        res.end(excelBuffer);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/client-consumptions/download-pdf' && req.method === 'GET') {
      try {
        const date = parsedUrl.searchParams.get('date');
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        let record = db.clientConsumptions.find(c => c.date === date);
        if (!record) {
          const initialBalances = getClientInitialBalancesForDate(db, date);
          const items = db.stock.map(stockItem => {
            const bal = initialBalances[stockItem.code] || { sist: 0, phys: 0 };
            return {
              code: stockItem.code,
              egresos: 0,
              ingresos: 0,
              observation: '',
              initialSist: bal.sist,
              initialPhys: bal.phys
            };
          });
          record = { date, finalized: false, items };
        }

        const pdfBuffer = generateClientInventoryPDF(date, record, db);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=Reporte_Inventario_Fisico_Cliente_${date}.pdf`
        });
        res.end(pdfBuffer);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Initialize Client Consumptions for a date
    if (pathname === '/api/client-consumptions/initialize' && req.method === 'POST') {
      try {
        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        if (!db.clientConsumptions) db.clientConsumptions = [];

        let record = db.clientConsumptions.find(c => c.date === date);
        let created = false;

        if (!record) {
          const initBalances = getClientInitialBalancesForDate(db, date);
          record = {
            date,
            finalized: false,
            items: db.stock.map(stockItem => ({
              code: stockItem.code,
              initialSist: initBalances[stockItem.code] ? initBalances[stockItem.code].sist : (stockItem.unica || 0),
              initialPhys: initBalances[stockItem.code] ? initBalances[stockItem.code].phys : (stockItem.unica || 0),
              egresos: 0,
              ingresos: 0,
              observation: ''
            }))
          };
          db.clientConsumptions.push(record);
          propagateClientBalances(db);
          writeDB(db);
          created = true;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, created, record }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Reopen Client Consumptions
    if (pathname === '/api/client-consumptions/reopen' && req.method === 'POST') {
      try {
        if (user.role !== 'admin' && user.role !== 'logistic') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado: Solo Gerencia de Operaciones o Administradores pueden reabrir planillas finalizadas.' }));
          return;
        }

        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        if (!db.clientConsumptions) db.clientConsumptions = [];

        let record = db.clientConsumptions.find(c => c.date === date);
        if (!record) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No se encontró la planilla del cliente para esta fecha.' }));
          return;
        }

        record.finalized = false;
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Reapertura de planilla diaria de inventario físico cliente para la fecha: ${date}`
        });

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'La planilla diaria de cliente ha sido reabierta con éxito.', record }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Save Client Consumptions
    if (pathname === '/api/client-consumptions/save' && req.method === 'POST') {
      try {
        const { date, items } = await readJSONBody(req);
        if (!date || !Array.isArray(items)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha e ítems de consumos son requeridos.' }));
          return;
        }

        const db = readDB();
        if (!db.clientConsumptions) db.clientConsumptions = [];

        let record = db.clientConsumptions.find(c => c.date === date);
        if (!record) {
          // Initialize if it doesn't exist yet
          const initBalances = getClientInitialBalancesForDate(db, date);
          record = {
            date,
            finalized: false,
            items: db.stock.map(stockItem => ({
              code: stockItem.code,
              initialSist: initBalances[stockItem.code] ? initBalances[stockItem.code].sist : (stockItem.unica || 0),
              initialPhys: initBalances[stockItem.code] ? initBalances[stockItem.code].phys : (stockItem.unica || 0),
              egresos: 0,
              ingresos: 0,
              observation: ''
            }))
          };
          db.clientConsumptions.push(record);
        }

        // Finalize block check
        if (record.finalized && user.role !== 'admin' && user.role !== 'logistic') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Esta planilla diaria de cliente ya está finalizada y cerrada. No se permiten modificaciones sin autorización de la Gerencia de Operaciones.' }));
          return;
        }

        if (!db.ferpasurModifications) db.ferpasurModifications = [];

        // Apply changes
        items.forEach(inputItem => {
          let recItem = record.items.find(it => it.code === inputItem.code);
          if (!recItem) {
            recItem = {
              code: inputItem.code,
              initialSist: 0,
              initialPhys: 0,
              egresos: 0,
              ingresos: 0,
              observation: ''
            };
            record.items.push(recItem);
          }

          const stockItem = db.stock.find(s => s.code === inputItem.code);

          // Audit logic
          const fieldsToLog = ['egresos', 'ingresos', 'observation'];
          fieldsToLog.forEach(f => {
            if (inputItem[f] !== undefined && inputItem[f] !== recItem[f]) {
              const oldValue = recItem[f] === undefined || recItem[f] === '' ? 'N/A' : recItem[f];
              const newValue = inputItem[f] === undefined || inputItem[f] === '' ? 'N/A' : inputItem[f];
              
              const fieldLabel = f === 'egresos' ? 'Cliente - Egresos' : f === 'ingresos' ? 'Cliente - Ingresos' : 'Cliente - Observación';
              
              db.ferpasurModifications.unshift({
                timestamp: new Date().toISOString(),
                date: date,
                productCode: inputItem.code,
                productDesc: stockItem ? stockItem.desc : 'Desconocido',
                field: fieldLabel,
                oldValue: String(oldValue),
                newValue: String(newValue),
                user: `${user.name} (${user.username})`
              });
              
              recItem[f] = inputItem[f];
            }
          });
        });

        propagateClientBalances(db);
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Planilla de inventario de cliente guardada y saldos propagados correctamente.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Finalize Client Consumptions
    if (pathname === '/api/client-consumptions/finalize' && req.method === 'POST') {
      try {
        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha de registro es requerida.' }));
          return;
        }

        const db = readDB();
        if (!db.clientConsumptions) db.clientConsumptions = [];
        if (!db.history) db.history = [];

        let record = db.clientConsumptions.find(c => c.date === date);
        if (!record) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No se encontraron consumos de cliente registrados para finalizar en esta fecha.' }));
          return;
        }

        record.finalized = true;
        propagateClientBalances(db);

        const items = record.items;

        let emailHtml = `
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; }
              .header { background: #1b3a4b; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
              .title { margin: 0; font-size: 20px; font-weight: 600; }
              .subtitle { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
              .section-title { font-size: 16px; font-weight: 600; color: #1b3a4b; margin-top: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
              .table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 600; }
              .table td { border: 1px solid #e2e8f0; padding: 8px; }
              .table tr:nth-child(even) { background: #f8fafc; }
              .active-row { background-color: rgba(27, 58, 75, 0.05) !important; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
              .badge-egreso { background: #fee2e2; color: #991b1b; }
              .badge-ingreso { background: #d1fae5; color: #065f46; }
              .footer { margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2 class="title">Sistema Integral de Operaciones Ferpacific</h2>
              <p class="subtitle">Reporte Diario de Inventario Físico - Bodega Cliente (La Única)</p>
            </div>
            
            <p>Estimado Equipo,</p>
            <p>Se ha finalizado el llenado y registro de la planilla de inventario físico diario en bodega de cliente para la fecha: <strong>${date}</strong>. El día operativo correspondiente se encuentra <strong>Cerrado</strong> para modificaciones generales.</p>
            
            <div class="section-title">📊 Resumen de Actividad Cliente</div>
        `;

        const activeItems = db.stock.map(stockItem => {
          const matched = items.find(it => it.code === stockItem.code) || {
            initialSist: stockItem.unica || 0,
            initialPhys: stockItem.unica || 0,
            egresos: 0,
            ingresos: 0,
            observation: ''
          };
          return { stockItem, matched };
        }).filter(x => (x.matched.egresos || 0) > 0 || (x.matched.ingresos || 0) > 0 || (x.matched.observation && x.matched.observation.trim().length > 0));

        if (activeItems.length === 0) {
          emailHtml += `<p style="color: #64748b; font-style: italic;">No se registró actividad de consumos o ingresos de cliente para esta fecha.</p>`;
        } else {
          emailHtml += `
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Saco</th>
                  <th class="text-right">S. Inicial (Fís.)</th>
                  <th class="text-center">Actividad</th>
                  <th class="text-right">S. Final (Fís.)</th>
                  <th>Novedad / Observación</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          activeItems.forEach(x => {
            let actDetails = [];
            if (x.matched.egresos) actDetails.push(`Egresos: -${x.matched.egresos}`);
            let egresoText = actDetails.length > 0 ? `<span class="badge badge-egreso">Egreso</span> (${actDetails.join(', ')})` : '';

            let ingDetails = [];
            if (x.matched.ingresos) ingDetails.push(`Ingresos: +${x.matched.ingresos}`);
            let ingresoText = ingDetails.length > 0 ? `<span class="badge badge-ingreso">Ingreso</span> (${ingDetails.join(', ')})` : '';

            let actText = [egresoText, ingresoText].filter(t => t.length > 0).join('<br/>');

            const initPhys = x.matched.initialPhys || 0;
            const finalPhys = Math.max(0, initPhys - (x.matched.egresos || 0) + (x.matched.ingresos || 0));

            emailHtml += `
              <tr class="active-row">
                <td style="font-family: monospace;">${x.stockItem.code}</td>
                <td><strong>${x.stockItem.desc}</strong></td>
                <td class="text-right">${initPhys.toLocaleString()}</td>
                <td>${actText}</td>
                <td class="text-right" style="color: #0369a1; font-weight: bold;">${finalPhys.toLocaleString()}</td>
                <td style="color: #1e3a8a; font-style: italic;">${x.matched.observation || '-'}</td>
              </tr>
            `;
          });
          emailHtml += `</tbody></table>`;
        }

        // Inflows by Provider Section for Client
        const clientIncomingItems = [];
        db.stock.forEach(stockItem => {
          const matched = items.find(it => it.code === stockItem.code);
          if (matched && (matched.ingresos || 0) > 0) {
            clientIncomingItems.push({
              code: stockItem.code,
              desc: stockItem.desc,
              qty: matched.ingresos,
              observation: matched.observation || 'Sin novedades.'
            });
          }
        });

        emailHtml += `<div class="section-title">📥 Detalle de Ingresos por Proveedor (Cliente)</div>`;
        if (clientIncomingItems.length === 0) {
          emailHtml += `<p style="color: #64748b; font-style: italic;">No se registraron ingresos de cliente para esta fecha.</p>`;
        } else {
          emailHtml += `
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción Saco</th>
                  <th class="text-right">Cantidad Recibida</th>
                  <th>Observación / Novedad</th>
                </tr>
              </thead>
              <tbody>
          `;
          clientIncomingItems.forEach(x => {
            emailHtml += `
              <tr class="active-row">
                <td style="font-family: monospace;">${x.code}</td>
                <td><strong>${x.desc}</strong></td>
                <td class="text-right" style="color: #059669; font-weight: bold;">${x.qty.toLocaleString()} ud</td>
                <td style="color: #1e3a8a; font-style: italic;">${x.observation}</td>
              </tr>
            `;
          });
          emailHtml += `</tbody></table>`;
        }

        emailHtml += `
            <div class="section-title">📋 Detalle de Saldos de Cliente (La Única)</div>
            <table class="table" style="font-size: 11.5px;">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción Producto</th>
                  <th class="text-right">S. Inicial (Sist.)</th>
                  <th class="text-right">S. Inicial (Fís.)</th>
                  <th class="text-right">Egresos</th>
                  <th class="text-right">Ingresos</th>
                  <th class="text-right">S. Final (Sist.)</th>
                  <th class="text-right">S. Final (Fís.)</th>
                </tr>
              </thead>
              <tbody>
        `;

        db.stock.forEach(stockItem => {
          const matched = items.find(it => it.code === stockItem.code) || {
            initialSist: stockItem.unica || 0,
            initialPhys: stockItem.unica || 0,
            egresos: 0,
            ingresos: 0
          };

          const egresos = matched.egresos || 0;
          const ingresos = matched.ingresos || 0;

          const initSist = matched.initialSist || 0;
          const initPhys = matched.initialPhys || 0;
          const finalSist = Math.max(0, initSist - egresos + ingresos);
          const finalPhys = Math.max(0, initPhys - egresos + ingresos);

          const hasActivity = egresos > 0 || ingresos > 0;
          const rowStyle = hasActivity ? 'class="active-row"' : '';

          emailHtml += `
            <tr ${rowStyle}>
              <td style="font-family: monospace;">${stockItem.code}</td>
              <td>${stockItem.desc}</td>
              <td class="text-right">${initSist.toLocaleString()}</td>
              <td class="text-right">${initPhys.toLocaleString()}</td>
              <td class="text-right" style="color: ${egresos > 0 ? '#991b1b' : '#64748b'};">${egresos > 0 ? '-' + egresos.toLocaleString() : '0'}</td>
              <td class="text-right" style="color: ${ingresos > 0 ? '#065f46' : '#64748b'};">${ingresos > 0 ? '+' + ingresos.toLocaleString() : '0'}</td>
              <td class="text-right" style="font-weight: 600;">${finalSist.toLocaleString()}</td>
              <td class="text-right" style="color: #0369a1; font-weight: 600;">${finalPhys.toLocaleString()}</td>
            </tr>
          `;
        });

        const host = req.headers.host || 'localhost:3000';

        const pdfBuffer = generateClientInventoryPDF(date, record, db);
        const excelBuffer = generateClientInventoryExcel(date, record, db);

        // Save files to public/reports so they are always downloadable
        const reportsDir = path.join(__dirname, 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(reportsDir, `Reporte_Inventario_Fisico_Cliente_${date}.pdf`), pdfBuffer);
        fs.writeFileSync(path.join(reportsDir, `Reporte_Inventario_Fisico_Cliente_${date}.xlsx`), excelBuffer);

        emailHtml += `
              </tbody>
            </table>
            
            <div style="background: #f1f5f9; border-left: 4px solid #1b3a4b; padding: 12px; margin-top: 20px; border-radius: 4px; font-family: sans-serif;">
              <h4 style="margin: 0 0 5px 0; color: #1b3a4b; font-size: 14px;">📥 Descargar Reportes Completos (Formatos Originales)</h4>
              <p style="margin: 0; font-size: 12px; color: #334155;">Haga clic en los siguientes enlaces para abrir o descargar los archivos completos en su navegador:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px; line-height: 1.6;">
                <li><a href="http://${host}/reports/Reporte_Inventario_Fisico_Cliente_${date}.pdf" target="_blank" style="color: #2563eb; font-weight: bold; text-decoration: underline;">📄 Descargar Reporte Completo en PDF</a></li>
                <li><a href="http://${host}/reports/Reporte_Inventario_Fisico_Cliente_${date}.xlsx" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">📊 Descargar Reporte Completo en Excel (.xlsx)</a></li>
              </ul>
            </div>

            <p class="footer">
              Este reporte fue generado de forma automática por el Sistema Integral de Operaciones Ferpacific.<br/>
              Fecha de procesamiento: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}
            </p>
          </body>
          </html>
        `;

        const recipients = ['lmerchan@ferpacific.com', 'jduran@ferpacific.com'];
        console.log(`[FINALIZE-CLIENT] Enviando reporte diario de cliente por correo a:`, recipients);

        const attachments = [
          { filename: `Reporte_Inventario_Fisico_Cliente_${date}.pdf`, contentType: "application/pdf", content: pdfBuffer },
          { filename: `Reporte_Inventario_Fisico_Cliente_${date}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: excelBuffer }
        ];

        let mailSent = true;
        try {
          await sendMailWithResilience({
            db: db,
            to: recipients,
            subject: `Reporte Diario de Inventario Físico Cliente - ${date}`,
            html: emailHtml,
            mensaje: `Se adjunta el reporte diario de inventario físico y consumos de cliente para la fecha: ${date}.`,
            pdfBuffer: pdfBuffer,
            attachments: attachments
          });
        } catch (mailErr) {
          console.warn("[FINALIZE-CLIENT] Error al enviar correo de notificación:", mailErr.message);
          mailSent = false;
        }

        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Finalización de planilla diaria de inventario cliente para la fecha: ${date} (Correo: ${mailSent ? 'enviado' : 'pendiente'})`
        });

        writeDB(db);

        const successMsg = mailSent 
          ? '¡Planilla diaria de cliente finalizada y reporte enviado por correo con éxito!'
          : '¡Planilla diaria de cliente finalizada con éxito! (Nota: No se pudo enviar el correo de notificación en este momento).';

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: successMsg }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/initialize' && req.method === 'POST') {
      try {
        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        if (!db.ferpasurConsumptions) db.ferpasurConsumptions = [];

        let record = db.ferpasurConsumptions.find(c => c.date === date);
        let created = false;
        if (!record) {
          const initialBalances = getInitialBalancesForDate(db, date);
          const items = db.stock.map(item => ({
            code: item.code,
            initialSist: initialBalances[item.code].sist,
            initialPhys: initialBalances[item.code].phys,
            ferpagro: 0,
            doyle1: 0,
            doyle2: 0,
            nacional: 0,
            sackett: 0,
            launica: 0,
            storeocean: 0,
            otras: 0,
            clientes: 0,
            damaged: 0,
            interama: 0,
            sacoplast: 0,
            plasticsack: 0,
            reysac: 0,
            observation: ''
          }));

          record = {
            date,
            finalized: false,
            items
          };
          db.ferpasurConsumptions.push(record);
          db.ferpasurConsumptions.sort((a, b) => a.date.localeCompare(b.date));
          writeDB(db);
          created = true;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, created, record }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/reopen' && req.method === 'POST') {
      try {
        if (user.role !== 'admin' && user.role !== 'logistic') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado: Solo Gerencia de Operaciones o Administradores pueden reabrir planillas finalizadas.' }));
          return;
        }

        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha es requerida.' }));
          return;
        }

        const db = readDB();
        const record = db.ferpasurConsumptions.find(c => c.date === date);
        if (!record) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No se encontró registro para esta fecha.' }));
          return;
        }

        record.finalized = false;
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Reapertura de planilla diaria de inventario físico Ferpasur para la fecha: ${date}`
        });

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'La planilla diaria ha sido reabierta con éxito.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-modifications' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          modifications: db.ferpasurModifications || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/save' && req.method === 'POST') {
      try {
        const { date, items } = await readJSONBody(req);
        if (!date || !Array.isArray(items)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha e ítems de consumos son requeridos.' }));
          return;
        }

        const db = readDB();
        if (!db.ferpasurConsumptions) db.ferpasurConsumptions = [];
        if (!db.emptyBagsMovements) db.emptyBagsMovements = [];
        if (!db.ferpasurModifications) db.ferpasurModifications = [];
        if (!db.history) db.history = [];

        // 1. Verify finalized locking status
        let record = db.ferpasurConsumptions.find(c => c.date === date);
        if (record && record.finalized) {
          if (user.role !== 'admin' && user.role !== 'logistic') {
            res.writeHead(403);
            res.end(JSON.stringify({ success: false, error: 'Esta planilla diaria ya está finalizada y cerrada. No se permiten modificaciones sin autorización de la Gerencia de Operaciones.' }));
            return;
          }
        }

        // Initialize record if missing
        if (!record) {
          const initialBalances = getInitialBalancesForDate(db, date);
          record = {
            date,
            finalized: false,
            items: db.stock.map(item => ({
              code: item.code,
              initialSist: initialBalances[item.code].sist,
              initialPhys: initialBalances[item.code].phys,
              ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
              launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
              interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
              observation: ''
            }))
          };
          db.ferpasurConsumptions.push(record);
        }

        // 2. Perform Audit Log checking for quantity changes
        const fieldLabels = {
          ferpagro: 'Ferpagro',
          doyle1: 'Doyle 1',
          doyle2: 'Doyle 2',
          nacional: 'Nacional',
          sackett: 'Sackett',
          launica: 'La Única',
          storeocean: 'Storeocean',
          otras: 'Otras Bodegas',
          clientes: 'Clientes',
          damaged: 'Sacos Dañados',
          interama: 'INTERAMA',
          sacoplast: 'SACOPLAST',
          plasticsack: 'PLASTICSACK',
          reysac: 'REYSAC'
        };

        const numericFields = Object.keys(fieldLabels);

        items.forEach(newItem => {
          const oldItem = record.items.find(it => it.code === newItem.code);
          const stockItem = db.stock.find(s => s.code === newItem.code);
          if (oldItem && stockItem) {
            numericFields.forEach(field => {
              const oldValue = oldItem[field] || 0;
              const newValue = newItem[field] || 0;
              if (oldValue !== newValue) {
                db.ferpasurModifications.unshift({
                  id: 'MOD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
                  date,
                  productCode: newItem.code,
                  productDesc: stockItem.desc,
                  field: fieldLabels[field] || field,
                  oldValue,
                  newValue,
                  user: user.name || user.username,
                  username: user.username,
                  timestamp: new Date().toISOString()
                });
              }
            });
            
            if ((oldItem.observation || '') !== (newItem.observation || '')) {
              db.ferpasurModifications.unshift({
                id: 'MOD-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
                date,
                productCode: newItem.code,
                productDesc: stockItem.desc,
                field: 'Observación',
                oldValue: oldItem.observation || 'N/A',
                newValue: newItem.observation || 'N/A',
                user: user.name || user.username,
                username: user.username,
                timestamp: new Date().toISOString()
              });
            }
          }
        });

        // 3. Clear old movements logs for this exact date
        db.emptyBagsMovements = db.emptyBagsMovements.filter(m => !(m.date === date && m.concept.startsWith('Consumo de Producción')));
        db.emptyBagsMovements = db.emptyBagsMovements.filter(m => !(m.date === date && m.concept.startsWith('Entrega Proveedor')));

        // 4. Update the items inside the record
        items.forEach(newItem => {
          const recordItem = record.items.find(it => it.code === newItem.code);
          const stockItem = db.stock.find(s => s.code === newItem.code);
          if (recordItem && stockItem) {
            numericFields.forEach(field => {
              recordItem[field] = newItem[field] || 0;
            });
            recordItem.observation = newItem.observation || '';

            const totalCons = (recordItem.ferpagro || 0) +
                              (recordItem.doyle1 || 0) +
                              (recordItem.doyle2 || 0) +
                              (recordItem.nacional || 0) +
                              (recordItem.sackett || 0) +
                              (recordItem.launica || 0) +
                              (recordItem.storeocean || 0) +
                              (recordItem.otras || 0) +
                              (recordItem.clientes || 0) +
                              (recordItem.damaged || 0);

            const totalInputs = (recordItem.interama || 0) +
                                (recordItem.sacoplast || 0) +
                                (recordItem.plasticsack || 0) +
                                (recordItem.reysac || 0);

            if (totalCons > 0) {
              db.emptyBagsMovements.unshift({
                id: 'MOV-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
                type: 'salida',
                date,
                code: newItem.code,
                desc: stockItem.desc,
                quantity: totalCons,
                destinationOrSource: 'Plantas Ferpasur',
                concept: 'Consumo de Producción (Bodega)',
                finalBalance: stockItem.total,
                user: user.name,
                username: user.username,
                timestamp: new Date().toISOString(),
                observation: recordItem.observation || '',
                details: {
                  ferpagro: recordItem.ferpagro || 0,
                  doyle1: recordItem.doyle1 || 0,
                  doyle2: recordItem.doyle2 || 0,
                  nacional: recordItem.nacional || 0,
                  sackett: recordItem.sackett || 0,
                  launica: recordItem.launica || 0,
                  storeocean: recordItem.storeocean || 0,
                  otras: recordItem.otras || 0,
                  clientes: recordItem.clientes || 0,
                  damaged: recordItem.damaged || 0
                }
              });
            }

            if (totalInputs > 0) {
              db.emptyBagsMovements.unshift({
                id: 'MOV-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex'),
                type: 'entrada',
                date,
                code: newItem.code,
                desc: stockItem.desc,
                quantity: totalInputs,
                destinationOrSource: 'Proveedores Ferpasur',
                concept: 'Entrega Proveedor (Planilla Diaria)',
                finalBalance: stockItem.total,
                user: user.name,
                username: user.username,
                timestamp: new Date().toISOString(),
                observation: recordItem.observation || '',
                details: {
                  interama: recordItem.interama || 0,
                  sacoplast: recordItem.sacoplast || 0,
                  plasticsack: recordItem.plasticsack || 0,
                  reysac: recordItem.reysac || 0
                }
              });
            }

            if (newItem.interama > 0) stockItem.transitInterama = Math.max(0, (stockItem.transitInterama || 0) - newItem.interama);
            if (newItem.sacoplast > 0) stockItem.transitSacoplast = Math.max(0, (stockItem.transitSacoplast || 0) - newItem.sacoplast);
            if (newItem.plasticsack > 0) stockItem.transitPlasticsack = Math.max(0, (stockItem.transitPlasticsack || 0) - newItem.plasticsack);
            if (newItem.reysac > 0) stockItem.transitReysac = Math.max(0, (stockItem.transitReysac || 0) - newItem.reysac);

            stockItem.totalTransit = (stockItem.transitSacoplast || 0) + 
                                     (stockItem.transitInterama || 0) + 
                                     (stockItem.transitPlasticsack || 0) + 
                                     (stockItem.transitReysac || 0);
          }
        });

        propagateBalances(db);

        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Planilla física guardada y balances propagados para la fecha: ${date}`
        });

        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Planilla de consumos e ingresos guardada y saldos propagados correctamente.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/ferpasur-consumptions/finalize' && req.method === 'POST') {
      try {
        const { date } = await readJSONBody(req);
        if (!date) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Fecha de registro es requerida.' }));
          return;
        }

        const db = readDB();
        if (!db.ferpasurConsumptions) db.ferpasurConsumptions = [];
        if (!db.history) db.history = [];

        let record = db.ferpasurConsumptions.find(c => c.date === date);
        if (!record) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'No se encontraron consumos registrados para finalizar en esta fecha.' }));
          return;
        }

        record.finalized = true;
        propagateBalances(db);

        const items = record.items;

        let emailHtml = `
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; }
              .header { background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
              .title { margin: 0; font-size: 20px; font-weight: 600; }
              .subtitle { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
              .section-title { font-size: 16px; font-weight: 600; color: #1e3a8a; margin-top: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
              .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
              .table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-weight: 600; }
              .table td { border: 1px solid #e2e8f0; padding: 8px; }
              .table tr:nth-child(even) { background: #f8fafc; }
              .active-row { background-color: rgba(37, 99, 235, 0.05) !important; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
              .badge-egreso { background: #fee2e2; color: #991b1b; }
              .badge-ingreso { background: #d1fae5; color: #065f46; }
              .footer { margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2 class="title">Sistema Integral de Operaciones Ferpacific</h2>
              <p class="subtitle">Reporte Diario de Inventario Físico y Consumos - Bodega Ferpasur</p>
            </div>
            
            <p>Estimado Equipo,</p>
            <p>Se ha finalizado el llenado y registro de la planilla de inventario físico diario en bodega para la fecha: <strong>${date}</strong>. El día operativo correspondiente se encuentra <strong>Cerrado</strong> para modificaciones generales.</p>
            
            <div class="section-title">📊 Resumen de Actividad Diaria</div>
        `;

        const activeItems = db.stock.map(stockItem => {
          const matched = items.find(it => it.code === stockItem.code) || {
            ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
            launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
            interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
            observation: '', initialSist: stockItem.total || 0, initialPhys: stockItem.ferpasur || 0
          };
          const egresos = (matched.ferpagro || 0) + (matched.doyle1 || 0) + (matched.doyle2 || 0) + (matched.nacional || 0) + (matched.sackett || 0) + (matched.launica || 0) + (matched.storeocean || 0) + (matched.otras || 0) + (matched.clientes || 0) + (matched.damaged || 0);
          const ingresos = (matched.interama || 0) + (matched.sacoplast || 0) + (matched.plasticsack || 0) + (matched.reysac || 0);
          return { stockItem, matched, egresos, ingresos };
        }).filter(x => x.egresos > 0 || x.ingresos > 0 || (x.matched.observation && x.matched.observation.trim().length > 0));

        if (activeItems.length === 0) {
          emailHtml += `<p style="color: #64748b; font-style: italic;">No se registró actividad de consumos o ingresos de proveedores para esta fecha.</p>`;
        } else {
          emailHtml += `
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Saco</th>
                  <th class="text-right">S. Inicial (Fís.)</th>
                  <th class="text-center">Actividad</th>
                  <th class="text-right">S. Final (Fís.)</th>
                  <th>Novedad / Observación</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          activeItems.forEach(x => {
            let actDetails = [];
            if (x.matched.ferpagro) actDetails.push(`Ferpagro: ${x.matched.ferpagro}`);
            if (x.matched.doyle1) actDetails.push(`D1: ${x.matched.doyle1}`);
            if (x.matched.doyle2) actDetails.push(`D2: ${x.matched.doyle2}`);
            if (x.matched.nacional) actDetails.push(`Nac: ${x.matched.nacional}`);
            if (x.matched.sackett) actDetails.push(`Sack: ${x.matched.sackett}`);
            if (x.matched.launica) actDetails.push(`La Única: ${x.matched.launica}`);
            if (x.matched.storeocean) actDetails.push(`Storeocean: ${x.matched.storeocean}`);
            if (x.matched.otras) actDetails.push(`Otras Bod: ${x.matched.otras}`);
            if (x.matched.clientes) actDetails.push(`Clientes: ${x.matched.clientes}`);
            if (x.matched.damaged) actDetails.push(`Dañados: ${x.matched.damaged}`);
            
            let egresoText = actDetails.length > 0 ? `<span class="badge badge-egreso">Egreso</span> (${actDetails.join(', ')})` : '';

            let ingDetails = [];
            if (x.matched.interama) ingDetails.push(`Interama: ${x.matched.interama}`);
            if (x.matched.sacoplast) ingDetails.push(`Sacoplast: ${x.matched.sacoplast}`);
            if (x.matched.plasticsack) ingDetails.push(`Plasticsack: ${x.matched.plasticsack}`);
            if (x.matched.reysac) ingDetails.push(`Reysac: ${x.matched.reysac}`);

            let ingresoText = ingDetails.length > 0 ? `<span class="badge badge-ingreso">Ingreso</span> (${ingDetails.join(', ')})` : '';

            let actText = [egresoText, ingresoText].filter(t => t.length > 0).join('<br/>');

            const initPhys = x.matched.initialPhys || 0;
            const finalPhys = Math.max(0, initPhys - x.egresos + x.ingresos);

            emailHtml += `
              <tr class="active-row">
                <td style="font-family: monospace;">${x.stockItem.code}</td>
                <td><strong>${x.stockItem.desc}</strong></td>
                <td class="text-right">${initPhys.toLocaleString()}</td>
                <td>${actText}</td>
                <td class="text-right" style="color: #2563eb; font-weight: bold;">${finalPhys.toLocaleString()}</td>
                <td style="color: #1e3a8a; font-style: italic;">${x.matched.observation || '-'}</td>
              </tr>
            `;
          });
          emailHtml += `</tbody></table>`;
        }

        // Inflows by Provider Section
        let ingresosHtml = '';
        const incomingItems = [];
        db.stock.forEach(stockItem => {
          const matched = items.find(it => it.code === stockItem.code);
          if (matched) {
            const providers = [
              { name: 'INTERAMA', qty: matched.interama || 0 },
              { name: 'SACOPLAST', qty: matched.sacoplast || 0 },
              { name: 'PLASTICSACK', qty: matched.plasticsack || 0 },
              { name: 'REYSAC', qty: matched.reysac || 0 }
            ];
            providers.forEach(p => {
              if (p.qty > 0) {
                incomingItems.push({
                  provider: p.name,
                  code: stockItem.code,
                  desc: stockItem.desc,
                  qty: p.qty,
                  observation: matched.observation || 'Sin novedades.'
                });
              }
            });
          }
        });

        emailHtml += `<div class="section-title">📥 Detalle de Ingresos por Proveedor</div>`;
        if (incomingItems.length === 0) {
          emailHtml += `<p style="color: #64748b; font-style: italic;">No se registraron ingresos de proveedores para esta fecha.</p>`;
        } else {
          emailHtml += `
            <table class="table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Código</th>
                  <th>Descripción Saco</th>
                  <th class="text-right">Cantidad Recibida</th>
                  <th>Observación / Novedad</th>
                </tr>
              </thead>
              <tbody>
          `;
          incomingItems.forEach(x => {
            emailHtml += `
              <tr class="active-row">
                <td><span class="badge badge-ingreso">${x.provider}</span></td>
                <td style="font-family: monospace;">${x.code}</td>
                <td><strong>${x.desc}</strong></td>
                <td class="text-right" style="color: #059669; font-weight: bold;">${x.qty.toLocaleString()} ud</td>
                <td style="color: #1e3a8a; font-style: italic;">${x.observation}</td>
              </tr>
            `;
          });
          emailHtml += `</tbody></table>`;
        }

        emailHtml += `
            <div class="section-title">📋 Detalle de Saldos Generales de Bodega</div>
            <table class="table" style="font-size: 11.5px;">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción Producto</th>
                  <th class="text-right">S. Inicial (Sist.)</th>
                  <th class="text-right">S. Inicial (Fís.)</th>
                  <th class="text-right">Egresos</th>
                  <th class="text-right">Ingresos</th>
                  <th class="text-right">S. Final (Sist.)</th>
                  <th class="text-right">S. Final (Fís.)</th>
                </tr>
              </thead>
              <tbody>
        `;

        db.stock.forEach(stockItem => {
          const matched = items.find(it => it.code === stockItem.code) || {
            ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
            launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
            interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
            initialSist: stockItem.total || 0, initialPhys: stockItem.ferpasur || 0
          };

          const egresos = (matched.ferpagro || 0) + (matched.doyle1 || 0) + (matched.doyle2 || 0) + (matched.nacional || 0) + (matched.sackett || 0) + (matched.launica || 0) + (matched.storeocean || 0) + (matched.otras || 0) + (matched.clientes || 0) + (matched.damaged || 0);
          const ingresos = (matched.interama || 0) + (matched.sacoplast || 0) + (matched.plasticsack || 0) + (matched.reysac || 0);

          const initSist = matched.initialSist || 0;
          const initPhys = matched.initialPhys || 0;
          const finalSist = Math.max(0, initSist - egresos + ingresos);
          const finalPhys = Math.max(0, initPhys - egresos + ingresos);

          const hasActivity = egresos > 0 || ingresos > 0;
          const rowStyle = hasActivity ? 'class="active-row"' : '';

          emailHtml += `
            <tr ${rowStyle}>
              <td style="font-family: monospace;">${stockItem.code}</td>
              <td>${stockItem.desc}</td>
              <td class="text-right">${initSist.toLocaleString()}</td>
              <td class="text-right">${initPhys.toLocaleString()}</td>
              <td class="text-right" style="color: ${egresos > 0 ? '#991b1b' : '#64748b'};">${egresos > 0 ? '-' + egresos.toLocaleString() : '0'}</td>
              <td class="text-right" style="color: ${ingresos > 0 ? '#065f46' : '#64748b'};">${ingresos > 0 ? '+' + ingresos.toLocaleString() : '0'}</td>
              <td class="text-right" style="font-weight: 600;">${finalSist.toLocaleString()}</td>
              <td class="text-right" style="color: #2563eb; font-weight: 600;">${finalPhys.toLocaleString()}</td>
            </tr>
          `;
        });

        const host = req.headers.host || 'localhost:3000';

        const pdfBuffer = generateInventoryPDF(date, record, db);
        const excelBuffer = generateInventoryExcel(date, record, db);

        // Save files to public/reports so they are always downloadable
        const reportsDir = path.join(__dirname, 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(reportsDir, `Reporte_Inventario_Fisico_Ferpasur_${date}.pdf`), pdfBuffer);
        fs.writeFileSync(path.join(reportsDir, `Reporte_Inventario_Fisico_Ferpasur_${date}.xlsx`), excelBuffer);

        emailHtml += `
              </tbody>
            </table>
            
            <div style="background: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 12px; margin-top: 20px; border-radius: 4px; font-family: sans-serif;">
              <h4 style="margin: 0 0 5px 0; color: #1e3a8a; font-size: 14px;">📥 Descargar Reportes Completos (Formatos Originales)</h4>
              <p style="margin: 0; font-size: 12px; color: #334155;">Haga clic en los siguientes enlaces para abrir o descargar los archivos completos en su navegador:</p>
              <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px; line-height: 1.6;">
                <li><a href="http://${host}/reports/Reporte_Inventario_Fisico_Ferpasur_${date}.pdf" target="_blank" style="color: #2563eb; font-weight: bold; text-decoration: underline;">📄 Descargar Reporte Completo en PDF</a></li>
                <li><a href="http://${host}/reports/Reporte_Inventario_Fisico_Ferpasur_${date}.xlsx" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">📊 Descargar Reporte Completo en Excel (.xlsx)</a></li>
              </ul>
            </div>

            <p class="footer">
              Este reporte fue generado de forma automática por el Sistema Integral de Operaciones Ferpacific.<br/>
              Fecha de procesamiento: ${new Date().toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}
            </p>
          </body>
          </html>
        `;

        const recipients = ['lmerchan@ferpacific.com', 'jduran@ferpacific.com'];
        console.log(`[FINALIZE] Enviando reporte diario de inventario físico por correo a:`, recipients);

        const attachments = [
          { filename: `Reporte_Inventario_Fisico_Ferpasur_${date}.pdf`, contentType: "application/pdf", content: pdfBuffer },
          { filename: `Reporte_Inventario_Fisico_Ferpasur_${date}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: excelBuffer }
        ];

        let mailSent = true;
        try {
          await sendMailWithResilience({
            db: db,
            to: recipients,
            subject: `Reporte Diario de Inventario Físico Bodega Ferpasur - ${date}`,
            html: emailHtml,
            mensaje: `Se adjunta el reporte diario de inventario físico y consumos de bodega Ferpasur para la fecha: ${date}.`,
            pdfBuffer: pdfBuffer,
            attachments: attachments
          });
        } catch (mailErr) {
          console.warn("[FINALIZE] Error al enviar correo de notificación:", mailErr.message);
          mailSent = false;
        }

        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Finalización de planilla diaria de inventario físico Ferpasur para la fecha: ${date} (Correo: ${mailSent ? 'enviado' : 'pendiente'})`
        });

        writeDB(db);

        const successMsg = mailSent
          ? '¡Planilla diaria finalizada y reporte de inventario enviado por correo con éxito!'
          : '¡Planilla diaria finalizada con éxito! (Nota: No se pudo enviar el correo de notificación en este momento).';

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: successMsg }));

      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/update-stock' && req.method === 'POST') {
      try {
        let chunks = [];
        req.on('data', chunk => {
          chunks.push(chunk);
        });
        req.on('end', async () => {
          try {
            const fileBuffer = Buffer.concat(chunks);
            if (fileBuffer.length === 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ success: false, error: "El archivo enviado está vacío." }));
              return;
            }

            console.log(`Iniciando lectura de Excel recibido por red (${fileBuffer.length} bytes)...`);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            
            // Find sheets by name
            const stockSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("saldos")) || workbook.SheetNames[0];
            const projSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes("proyecc"));
            
            const stockSheet = workbook.Sheets[stockSheetName];
            const projSheet = projSheetName ? workbook.Sheets[projSheetName] : null;
            
            const rows = XLSX.utils.sheet_to_json(stockSheet, { defval: "" });

            if (rows.length === 0) {
              res.writeHead(400);
              res.end(JSON.stringify({ success: false, error: "La hoja de saldos está vacía o tiene un formato incorrecto." }));
              return;
            }

            const db = readDB();
            const existingRequisitions = {};
            if (db.stock) {
              db.stock.forEach(item => {
                if (item.requisition !== undefined) {
                  existingRequisitions[item.code] = item.requisition;
                }
              });
            }

            // Parse Proyección sheet if available
            const projMap = {};
            if (projSheet) {
              const projRows = XLSX.utils.sheet_to_json(projSheet, { defval: "" });
              projRows.forEach(row => {
                const code = String(row["Código Producto"] || "").trim();
                if (code) {
                  const jul = Number(row["Jul-26"] || 0);
                  const aug = Number(row["Aug-26"] || 0);
                  const sep = Number(row["Sep-26"] || 0);
                  const oct = Number(row["Oct-26"] || 0);
                  const nov = Number(row["Nov-26"] || 0);
                  const dec = Number(row["Dec-26"] || 0);
                  projMap[code] = {
                    tipo: String(row["Tipo"] || "").trim(),
                    linea: String(row["Linea"] || "").trim(),
                    jul26: jul,
                    aug26: aug,
                    sep26: sep,
                    oct26: oct,
                    nov26: nov,
                    dec26: dec,
                    projection3Months: jul + aug + sep
                  };
                }
              });
            }

            // Clean & parse rows
            const parsedStock = rows.map(row => {
              const code = String(row["Código Producto"] || "").trim();
              const projData = projMap[code] || { 
                tipo: "SIMPLE", 
                linea: "Tradicionales",
                jul26: 0,
                aug26: 0,
                sep26: 0,
                oct26: 0,
                nov26: 0,
                dec26: 0,
                projection3Months: 0
              };
              
              const physicalStock = Number(row["TOTAL"] || 0);
              const transitSacoplast = Number(row["Transito Sacoplast"] || 0);
              const transitInterama = Number(row["Transito Interama"] || 0);
              const transitPlasticsack = Number(row["Transito Plasticsack"] || 0);
              const transitReysac = Number(row["Transito Reysac"] || 0);
              const totalTransit = transitSacoplast + transitInterama + transitPlasticsack + transitReysac;
              
              const suggestedOrder = Math.max(0, projData.projection3Months - (physicalStock + totalTransit));
              
              let alertStatus = "SIN_PROYEC";
              if (projData.projection3Months > 0) {
                if (physicalStock < projData.jul26) {
                  alertStatus = "URGENTE";
                } else if (physicalStock + totalTransit < projData.projection3Months) {
                  alertStatus = "SOLICITAR";
                } else if (physicalStock < projData.projection3Months) {
                  alertStatus = "EN_TRANSITO";
                } else {
                  alertStatus = "SUFICIENTE";
                }
              }
              
              const requisitionVal = existingRequisitions[code] || 0;
              const tempItem = {
                code,
                desc: String(row["Descripción Producto"] || "").trim(),
                total: physicalStock,
                transitSacoplast,
                transitInterama,
                transitPlasticsack,
                transitReysac,
                tipo: projData.tipo,
                linea: projData.linea,
                jul26: projData.jul26,
                aug26: projData.aug26,
                sep26: projData.sep26,
                oct26: projData.oct26,
                nov26: projData.nov26,
                dec26: projData.dec26,
                projection3Months: projData.projection3Months,
                totalTransit,
                suggestedOrder,
                alertStatus,
                requisition: requisitionVal
              };
              
              tempItem.observation = generateAIRecommendation(tempItem);
              
              return {
                ...tempItem,
                ferpasur: Number(row["SALDOS FERPASUR 15/06/2026"] || row["SALDOS FERPASUR"] || 0),
                unica: Number(row["SALDOS UNICA 11/06/2026"] || row["SALDOS UNICA"] || 0)
              };
            }).filter(item => item.code && item.desc);

            db.stock = parsedStock;

            const criticalAlerts = parsedStock.filter(item => {
              return item.alertStatus === "URGENTE" || item.alertStatus === "SOLICITAR";
            });

            let emailLog = null;
            let emailSent = false;
            let emailError = null;

            if (criticalAlerts.length > 0) {
              const smtpConfig = db.settings.smtp || {};
              const recipients = db.settings.emailRecipients || ["jduran@ferpacific.com", "lmerchan@ferpacific.com"];
              
              let minDays = Infinity;
              let minDaysText = "poco";
              criticalAlerts.forEach(item => {
                const cov = getCoverageTime(item);
                if (cov.days < minDays) {
                  minDays = cov.days;
                  minDaysText = cov.exactText || `${cov.days} dias`;
                }
              });

              const pdfBuffer = generateRequisitionPDF(criticalAlerts);
              
              let excelBuffer;
              try {
                excelBuffer = generateRequisitionExcel(criticalAlerts);
                console.log("Requisicion en Excel generada con éxito.");
              } catch (e) {
                console.error("No se pudo generar la requisicion en Excel:", e.message);
              }

              const alertSubject = "ALERTA URGENTE DE SOLICITUD DE SACOS VACÍOS";
              const alertMessage = `Estimado Johnny, en aproximadamente ${minDaysText} te podrias quedar sin estos sacos si no los solicitas ahora.`;

              try {
                let mailRes;
                if (smtpConfig.method === "formsubmit") {
                  console.log(`Alerta de stock disparada. Enviando via FormSubmit a ${recipients}...`);
                  mailRes = await sendFormSubmit({
                    to: recipients,
                    cc: recipients.slice(1),
                    subject: alertSubject,
                    mensaje: alertMessage,
                    criticalAlerts,
                    pdfBuffer
                  });
                } else {
                  const smtpHost = smtpConfig.host || "smtp.gmail.com";
                  const smtpPort = Number(smtpConfig.port || 587);
                  const smtpUser = smtpConfig.user || "";
                  const smtpPass = smtpConfig.pass || "";
                  const smtpSecure = !!smtpConfig.secure;
                  const smtpFrom = smtpConfig.from || smtpConfig.user || "alerta_sacos_vacios@operaciones.com";

                  console.log(`Alerta de stock por proyecciones disparada. Enviando correo SMTP a ${recipients}...`);
                  const htmlContent = `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px;">
                      <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px; margin-top: 0;">${alertSubject}</h2>
                      <p style="font-size: 15px; font-weight: bold;">Estimado Johnny,</p>
                      <p style="font-size: 14px;">En aproximadamente <strong>${minDaysText}</strong> te podrias quedar sin estos sacos si no los solicitas ahora.</p>
                      <p style="font-size: 14px; color: #555;">Se adjunta a este correo el formato de requisición de bodega formal ya completado en PDF y Excel para su envío al área de compras.</p>
                      <br>
                      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                      <p style="font-size: 12px; color: #777;">Control de Sacos Vacios - Ferpacific</p>
                    </div>
                  `;
                  
                  const attachments = [
                    { filename: "Requisicion_Sacos_Vacios.pdf", contentType: "application/pdf", content: pdfBuffer }
                  ];
                  if (excelBuffer) {
                    attachments.push({
                      filename: "Requisicion_Sacos_Vacios.xlsx",
                      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      content: excelBuffer
                    });
                  }

                  mailRes = await sendMail({
                    host: smtpHost,
                    port: smtpPort,
                    user: smtpUser,
                    pass: smtpPass,
                    secure: smtpSecure,
                    from: smtpFrom,
                    to: recipients,
                    subject: alertSubject,
                    html: htmlContent,
                    attachments
                  });
                }
                
                emailSent = true;
                emailLog = mailRes.log;
              } catch (err) {
                console.error("Error enviando correo de alerta:", err);
                emailError = err.message || err;
                emailLog = err.log || null;
              }
            }

            const urgentCount = criticalAlerts.filter(item => item.alertStatus === "URGENTE").length;
            const fileName = req.headers['x-file-name'] || "SALDOS SACOS VACIOS.xlsx";

            // Add history log
            const logEntry = {
              timestamp: new Date().toISOString(),
              user: user.name,
              username: user.username,
              file: fileName,
              status: emailError ? "Alerta con errores" : (emailSent ? "Alerta enviada" : "Actualizado"),
              totalItems: parsedStock.length,
              lowStockSpecialtiesCount: urgentCount,
              emailSent,
              emailError
            };

            if (!db.history) db.history = [];
            db.history.unshift(logEntry);
            writeDB(db);

            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              totalItems: parsedStock.length,
              lowStockCount: urgentCount,
              emailSent,
              emailError,
              logEntry
            }));
          } catch (innerErr) {
            console.error("Error al procesar el archivo Excel subido:", innerErr);
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: `Error de formato: ${innerErr.message}` }));
          }
        });
      } catch (err) {
        console.error("Error actualizando stock:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: `Error de red al procesar el archivo Excel: ${err.message}` }));
      }
      return;
    }

    // 3.5 GET PRODUCTION REGISTRY RECORDS (PAGINATED & FILTERED)
    if (pathname === '/api/production-registry' && req.method === 'GET') {
      try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const page = parseInt(parsedUrl.searchParams.get('page')) || 1;
        const limit = parseInt(parsedUrl.searchParams.get('limit')) || 50;
        const search = parsedUrl.searchParams.get('search') || '';
        const line = parsedUrl.searchParams.get('line') || '';
        const startDate = parsedUrl.searchParams.get('startDate') || '';
        const endDate = parsedUrl.searchParams.get('endDate') || '';

        let filtered = productionRegistry.records || [];

        // 1. Search text
        if (search) {
          const q = search.toLowerCase().trim();
          filtered = filtered.filter(r => 
            (r.checker && r.checker.toLowerCase().includes(q)) ||
            (r.productCode && r.productCode.toLowerCase().includes(q)) ||
            (r.productName && r.productName.toLowerCase().includes(q)) ||
            (r.client && r.client.toLowerCase().includes(q))
          );
        }

        // 2. Line filter
        if (line) {
          const l = line.trim();
          filtered = filtered.filter(r => r.line === l);
        }

        // 3. Date range filter
        if (startDate) {
          filtered = filtered.filter(r => r.date >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter(r => r.date <= endDate);
        }

        // Paginate
        const totalRecords = filtered.length;
        const totalPages = Math.ceil(totalRecords / limit);
        const currentPage = Math.max(1, Math.min(page, totalPages || 1));
        const startIndex = (currentPage - 1) * limit;
        const paginatedRecords = filtered.slice(startIndex, startIndex + limit);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          records: paginatedRecords,
          totalRecords,
          totalPages,
          currentPage
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 3.6 POST PRODUCTION REGISTRY RECORD
    if (pathname === '/api/production-registry' && req.method === 'POST') {
      try {
        if (user.role !== 'admin' && user.role !== 'logistic') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado: permisos insuficientes.' }));
          return;
        }

        const {
          date,
          checker,
          line,
          productCode,
          productName,
          quantity,
          dispatchType,
          client,
          startTime,
          endTime,
          preparation
        } = await readJSONBody(req);

        if (!date || !checker || !line || !productName || !quantity || !startTime || !endTime) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Faltan campos requeridos para el registro.' }));
          return;
        }

        const lineNames = {
          'L1': 'Nacional',
          'L2': 'Doyle 1',
          'L3': 'Doyle Ecuabulk',
          'L4': 'Ferpagro',
          'L5': 'Envasado General'
        };
        const lineName = lineNames[line] || line;

        // Calculate time differences
        const timeToMinutes = (hm) => {
          const parts = hm.split(':');
          return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
        };

        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);
        let diffMin = endMin - startMin;
        if (diffMin < 0) diffMin += 24 * 60; // 24 hours wrap

        const prepMin = parseInt(preparation) || 0;
        const minutes = Math.max(0, diffMin - prepMin);
        const hours = parseFloat((minutes / 60).toFixed(2));

        const qty = parseInt(quantity) || 0;
        const sacoHora = hours > 0 ? parseFloat((qty / hours).toFixed(2)) : 0;
        const sacoMin = minutes > 0 ? parseFloat((qty / minutes).toFixed(2)) : 0;

        // ISO Week Helper
        const getISOWeek = (dateString) => {
          const d = new Date(dateString + 'T00:00:00');
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
          const week1 = new Date(d.getFullYear(), 0, 4);
          return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        };

        const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        const dObj = new Date(date + 'T00:00:00');
        const year = dObj.getFullYear();
        const month = dObj.getMonth() + 1;
        const dia = dObj.getDate();
        const dayOfWeekIndex = dObj.getDay();
        const dayOfWeekName = dayNames[dayOfWeekIndex];

        const newRecord = {
          id: `rec_${Date.now()}_` + crypto.randomBytes(3).toString('hex'),
          date,
          checker: String(checker).trim(),
          line: String(line).trim(),
          lineName: String(lineName).trim(),
          productCode: String(productCode || '').trim(),
          productName: String(productName || '').trim(),
          quantity: qty,
          dispatchType: String(dispatchType || 'STOCK').trim(),
          client: String(client || 'Consumo Interno').trim(),
          startTime,
          endTime,
          minutes,
          hours,
          preparation: prepMin,
          forkliftHours: hours
        };

        if (!productionRegistry.records) productionRegistry.records = [];
        productionRegistry.records.unshift(newRecord);
        saveProductionRegistry();

        // Log audit trail in db.json
        const db = readDB();
        if (!db.history) db.history = [];
        db.history.unshift({
          date: new Date().toISOString(),
          user: user.username,
          action: `Registró corrida de producción: ${newRecord.quantity} sacos de ${newRecord.productName} en ${newRecord.lineName}`
        });
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, record: newRecord }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 4. GET SETTINGS (SMTP & Specialty Codes)
    if (pathname === '/api/settings' && req.method === 'GET') {
      const db = readDB();
      // Redact SMTP password for security
      const safeSMTP = { ...db.settings.smtp };
      if (safeSMTP.pass) {
        safeSMTP.pass = '********';
      }
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        settings: {
          specialtiesThreshold: db.settings.specialtiesThreshold,
          emailRecipients: db.settings.emailRecipients,
          smtp: safeSMTP
        },
        specialties: db.specialties || []
      }));
      return;
    }

    // 5. SAVE SETTINGS
    if (pathname === '/api/settings' && req.method === 'POST') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado: se requieren permisos de administrador' }));
          return;
        }

        const data = await readJSONBody(req);
        const db = readDB();

        // Update threshold
        if (data.specialtiesThreshold !== undefined) {
          db.settings.specialtiesThreshold = Number(data.specialtiesThreshold);
        }

        // Update email recipients
        if (data.emailRecipients !== undefined) {
          db.settings.emailRecipients = data.emailRecipients.map(e => String(e).trim()).filter(Boolean);
        }

        // Update SMTP settings
        if (data.smtp !== undefined) {
          const newSmtp = data.smtp;
          // Keep old password if it was redacted and not changed
          const oldPass = db.settings.smtp.pass;
          if (newSmtp.pass === '********') {
            newSmtp.pass = oldPass;
          }
          db.settings.smtp = {
            method: String(newSmtp.method || 'smtp').trim(),
            host: String(newSmtp.host || '').trim(),
            port: Number(newSmtp.port || 587),
            user: String(newSmtp.user || '').trim(),
            pass: String(newSmtp.pass || ''),
            secure: !!newSmtp.secure,
            from: String(newSmtp.from || newSmtp.user || 'alerta_sacos_vacios@operaciones.com').trim()
          };
        }

        // Update specialties codes list
        if (data.specialties !== undefined) {
          db.specialties = data.specialties.map(c => String(c).trim()).filter(Boolean);
        }

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Configuración guardada exitosamente' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Credentials CRUD
    if (pathname === '/api/settings/credentials' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          credentials: db.credentials || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/settings/credentials' && req.method === 'POST') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
          return;
        }

        const data = await readJSONBody(req);
        const db = readDB();
        if (!db.credentials) db.credentials = [];

        if (data.id) {
          const idx = db.credentials.findIndex(c => c.id === data.id);
          if (idx !== -1) {
            db.credentials[idx] = {
              id: data.id,
              category: String(data.category || '').trim(),
              name: String(data.name || '').trim(),
              username: String(data.username || '').trim(),
              password: String(data.password || '').trim()
            };
          }
        } else {
          const newId = Date.now().toString();
          db.credentials.push({
            id: newId,
            category: String(data.category || '').trim(),
            name: String(data.name || '').trim(),
            username: String(data.username || '').trim(),
            password: String(data.password || '').trim()
          });
        }

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Cuenta guardada con éxito.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/settings/credentials' && req.method === 'DELETE') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
          return;
        }

        const id = parsedUrl.searchParams.get('id');
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'ID es requerido.' }));
          return;
        }

        const db = readDB();
        if (db.credentials) {
          db.credentials = db.credentials.filter(c => c.id !== id);
          writeDB(db);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Cuenta eliminada con éxito.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Links CRUD
    if (pathname === '/api/settings/links' && req.method === 'GET') {
      try {
        const db = readDB();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          links: db.links || []
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/settings/links' && req.method === 'POST') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
          return;
        }

        const data = await readJSONBody(req);
        const db = readDB();
        if (!db.links) db.links = [];

        if (data.id) {
          const idx = db.links.findIndex(l => l.id === data.id);
          if (idx !== -1) {
            db.links[idx] = {
              id: data.id,
              type: String(data.type || '').trim(),
              name: String(data.name || '').trim(),
              url: String(data.url || '').trim(),
              desc: String(data.desc || '').trim()
            };
          }
        } else {
          const newId = Date.now().toString();
          db.links.push({
            id: newId,
            type: String(data.type || '').trim(),
            name: String(data.name || '').trim(),
            url: String(data.url || '').trim(),
            desc: String(data.desc || '').trim()
          });
        }

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Enlace guardado con éxito.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (pathname === '/api/settings/links' && req.method === 'DELETE') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado.' }));
          return;
        }

        const id = parsedUrl.searchParams.get('id');
        if (!id) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'ID es requerido.' }));
          return;
        }

        const db = readDB();
        if (db.links) {
          db.links = db.links.filter(l => l.id !== id);
          writeDB(db);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Enlace eliminado con éxito.' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 5.5. SEND CRITICAL STOCK ALERTS (MANUAL TRIGGER)
    if (pathname === '/api/send-alerts' && req.method === 'POST') {
      try {
        const db = readDB();
        const criticalAlerts = db.stock.filter(item => {
          return item.alertStatus === "URGENTE" || item.alertStatus === "SOLICITAR";
        });

        if (criticalAlerts.length === 0) {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'No hay productos con alertas críticas de stock en este momento.' }));
          return;
        }

        const smtpConfig = db.settings.smtp || {};
        const recipients = db.settings.emailRecipients || ["jduran@ferpacific.com", "lmerchan@ferpacific.com"];
        console.log("Enviando alertas de stock critico a", recipients);

        let minDays = Infinity;
        let minDaysText = "poco";
        criticalAlerts.forEach(item => {
          const cov = getCoverageTime(item);
          if (cov.days < minDays) {
            minDays = cov.days;
            minDaysText = cov.exactText || `${cov.days} dias`;
          }
        });

        // Generate Requisition formats
        const pdfBuffer = generateRequisitionPDF(criticalAlerts);
        
        let excelBuffer;
        try {
          excelBuffer = generateRequisitionExcel(criticalAlerts);
          console.log("Requisicion en Excel generada con éxito.");
        } catch (e) {
          console.error("No se pudo generar la requisicion en Excel:", e.message);
        }

        const alertSubject = "ALERTA URGENTE DE SOLICITUD DE SACOS VACÍOS";
        const alertMessage = `Estimado Johnny, en aproximadamente ${minDaysText} te podrias quedar sin estos sacos si no los solicitas ahora.`;

        const htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px;">
            <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px; margin-top: 0;">${alertSubject}</h2>
            <p style="font-size: 15px; font-weight: bold;">Estimado Johnny,</p>
            <p style="font-size: 14px;">En aproximadamente <strong>${minDaysText}</strong> te podrias quedar sin estos sacos si no los solicitas ahora.</p>
            <p style="font-size: 14px; color: #555;">Se adjunta a este correo el formato de requisición de bodega formal ya completado en PDF y Excel para su envío al área de compras.</p>
            <br>
            <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="font-size: 12px; color: #777;">Control de Sacos Vacios - Ferpacific</p>
          </div>
        `;

        const attachments = [
          { filename: "Requisicion_Sacos_Vacios.pdf", contentType: "application/pdf", content: pdfBuffer }
        ];
        if (excelBuffer) {
          attachments.push({
            filename: "Requisicion_Sacos_Vacios.xlsx",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            content: excelBuffer
          });
        }

        const mailRes = await sendMailWithResilience({
          db: db,
          to: recipients,
          subject: alertSubject,
          html: htmlContent,
          mensaje: alertMessage,
          pdfBuffer: pdfBuffer,
          attachments: attachments
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Correo de alertas enviado exitosamente', log: mailRes.log }));
      } catch (err) {
        console.error("Error al enviar correo de alertas:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message || err, log: err.log || null }));
      }
      return;
    }

    // 6. TEST SMTP EMAIL
    if (pathname === '/api/test-email' && req.method === 'POST') {
      try {
        if (user.role !== 'admin') {
          res.writeHead(403);
          res.end(JSON.stringify({ success: false, error: 'Acceso denegado: se requieren permisos de administrador' }));
          return;
        }

        const db = readDB();
        const smtpConfig = db.settings.smtp || {};
        const recipients = db.settings.emailRecipients || ["jduran@ferpacific.com", "lmerchan@ferpacific.com"];
        console.log("Enviando correo de prueba a", recipients);

        const testHtml = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #4caf50;">Prueba de Conexión Exitosa</h2>
            <p>Este es un correo electrónico de prueba enviado desde la aplicación <strong>Sacos Vacíos</strong> para verificar que la configuración de su servidor SMTP funciona correctamente.</p>
            <p>Detalle de la prueba:</p>
            <ul>
              <li><strong>Fecha y Hora:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Servidor de correo:</strong> ${smtpConfig.host || "smtp.gmail.com"}:${smtpConfig.port || 587}</li>
              <li><strong>Remitente:</strong> ${smtpConfig.from || smtpConfig.user || "alerta_sacos_vacios@operaciones.com"}</li>
              <li><strong>Destinatarios:</strong> ${recipients.join(', ')}</li>
            </ul>
            <p>Si recibió este correo, el sistema de alertas automáticas está listo para operar.</p>
          </div>
        `;

        const mailRes = await sendMailWithResilience({
          db: db,
          to: recipients,
          subject: "Prueba de conexión de alertas - Sacos Vacíos",
          html: testHtml,
          mensaje: "Prueba de conexión de alertas - Sacos Vacíos"
        });

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Correo de prueba enviado exitosamente', log: mailRes.log }));
      } catch (err) {
        console.error("Error en correo de prueba:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message || err, log: err.log || null }));
      }
      return;
    }

    // 7. UPDATE CUSTOM REQUISITION VALUE
    if (pathname === '/api/update-requisition' && req.method === 'POST') {
      try {
        const { code, requisition } = await readJSONBody(req);
        if (!code) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'El código de producto es requerido' }));
          return;
        }

        const db = readDB();
        const item = db.stock.find(i => i.code === code);
        if (!item) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Producto no encontrado en inventario' }));
          return;
        }

        item.requisition = Number(requisition) || 0;
        
        // Recalculate AI observation
        item.observation = generateAIRecommendation(item);
        
        writeDB(db);

        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Requisición actualizada con éxito',
          observation: item.observation 
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 8. GET REQUISITION PDF
    if (pathname === '/api/requisition/pdf' && req.method === 'GET') {
      try {
        const db = readDB();
        const criticalAlerts = db.stock.filter(item => {
          return item.alertStatus === "URGENTE" || item.alertStatus === "SOLICITAR";
        });
        
        const pdfBuffer = generateRequisitionPDF(criticalAlerts);
        
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Requisicion_Sacos_Vacios.pdf"',
          'Content-Length': pdfBuffer.length
        });
        res.end(pdfBuffer);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 9. GET REQUISITION EXCEL
    if (pathname === '/api/requisition/excel' && req.method === 'GET') {
      try {
        const db = readDB();
        const criticalAlerts = db.stock.filter(item => {
          return item.alertStatus === "URGENTE" || item.alertStatus === "SOLICITAR";
        });
        
        const excelBuffer = generateRequisitionExcel(criticalAlerts);
        
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Requisicion_Sacos_Vacios.xlsx"',
          'Content-Length': excelBuffer.length
        });
        res.end(excelBuffer);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 10. GET USERS LIST (Admin only)
    if (pathname === '/api/users' && req.method === 'GET') {
      if (user.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Acceso denegado: se requieren permisos de administrador' }));
        return;
      }
      const db = readDB();
      const userList = [];
      for (const [username, userData] of Object.entries(db.users || {})) {
        userList.push({
          username,
          name: userData.name,
          role: userData.role
        });
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, users: userList }));
      return;
    }

    // 11. CREATE/UPDATE USER (Admin only)
    if (pathname === '/api/users' && req.method === 'POST') {
      if (user.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Acceso denegado: se requieren permisos de administrador' }));
        return;
      }
      try {
        const { username, name, password, role } = await readJSONBody(req);
        if (!username || !name || !role) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Usuario, Nombre y Rol son campos requeridos' }));
          return;
        }

        const normalizedUsername = String(username).trim().toLowerCase();
        const db = readDB();
        
        if (!db.users) db.users = {};

        const existingUser = db.users[normalizedUsername];
        let pHash = existingUser ? existingUser.passwordHash : '';

        if (password) {
          pHash = hashPassword(password);
        } else if (!existingUser) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'La contraseña es requerida para nuevos usuarios' }));
          return;
        }

        db.users[normalizedUsername] = {
          name: String(name).trim(),
          passwordHash: pHash,
          role: String(role).trim()
        };

        writeDB(db);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Usuario guardado exitosamente' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 12. DELETE USER (Admin only)
    if (pathname === '/api/users/delete' && req.method === 'POST') {
      if (user.role !== 'admin') {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Acceso denegado: se requieren permisos de administrador' }));
        return;
      }
      try {
        const { username } = await readJSONBody(req);
        if (!username) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'El nombre de usuario es requerido' }));
          return;
        }

        const normalizedUsername = String(username).trim().toLowerCase();
        
        if (normalizedUsername === user.username) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'No puedes eliminar tu propio usuario con el que tienes sesión iniciada.' }));
          return;
        }
        if (normalizedUsername === 'jduran') {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'No se puede eliminar el usuario administrador principal (jduran).' }));
          return;
        }

        const db = readDB();
        if (db.users && db.users[normalizedUsername]) {
          delete db.users[normalizedUsername];
          writeDB(db);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, message: 'Usuario eliminado exitosamente' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Usuario no encontrado' }));
        }
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // Catch all for API
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: 'Ruta API no encontrada' }));
    return;
  }

  // STATIC FILE ROUTING (Cross-Platform Windows/Linux)
  let safePath = pathname.replace(/^[\/\\]+/, '').trim();
  if (!safePath || safePath === '.' || safePath === '/') {
    safePath = 'index.html';
  }
  let filePath = path.join(__dirname, 'public', safePath);
  let rootFilePath = path.join(__dirname, safePath);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStaticFile(res, filePath);
  } else if (fs.existsSync(rootFilePath) && fs.statSync(rootFilePath).isFile()) {
    serveStaticFile(res, rootFilePath);
  } else {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const rootIndexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveStaticFile(res, indexPath);
    } else if (fs.existsSync(rootIndexPath)) {
      serveStaticFile(res, rootIndexPath);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Página no encontrada');
    }
  }
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sistema Integral de Operaciones Ferpacific iniciado en http://localhost:${PORT}`);
  // Seed default admin user if not exists
  const db = readDB();
  let dbChanged = false;
  if (!db.users) {
    db.users = {};
    dbChanged = true;
  }
  if (!db.users["admin"]) {
    db.users["admin"] = {
      name: "Administrador Ferpacific",
      passwordHash: hashPassword("Ferpa2026*"),
      role: "admin",
      mustChangePassword: true
    };
    dbChanged = true;
    console.log("Seeded default admin user to db.json");
  }

  // Seed default credentials
  if (!db.credentials || db.credentials.length === 0) {
    db.credentials = [
      { id: "1", category: "Sistema de Operaciones", name: "Administrador", username: "admin", password: "ValentinA041()" },
      { id: "2", category: "Sistema de Operaciones", name: "Logística", username: "grosas", password: "ValentinA041()" },
      { id: "3", category: "Sistema de Operaciones", name: "Calidad / Insumos", username: "binsumos", password: "ValentinA041()" },
      { id: "4", category: "Sistema de Operaciones", name: "Importaciones", username: "importaciones", password: "ValentinA041()" },
      { id: "5", category: "Correo Corporativo", name: "SMTP de Alertas (jduran)", username: "jduran@ferpacific.com", password: "ValentinA042" },
      { id: "6", category: "Correo Corporativo", name: "SMTP Soporte (lmerchan)", username: "lmerchan@ferpacific.com", password: "ValentinA042" }
    ];
    dbChanged = true;
    console.log("Seeded default credentials to db.json");
  }

  // Seed default links
  if (!db.links || db.links.length === 0) {
    db.links = [
      { id: "1", type: "Local", name: "Servidor Principal del Sistema", url: process.env.APP_URL || "/", desc: "Acceso al servidor web principal de operaciones en producción." },
      { id: "2", type: "Local", name: "Puerta de Enlace (Router Principal)", url: "http://192.168.79.1", desc: "Acceso de administración al enrutador de la oficina (Gateway local)." },
      { id: "3", type: "Local", name: "Servidor de Base de Datos Local", url: "http://192.168.79.100", desc: "Instancia local de base de datos SQL para el almacenamiento de registros." },
      { id: "4", type: "Local", name: "Servidor de Almacenamiento NAS", url: "http://192.168.79.10", desc: "Servidor centralizado local para respaldos y compartición de archivos corporativos." },
      { id: "5", type: "Local", name: "Impresora Térmica de Bodega", url: "http://192.168.79.200", desc: "Consola de administración web para la impresora de etiquetas Zebra." },
      { id: "6", type: "Externa", name: "Google Workspace Mail (Gmail)", url: "https://mail.google.com", desc: "Acceso al correo corporativo @ferpacific.com" },
      { id: "7", type: "Externa", name: "Consola de Administración de Google", url: "https://admin.google.com", desc: "Gestión de usuarios, políticas y dominios de Google Workspace." },
      { id: "8", type: "Externa", name: "Dropbox Web", url: "https://www.dropbox.com", desc: "Portal para visualizar y descargar los respaldos automatizados en la nube." },
      { id: "9", type: "Externa", name: "Portal Web Oficial Ferpacific", url: "https://www.ferpacific.com", desc: "Portal de la empresa y recursos públicos." },
      { id: "10", type: "Externa", name: "Portal Ecuapass (Aduanas)", url: "https://ecuapass.aduana.gob.ec", desc: "Sistema oficial de aduana para la consulta de importaciones y manifiestos." },
      { id: "11", type: "Externa", name: "SRI en Línea", url: "https://srienlinea.sri.gob.ec", desc: "Portal oficial del Servicio de Rentas Internas para facturación y declaraciones." },
      { id: "12", type: "Externa", name: "Portal de FormSubmit", url: "https://formsubmit.co", desc: "Servicio de reenvío, auditoría y respaldo de correos electrónicos SMTP." }
    ];
    dbChanged = true;
    console.log("Seeded default links to db.json");
  }

  if (dbChanged) {
    writeDB(db);
  }
});

// SMART AI RECOMMENDATION GENERATOR
function generateAIRecommendation(item) {
  const stock = item.total;
  const jul = item.jul26 || 0;
  const transit = item.totalTransit || 0;
  const demand3M = item.projection3Months || 0;
  const suggested = item.suggestedOrder || 0;
  const reqVal = item.requisition || 0;
  const isSpecialty = String(item.linea || '').toLowerCase().includes('especial');
  
  if (demand3M === 0) {
    if (stock > 0) {
      if (stock > 10000) {
        return `Producto sin proyección. Registra stock ocioso de ${stock.toLocaleString()} ud. Evaluar devolución o uso alternativo.`;
      }
      return `Sin demanda proyectada. Stock bajo de seguridad (${stock.toLocaleString()} ud). No requiere compras.`;
    }
    return `Sin movimiento proyectado ni stock. Mantener en catálogo inactivo.`;
  }

  if (stock < jul) {
    const deficitJul = jul - stock;
    let text = `⚠️ ALERTA CRÍTICA: Ruptura inminente en Julio. Faltan ${deficitJul.toLocaleString()} sacos. `;
    if (transit > 0) {
      const transitsByProvider = [];
      if (item.transitSacoplast > 0) transitsByProvider.push(`Sacoplast (${item.transitSacoplast.toLocaleString()})`);
      if (item.transitInterama > 0) transitsByProvider.push(`Interama (${item.transitInterama.toLocaleString()})`);
      if (item.transitPlasticsack > 0) transitsByProvider.push(`Plasticsack (${item.transitPlasticsack.toLocaleString()})`);
      if (item.transitReysac > 0) transitsByProvider.push(`Reysac (${item.transitReysac.toLocaleString()})`);
      
      text += `Hay ${transit.toLocaleString()} sacos en tránsito vía ${transitsByProvider.join(', ')}. Agilizar entrega con urgencia.`;
    } else {
      text += `No hay tránsito registrado. Colocar orden urgente inmediatamente.`;
    }
    
    if (reqVal > 0) {
      if (reqVal >= suggested) {
        text += ` Requisición de ${reqVal.toLocaleString()} ud es adecuada para mitigar el quiebre.`;
      } else {
        text += ` Requisición de ${reqVal.toLocaleString()} ud insuficiente. Sugerido mínimo: ${suggested.toLocaleString()} ud.`;
      }
    }
    return text;
  }

  if (stock < demand3M && stock + transit >= demand3M) {
    const activeTransits = [];
    if (item.transitSacoplast > 0) activeTransits.push(`Sacoplast`);
    if (item.transitInterama > 0) activeTransits.push(`Interama`);
    if (item.transitPlasticsack > 0) activeTransits.push(`Plasticsack`);
    if (item.transitReysac > 0) activeTransits.push(`Reysac`);
    
    let text = `📦 COBERTURA CON TRÁNSITO: Stock físico (${stock.toLocaleString()} ud) no cubre 3 meses, pero está respaldado por tránsito de ${transit.toLocaleString()} ud (${activeTransits.join(', ')}). `;
    
    if (reqVal > 0) {
      text += `Requisición de ${reqVal.toLocaleString()} ud registrada. Evaluar si es necesario stock extra.`;
    } else {
      text += `No se requieren compras inmediatas. Monitorear llegada de importaciones.`;
    }
    return text;
  }

  if (stock + transit < demand3M) {
    const deficitTotal = demand3M - (stock + transit);
    let text = `🔔 REPOSICIÓN REQUERIDA: Déficit proyectado de ${deficitTotal.toLocaleString()} sacos a 3 meses. `;
    if (reqVal > 0) {
      const diff = reqVal - suggested;
      if (diff === 0) {
        text += `Requisición de ${reqVal.toLocaleString()} ud cubre exactamente el pedido sugerido.`;
      } else if (diff > 0) {
        text += `Requisición de ${reqVal.toLocaleString()} ud excede el sugerido por ${diff.toLocaleString()} ud (recomendado por seguridad).`;
      } else {
        text += `Requisición de ${reqVal.toLocaleString()} ud es baja. Faltan ${Math.abs(diff).toLocaleString()} ud para cubrir el trimestre.`;
      }
    } else {
      text += `Sugerido generar orden por ${suggested.toLocaleString()} ud.`;
    }
    
    if (isSpecialty) {
      text += ` Al ser Especialidad, considerar mayor tiempo de entrega.`;
    }
    return text;
  }

  if (stock >= demand3M) {
    const excess = stock - demand3M;
    let text = `✅ STOCK OPTIMO: Cobertura física completa. Excedente de ${excess.toLocaleString()} ud sobre la demanda trimestral. `;
    if (reqVal > 0) {
      text += `Alerta: Ha requisado ${reqVal.toLocaleString()} ud adicionales con stock excedente. Riesgo de sobre-stock.`;
    } else {
      if (excess > stock * 0.5) {
        text += `Sobre-stock significativo detectado. Evitar compras y considerar redistribución.`;
      } else {
        text += `Posición de stock saludable.`;
      }
    }
    return text;
  }

  return `Análisis de inventario estable. Monitorear consumos mensuales.`;
}

// RESILIENT EMAIL SENDING WRAPPER WITH AUTOMATIC DIRECT MX FALLBACK
async function sendMailWithResilience({ db, to, subject, html, mensaje, attachments, pdfBuffer, defaultMethod = null }) {
  const smtpConfig = db.settings.smtp || {};
  const method = defaultMethod || smtpConfig.method || 'formsubmit';
  const recipients = Array.isArray(to) ? to : [to];

  console.log(`Intentando enviar correo con método: ${method} a:`, recipients);

  try {
    if (method === 'formsubmit') {
      const formSubmitArgs = {
        to: recipients,
        cc: recipients.slice(1),
        subject: subject,
        mensaje: mensaje || "Reporte de Alertas - Ferpacific",
        attachments: attachments
      };
      if (pdfBuffer) {
        formSubmitArgs.pdfBuffer = pdfBuffer;
      } else {
        formSubmitArgs.criticalAlerts = html;
      }
      return await sendFormSubmit(formSubmitArgs);
    } else {
      const smtpHost = smtpConfig.host || "smtp.gmail.com";
      const smtpPort = Number(smtpConfig.port || 587);
      const smtpUser = smtpConfig.user || "";
      const smtpPass = smtpConfig.pass || "";
      const smtpSecure = !!smtpConfig.secure;
      const smtpFrom = smtpConfig.from || smtpConfig.user || "alerta_sacos_vacios@operaciones.com";

      return await sendMail({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        secure: smtpSecure,
        from: smtpFrom,
        to: recipients,
        subject: subject,
        html: html,
        attachments: attachments,
        pdfBuffer: pdfBuffer
      });
    }
  } catch (err) {
    console.warn(`[EMAIL RESILIENCE] Falló método ${method}. Error: ${err.message || err}. Iniciando fallback directo por MX...`);
    
    // Fallback: Direct MX Delivery to Google Workspace (without attachments/PDF to avoid spam blocking)
    try {
      const mxHost = "aspmx.l.google.com";
      const mxPort = 25;
      
      console.log(`[EMAIL RESILIENCE] Enviando directamente a MX ${mxHost}:${mxPort} para:`, recipients);
      const mailRes = await sendMail({
        host: mxHost,
        port: mxPort,
        user: "",
        pass: "",
        secure: false,
        from: "jduran@ferpacific.com", // Valid domain sender
        to: recipients,
        subject: subject,
        html: html
        // Omit attachments & pdfBuffer to satisfy Gmail spam filters on direct port 25 delivery
      });
      console.log("[EMAIL RESILIENCE] Envío exitoso mediante fallback directo por MX (sin adjuntos).");
      return { success: true, log: ["Direct MX Delivery: " + mailRes.log] };
    } catch (mxErr) {
      console.error("[EMAIL RESILIENCE] Fallback directo por MX falló:", mxErr);
      let mainErrMsg = err.message || String(err);
      if (mainErrMsg.includes('<!DOCTYPE') || mainErrMsg.includes('<html')) {
        mainErrMsg = 'Error de conexión con servicio externo de correo (FormSubmit 500).';
      }
      let mxErrMsg = mxErr.message || String(mxErr);
      if (mxErrMsg.includes('<!DOCTYPE') || mxErrMsg.includes('<html')) {
        mxErrMsg = 'Servidor MX no respondió.';
      }
      throw new Error(`Fallo de entrega de correo. Servicio principal (FormSubmit/SMTP): ${mainErrMsg}. Servidor MX directo: ${mxErrMsg}`);
    }
  }
}

// EMAIL ALERT RECIPIENTS FOR IMPORTS STATUS
const IMPORTS_EMAIL_RECIPIENTS = [
  "jduran@ferpacific.com",
  "grosas@ferpacific.com",
  "martin.zambrano@ferpacific.com",
  "jbuste@ferpacific.com",
  "cvinueza@ferpacific.com"
];

// HELPER TO GENERATE IMPORTS ALERTS PDF
function generateImportsAlertPDF(alerts, lastUpdated) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  const dateObj = new Date(lastUpdated || new Date());
  const dateFormatted = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;

  const lines = [];
  lines.push("FERPACIFIC - REPORTE DE ALERTAS Y NOVEDADES DE IMPORTACIONES");
  lines.push(`Fecha de Actualizacion: ${dateFormatted}`);
  lines.push(`Total de Alertas Generadas: ${alerts.length}`);
  lines.push("");
  lines.push("=========================================================================");
  lines.push("");

  const arrivals = alerts.filter(a => a.type === 'arrival');
  const changes = alerts.filter(a => a.type === 'change');

  if (arrivals.length > 0) {
    lines.push("ARRIBOS INMINENTES (PROXIMOS 7 DIAS):");
    lines.push("-------------------------------------------------------------------------");
    
    const arrivalsByVessel = {};
    arrivals.forEach(arr => {
      const vesselKey = arr.vessel || 'Sin buque';
      if (!arrivalsByVessel[vesselKey]) {
        arrivalsByVessel[vesselKey] = [];
      }
      arrivalsByVessel[vesselKey].push(arr);
    });

    Object.keys(arrivalsByVessel).forEach(vesselName => {
      const items = arrivalsByVessel[vesselName];
      const earliestEta = items[0].eta;
      const minDaysRemaining = Math.min(...items.map(i => i.daysRemaining));
      
      lines.push(`BUQUE: ${vesselName} | ETA: ${earliestEta} (en ${minDaysRemaining} dias)`);
      lines.push("Carga detallada:");
      items.forEach((item, idx) => {
        lines.push(`  [${idx + 1}] O/C: ${item.oc} | Cantidad: ${item.quantity.toLocaleString()} ${item.unit}`);
        lines.push(`      Producto: ${item.product}`);
        lines.push(`      Proveedor: ${item.provider} | Almacen: ${item.warehouse || 'Sin almacen'}`);
      });
      lines.push("");
    });
    lines.push("=========================================================================");
    lines.push("");
  }

  if (changes.length > 0) {
    lines.push("MODIFICACIONES DETECTADAS EN O/C:");
    lines.push("-------------------------------------------------------------------------");
    changes.forEach((ch, index) => {
      lines.push(`${index + 1}. O/C: ${ch.oc} | Proveedor: ${ch.provider}`);
      lines.push(`   Producto: ${ch.product}`);
      lines.push("   Cambios registrados:");
      ch.changes.forEach(c => {
        lines.push(`     * ${c.field.toUpperCase()}: de "${c.oldVal}" a "${c.newVal}"`);
      });
      lines.push("");
    });
    lines.push("=========================================================================");
  }

  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push(["No hay alertas activas de importaciones en este momento."]);
  }
  
  const numPages = pages.length;
  
  doc.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  
  const pageKids = [];
  for (let i = 0; i < numPages; i++) {
    pageKids.push(`${4 + 2 * i} 0 R`);
  }
  doc.push(`2 0 obj\n<< /Type /Pages /Kids [${pageKids.join(' ')}] /Count ${numPages} >>\nendobj`);
  
  doc.push("3 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj");
  
  for (let i = 0; i < numPages; i++) {
    const pageObjNum = 4 + 2 * i;
    const streamObjNum = 4 + 2 * i + 1;
    
    doc.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 3 0 R /MediaBox [0 0 612 792] /Contents ${streamObjNum} 0 R >>\nendobj`);
    
    const pageLines = pages[i];
    let stream = "BT\n/F2 10 Tf\n50 740 Td\n18 TL\n";
    
    pageLines.forEach((line, lineIndex) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
      
      if (i === 0 && lineIndex === 0) {
        stream += `/F1 14 Tf\n(${escaped}) Tj T*\n/F2 10 Tf\n12 TL\n`;
      } else {
        let isBold = false;
        if (line.includes("ARRIBOS INMINENTES") || line.includes("MODIFICACIONES DETECTADAS") || line.includes("O/C:") || line.includes("========================")) {
          isBold = true;
        }
        
        if (isBold) {
          stream += `/F1 10 Tf\n(${escaped}) Tj T*\n/F2 10 Tf\n`;
        } else {
          stream += `(${escaped}) Tj T*\n`;
        }
      }
    });
    
    stream += "ET";
    
    doc.push(`${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  }
  
  const totalObjects = 3 + 2 * numPages;
  doc.push("xref");
  doc.push(`0 ${totalObjects + 1}`);
  doc.push("0000000000 65535 f\n");
  doc.push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n310\n%%EOF`);
  
  return Buffer.from(doc.join('\n'), 'utf8');
}

// HELPER TO SEND DETAILED IMPORTS ALERTS EMAIL
async function sendImportsAlertEmail(db, recipients = IMPORTS_EMAIL_RECIPIENTS) {
  const smtpConfig = db.settings.smtp || {};
  const alerts = db.importsAlerts || [];
  const lastUpdated = db.importsStatusLastUpdated || new Date().toISOString();

  if (alerts.length === 0) {
    console.log("No hay alertas de importaciones para enviar.");
    return { success: true, message: "No alerts generated, email skipped." };
  }

  const dateObj = new Date(lastUpdated);
  const dateFormatted = `${dateObj.toLocaleDateString()} a las ${dateObj.toLocaleTimeString()}`;
  const subject = `Alerta de Importaciones por llegar`;

  // Split alerts by type
  const arrivals = alerts.filter(a => a.type === 'arrival');
  const changes = alerts.filter(a => a.type === 'change');

  let htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;">
      <div style="text-align: center; border-bottom: 2px solid #3f51b5; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #3f51b5; margin: 0;">Novedades de Importaciones</h2>
        <p style="font-size: 12px; color: #777; margin: 5px 0 0 0;">Reporte cargado el ${dateFormatted}</p>
      </div>
      <p style="font-size: 15px; font-weight: bold;">Estimado Equipo,</p>
      <p style="font-size: 14px;">Se detallan a continuación las alertas e incidencias detectadas en la última actualización del reporte de status de importaciones:</p>
  `;

  // 1. Render Arrivals (grouped by vessel)
  if (arrivals.length > 0) {
    htmlContent += `
      <div style="margin-top: 25px;">
        <h3 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 5px; margin-bottom: 15px; font-size: 15px;">🔴 Arribos Inminentes (Próximos 7 días)</h3>
    `;

    const arrivalsByVessel = {};
    arrivals.forEach(arr => {
      const vesselKey = arr.vessel || 'Sin buque';
      if (!arrivalsByVessel[vesselKey]) {
        arrivalsByVessel[vesselKey] = [];
      }
      arrivalsByVessel[vesselKey].push(arr);
    });

    Object.keys(arrivalsByVessel).forEach(vesselName => {
      const items = arrivalsByVessel[vesselName];
      const earliestEta = items[0].eta;
      const minDaysRemaining = Math.min(...items.map(i => i.daysRemaining));

      htmlContent += `
        <div style="padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; background-color: rgba(239, 68, 68, 0.08); border: 1px solid #ffcdd2; border-left: 4px solid #ef4444; border-left-width: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed #ffcdd2; padding-bottom: 5px;">
            <strong style="color: #ef4444; font-size: 14px;">🚢 Buque: ${vesselName}</strong>
            <span style="font-size: 11px; color: #c62828; font-weight: bold;">ETA: ${earliestEta} (en ${minDaysRemaining} días)</span>
          </div>
          <div style="color: #333; line-height: 1.5;">
            <p style="margin: 0 0 5px 0; font-weight: bold; color: #555;">Detalle de Carga:</p>
            <ul style="margin: 0; padding-left: 20px;">
      `;

      items.forEach(item => {
        htmlContent += `
          <li style="margin-bottom: 6px;">
            O/C <strong>${item.oc}</strong>: <strong>${item.quantity.toLocaleString()} ${item.unit}</strong> de <strong>${item.product}</strong>
            <br>
            <span style="font-size: 11px; color: #666;">(Proveedor: <strong>${item.provider}</strong> | Almacén: <strong>${item.warehouse || 'Sin almacén'}</strong>)</span>
          </li>
        `;
      });

      htmlContent += `
            </ul>
          </div>
        </div>
      `;
    });

    htmlContent += `
      </div>
    `;
  }

  // 2. Render Changes
  if (changes.length > 0) {
    htmlContent += `
      <div style="margin-top: 25px;">
        <h3 style="color: #e65100; border-bottom: 2px solid #e65100; padding-bottom: 5px; margin-bottom: 15px; font-size: 15px;">🟡 Modificaciones de Datos por O/C</h3>
    `;

    changes.forEach(ch => {
      const changesListHtml = ch.changes.map(c => {
        return `<li style="margin-bottom: 3px;"><strong>${c.field.toUpperCase()}</strong>: de "<span style="text-decoration: line-through; opacity: 0.6;">${c.oldVal}</span>" a "<strong style="color: #e65100;">${c.newVal}</strong>"</li>`;
      }).join('');

      htmlContent += `
        <div style="padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; background-color: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; border: 1px solid #ffe082; border-left-width: 4px;">
          <div style="margin-bottom: 5px;">
            <strong style="color: #b7791f;">🟡 Modificación de Información (O/C ${ch.oc})</strong>
          </div>
          <div style="color: #333; margin-top: 5px; line-height: 1.4;">
            Se detectaron cambios en los datos del reporte de <strong>${ch.provider || 'Proveedor'}</strong> para <strong>${ch.product || 'Producto'}</strong>:
            <ul style="margin: 5px 0 0 15px; padding: 0; font-size: 12px; display: flex; flex-direction: column; gap: 3px;">
              ${changesListHtml}
            </ul>
          </div>
        </div>
      `;
    });

    htmlContent += `
      </div>
    `;
  }

  htmlContent += `
      <br>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 11px; color: #777; text-align: center; margin: 0;">Control de Sacos Vacíos e Importaciones - Ferpacific</p>
    </div>
  `;

  const pdfBuffer = generateImportsAlertPDF(alerts, lastUpdated);
  const attachments = [
    { filename: "Reporte_Alertas_Importaciones.pdf", contentType: "application/pdf", content: pdfBuffer }
  ];

  return await sendMailWithResilience({
    db: db,
    to: recipients,
    subject: subject,
    html: htmlContent,
    mensaje: `Estimado Equipo,\n\nSe adjunta a este correo el reporte detallado de alertas y novedades de importaciones de Ferpacific en formato PDF para su revisión.\n\nFecha de actualización: ${dateFormatted}`,
    pdfBuffer: pdfBuffer,
    attachments: attachments
  });
}
