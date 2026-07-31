const { sendMail } = require('./smtp.js');

async function testDirectSend() {
  console.log("Iniciando prueba de Direct Send a Google MX...");
  try {
    const res = await sendMail({
      host: "aspmx.l.google.com",
      port: 25,
      user: "",
      pass: "",
      secure: false,
      from: "alerta_sacos_vacios@operaciones.com",
      to: ["jduran@ferpacific.com", "lmerchan@ferpacific.com"],
      subject: "Prueba de Alerta Directa - Sacos Vacíos",
      html: "<h3>Prueba de envío directo a Google MX</h3><p>Este correo se envió directamente al servidor MX de Google sin autenticación.</p>"
    });
    console.log("Resultado exitoso:", res);
  } catch (err) {
    console.error("Error en la prueba:", err);
  }
}

testDirectSend();
