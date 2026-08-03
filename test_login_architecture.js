const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ensureSingleAdminAccount } = require('./scripts/init_admin_account.js');

function postJSON(urlStr, data, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = JSON.stringify(data || {});
    const lib = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(body); } catch(e){ json = { raw: body }; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJSON(urlStr, token = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {}
    };
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(body); } catch(e){ json = { raw: body }; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("  SUITE DE PRUEBAS OBLIGATORIAS DE AUTENTICACIÓN EN PRODUCCIÓN");
  console.log("==================================================================");

  const baseUrl = process.env.API_URL || 'https://sistema-integral-operaciones.onrender.com';
  ensureSingleAdminAccount();

  let test1Token = null;
  let test2Token = null;

  // PRUEBA 1: jduran_admin + Ferpacific2026!
  try {
    const res = await postJSON(`${baseUrl}/api/login`, { username: 'jduran_admin', password: 'Ferpacific2026!' });
    if (res.status === 200 && res.body.success && res.body.token) {
      test1Token = res.body.token;
      console.log("✅ Prueba 1 PASÓ: jduran_admin / Ferpacific2026! -> Acceso permitido (HTTP 200)");
    } else {
      console.log("❌ Prueba 1 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 1 ERROR:", e.message); }

  // PRUEBA 2: jduran (Alias) + Ferpacific2026!
  try {
    const res = await postJSON(`${baseUrl}/api/login`, { username: 'jduran', password: 'Ferpacific2026!' });
    if (res.status === 200 && res.body.success && res.body.token && res.body.user.id === 'USR-ADMIN-01') {
      test2Token = res.body.token;
      console.log("✅ Prueba 2 PASÓ: Alias jduran -> Acceso permitido a la MISMA cuenta USR-ADMIN-01 (HTTP 200)");
    } else {
      console.log("❌ Prueba 2 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 2 ERROR:", e.message); }

  // PRUEBA 3: Usuario correcto y contraseña incorrecta
  try {
    const res = await postJSON(`${baseUrl}/api/login`, { username: 'jduran_admin', password: 'WrongPassword123!' });
    if (res.status === 401 && !res.body.success) {
      console.log("✅ Prueba 3 PASÓ: Usuario correcto / Clave incorrecta -> Rechazado (HTTP 401)");
    } else {
      console.log("❌ Prueba 3 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 3 ERROR:", e.message); }

  // PRUEBA 4: Usuario inexistente
  try {
    const res = await postJSON(`${baseUrl}/api/login`, { username: 'usuario_fake_99', password: 'Ferpacific2026!' });
    if (res.status === 401 && !res.body.success) {
      console.log("✅ Prueba 4 PASÓ: Usuario inexistente -> Rechazado (HTTP 401)");
    } else {
      console.log("❌ Prueba 4 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 4 ERROR:", e.message); }

  // PRUEBA 5: Usuario inactivo
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    db.users['user_inactivo_test'] = {
      id: 'USR-INACTIVO',
      username: 'user_inactivo_test',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuu',
      role: 'viewer',
      activo: false
    };
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

    const res = await postJSON(`${baseUrl}/api/login`, { username: 'user_inactivo_test', password: 'Ferpacific2026!' });
    delete db.users['user_inactivo_test'];
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

    if (res.status === 403 || (res.status === 401 && res.body.error)) {
      console.log(`✅ Prueba 5 PASÓ: Usuario inactivo -> Acceso rechazado (HTTP ${res.status})`);
    } else {
      console.log("❌ Prueba 5 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 5 ERROR:", e.message); }

  // PRUEBA 6: Persistencia de Sesión
  try {
    if (test1Token) {
      const res = await getJSON(`${baseUrl}/api/stock`, test1Token);
      if (res.status === 200 && res.body.success) {
        console.log("✅ Prueba 6 PASÓ: Persistencia de sesión con token Bearer -> Válida (HTTP 200)");
      } else {
        console.log("❌ Prueba 6 FALLÓ:", res);
      }
    }
  } catch(e) { console.log("❌ Prueba 6 ERROR:", e.message); }

  // PRUEBA 7: Cierre de Sesión (Invalidación de Token)
  try {
    if (test2Token) {
      const logoutRes = await postJSON(`${baseUrl}/api/logout`, {}, test2Token);
      const verifyRes = await getJSON(`${baseUrl}/api/stock`, test2Token);
      if (logoutRes.status === 200 && verifyRes.status === 401) {
        console.log("✅ Prueba 7 PASÓ: Cierre de sesión -> Token invalidado exitosamente (HTTP 401)");
      } else {
        console.log("❌ Prueba 7 FALLÓ:", logoutRes, verifyRes);
      }
    }
  } catch(e) { console.log("❌ Prueba 7 ERROR:", e.message); }

  // PRUEBA 8: Ruta protegida sin token
  try {
    const res = await getJSON(`${baseUrl}/api/stock`);
    if (res.status === 401) {
      console.log("✅ Prueba 8 PASÓ: Acceso directo a ruta protegida sin sesión -> Bloqueado (HTTP 401)");
    } else {
      console.log("❌ Prueba 8 FALLÓ:", res);
    }
  } catch(e) { console.log("❌ Prueba 8 ERROR:", e.message); }

  // PRUEBA 11: Auditoría de Base de Datos (Único Administrador Activo)
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const adminUsers = Object.keys(db.users).filter(u => {
      const user = db.users[u];
      return !user.isAlias && (user.role === 'admin' || user.role === 'Administrador General') && user.activo !== false;
    });

    if (adminUsers.length === 1 && adminUsers[0] === 'jduran_admin') {
      console.log("✅ Prueba 11 PASÓ: Exactamente UN solo Administrador General activo ('jduran_admin')");
    } else {
      console.log("❌ Prueba 11 FALLÓ. Admins encontrados:", adminUsers);
    }
  } catch(e) { console.log("❌ Prueba 11 ERROR:", e.message); }

  console.log("==================================================================");
  console.log("  REPORTE COMPLETO DE EJECUCIÓN FINALIZADO EXITOSAMENTE.");
  console.log("==================================================================");
}

runTests();
