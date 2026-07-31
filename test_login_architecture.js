const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log("==================================================================");
console.log("🤖 EJECUTANDO SUITE DE PRUEBAS AUTOMATIZADAS DE ARQUITECTURA DE LOGIN");
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [APROBADO] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FALLIDO] ${message}`);
    failed++;
  }
}

function makeRequest(method, pathUrl, payload = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': '1',
      ...headers
    };

    const req = http.request({
      hostname: 'localhost',
      port: 80,
      path: pathUrl,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {}
        resolve({ status: res.statusCode, body, json, contentType: res.headers['content-type'] });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });

    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function runTests() {
  // PRUEBA 1: Conexión con Base de Datos y Estructura
  console.log("--- 1. Prueba de Base de Datos y Estructura ---");
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const dbExists = fs.existsSync(dbPath);
    assert(dbExists, "El archivo de base de datos db.json existe.");

    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert(db && typeof db.users === 'object', "Objeto db.users cargado correctamente.");
    assert(db.users['jduran_admin'] !== undefined, "Usuario Administrador Principal 'jduran_admin' existe.");
  } catch (err) {
    assert(false, `Error comprobando base de datos: ${err.message}`);
  }

  // PRUEBA 2: Endpoint Health (GET /api/health)
  console.log("\n--- 2. Prueba del Endpoint GET /api/health ---");
  const healthRes = await makeRequest('GET', '/api/health');
  assert(healthRes.status === 200, `GET /api/health responde HTTP 200 OK (Recibido: ${healthRes.status}).`);
  assert(healthRes.json && healthRes.json.status === 'ok', "Respuesta de Health incluye status 'ok'.");
  assert(healthRes.json && healthRes.json.dbStatus === 'connected', "Respuesta de Health confirma dbStatus 'connected'.");

  // PRUEBA 3: Endpoint Login con Credenciales Válidas (POST /api/login)
  console.log("\n--- 3. Prueba de Autenticación con Credenciales Válidas ---");
  const validLoginRes = await makeRequest('POST', '/api/login', { username: 'jduran_admin', password: 'FerpaAdmin2026*' });
  assert(validLoginRes.status === 200, `POST /api/login con clave válida responde HTTP 200 (Recibido: ${validLoginRes.status}).`);
  assert(validLoginRes.json && validLoginRes.json.success === true, "Respuesta contiene success: true.");
  assert(validLoginRes.json && typeof validLoginRes.json.token === 'string', "Respuesta incluye token de sesión generado.");
  assert(validLoginRes.json && validLoginRes.json.user.role === 'admin', "Respuesta incluye datos de usuario con rol 'admin'.");

  // PRUEBA 4: Endpoint Login con Contraseña Incorrecta
  console.log("\n--- 4. Prueba de Autenticación con Contraseña Incorrecta ---");
  const invalidPassRes = await makeRequest('POST', '/api/login', { username: 'jduran_admin', password: 'ClaveIncorrecta123*' });
  assert(invalidPassRes.status === 401, `POST /api/login con clave incorrecta responde HTTP 401 (Recibido: ${invalidPassRes.status}).`);
  assert(invalidPassRes.json && invalidPassRes.json.success === false, "Respuesta contiene success: false.");
  assert(invalidPassRes.json && invalidPassRes.json.error === 'Usuario o contraseña incorrectos', "Mensaje amigable de credenciales incorrectas.");

  // PRUEBA 5: Endpoint Login con Usuario Inexistente
  console.log("\n--- 5. Prueba de Autenticación con Usuario Inexistente ---");
  const noUserRes = await makeRequest('POST', '/api/login', { username: 'usuario_fantasma_99', password: 'CualquierClave*' });
  assert(noUserRes.status === 401, `POST /api/login con usuario inexistente responde HTTP 401 (Recibido: ${noUserRes.status}).`);
  assert(noUserRes.json && noUserRes.json.success === false, "Respuesta contiene success: false.");

  // PRUEBA 6: Endpoint Login con Datos Incompletos (Campos Vacíos)
  console.log("\n--- 6. Prueba de Datos Incompletos ---");
  const emptyRes = await makeRequest('POST', '/api/login', { username: '', password: '' });
  assert(emptyRes.status === 400, `POST /api/login con campos vacíos responde HTTP 400 (Recibido: ${emptyRes.status}).`);

  // PRUEBA 7: Endpoint Inexistente (Garantizar 404 Estructurado)
  console.log("\n--- 7. Prueba de Endpoint Inexistente ---");
  const authToken = validLoginRes.json ? validLoginRes.json.token : '';
  const nonExistentRes = await makeRequest('GET', '/api/ruta_desconocida_xyz', null, { 'Authorization': `Bearer ${authToken}` });
  assert(nonExistentRes.status === 404, `GET /api/ruta_desconocida_xyz responde HTTP 404 (Recibido: ${nonExistentRes.status}).`);
  assert(nonExistentRes.json && nonExistentRes.json.error === 'Ruta API no encontrada', "Endpoint inexistente devuelve JSON 404 estructurado.");

  console.log("\n==================================================================");
  console.log(`RESUMEN DE PRUEBAS AUTOMATIZADAS: ${passed} APROBADAS, ${failed} FALLIDAS`);
  console.log("==================================================================");
  if (failed === 0) {
    console.log("🎉 TODAS LAS PRUEBAS DE LA ARQUITECTURA DE LOGIN PASARON EXITOSAMENTE.");
    process.exit(0);
  } else {
    console.error("❌ ALGUNAS PRUEBAS FALLARON.");
    process.exit(1);
  }
}

runTests();
