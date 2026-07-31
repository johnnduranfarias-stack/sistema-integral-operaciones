const http = require('https');

function sendFormSubmitEmail() {
  const data = JSON.stringify({
    _subject: "Prueba Alerta - Sacos Vacíos",
    _cc: "lmerchan@ferpacific.com",
    mensaje: "Esta es una alerta de prueba usando el servicio FormSubmit.",
    detalles: "Físico: 10,000 | Tránsito: 5,000 | Sugerido: 5,000"
  });

  const options = {
    hostname: 'formsubmit.co',
    port: 443,
    path: '/ajax/jduran@ferpacific.com',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
      'Origin': 'http://localhost:3000',
      'Referer': 'http://localhost:3000/'
    }
  };

  console.log("Enviando petición a FormSubmit.co con cabeceras de navegador...");
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (d) => {
      body += d;
    });
    res.on('end', () => {
      console.log("Respuesta recibida (Código " + res.statusCode + "):", body);
    });
  });

  req.on('error', (e) => {
    console.error("Error enviando:", e);
  });

  req.write(data);
  req.end();
}

sendFormSubmitEmail();
