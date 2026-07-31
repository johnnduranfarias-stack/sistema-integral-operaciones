const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

function sendMultipartFormSubmit() {
  const boundary = '----NodeFormBoundary' + crypto.randomBytes(8).toString('hex');
  const recipient = 'jduran@ferpacific.com';
  
  const fields = {
    _subject: "ALERTA URGENTE DE SOLICITUD DE SACOS VACÍOS",
    _cc: "lmerchan@ferpacific.com",
    mensaje: "Estimado Johnny, en muy poco tiempo te podrias quedar sin estos sacos si no los solicitas ahora.",
    _replyto: "no-reply@operaciones.com"
  };

  const pdfBuffer = fs.readFileSync('C:\\Users\\JDURAN1\\.gemini\\antigravity\\scratch\\sacos-vacios-app\\test_output.pdf');

  let payload = [];

  // Add fields
  for (const [key, val] of Object.entries(fields)) {
    payload.push(`--${boundary}`);
    payload.push(`Content-Disposition: form-data; name="${key}"`);
    payload.push('');
    payload.push(val);
  }

  // Add file
  payload.push(`--${boundary}`);
  payload.push(`Content-Disposition: form-data; name="attachment"; filename="Alerta_Sacos_Vacios.pdf"`);
  payload.push(`Content-Type: application/pdf`);
  payload.push('');
  
  const headerBuffer = Buffer.from(payload.join('\r\n') + '\r\n', 'utf8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

  const totalLength = headerBuffer.length + pdfBuffer.length + footerBuffer.length;

  const options = {
    hostname: 'formsubmit.co',
    port: 443,
    path: `/ajax/${recipient}`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalLength,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
      'Origin': 'http://localhost:3000',
      'Referer': 'http://localhost:3000/'
    }
  };

  console.log("Enviando petición multipart a FormSubmit.co...");
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      console.log("Respuesta recibida (Código " + res.statusCode + "):", body);
    });
  });

  req.on('error', (e) => {
    console.error("Error:", e);
  });

  req.write(headerBuffer);
  req.write(pdfBuffer);
  req.write(footerBuffer);
  req.end();
}

sendMultipartFormSubmit();
