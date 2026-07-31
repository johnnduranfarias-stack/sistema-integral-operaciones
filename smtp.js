const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('./xlsx.js');

function wrapBase64(base64Str) {
  const lines = [];
  for (let i = 0; i < base64Str.length; i += 76) {
    lines.push(base64Str.substring(i, i + 76));
  }
  return lines.join('\r\n');
}

function sendMail({ host, port, user, pass, secure, from, to, subject, html, attachments, pdfBuffer }) {
  return new Promise((resolve, reject) => {
    if (!host) {
      return reject(new Error("Configuración SMTP incompleta (se requiere host del servidor)."));
    }

    const recipients = Array.isArray(to) ? to : [to];
    let socket;
    let secureSocket;
    let step = 0;
    let responseBuffer = '';

    const log = [];
    function addLog(msg) {
      log.push(msg);
    }

    function cleanup() {
      if (secureSocket) secureSocket.destroy();
      if (socket) socket.destroy();
    }

    function handleData(data) {
      responseBuffer += data.toString();
      while (responseBuffer.includes('\n')) {
        const lineEnd = responseBuffer.indexOf('\n');
        const line = responseBuffer.substring(0, lineEnd).trim();
        responseBuffer = responseBuffer.substring(lineEnd + 1);
        addLog("S: " + line);
        processLine(line);
      }
    }

    function sendCommand(cmd) {
      const socketToUse = secureSocket || socket;
      addLog("C: " + cmd.replace(/\r\n$/, '').replace(/AUTH LOGIN|([A-Za-z0-9+/=]{10,})/g, (m) => m.startsWith('AUTH') ? m : '[REDANTED/BASE64]'));
      socketToUse.write(cmd);
    }

    function processLine(line) {
      const code = line.substring(0, 3);
      const isMultiline = line.charAt(3) === '-';
      if (isMultiline) {
        // Wait for the final line of multiline response (which will have a space after the code)
        return;
      }

      if (secure && step === 0) {
        // Direct TLS connection, first line should be 220
        if (code === '220') {
          step = 2; // skip starttls
          sendCommand(`EHLO ferpacific.com\r\n`);
        } else {
          fail(`Respuesta de saludo inesperada: ${line}`);
        }
      } else if (!secure && step === 0) {
        // Plain connection, first line should be 220
        if (code === '220') {
          step = 1;
          sendCommand(`EHLO ferpacific.com\r\n`);
        } else {
          fail(`Respuesta de saludo inesperada: ${line}`);
        }
      } else if (step === 1) {
        // Sent EHLO, check response. Since it might support STARTTLS, let's check
        if (code === '250') {
          // Send STARTTLS if not secure, or authenticate if secure
          step = 1.5;
          sendCommand(`STARTTLS\r\n`);
        } else {
          fail(`Error después de EHLO: ${line}`);
        }
      } else if (step === 1.5) {
        // Sent STARTTLS, server should respond 220
        if (code === '220') {
          // Upgrade socket to TLS!
          addLog("Iniciando negociación TLS (STARTTLS)...");
          socket.removeListener('data', handleData);
          socket.removeListener('error', handleError);
          
          secureSocket = tls.connect({
            socket: socket,
            host: host,
            rejectUnauthorized: false // Permite certificados auto-firmados en intranets
          }, () => {
            addLog("Conexión TLS establecida mediante STARTTLS.");
            // Send EHLO again over TLS
            step = 2;
            sendCommand(`EHLO ferpacific.com\r\n`);
          });

          secureSocket.on('data', handleData);
          secureSocket.on('error', handleError);
        } else {
          // Server doesn't support STARTTLS, continue
          addLog("Servidor no aceptó STARTTLS, continuando...");
          if (user && pass) {
            step = 3;
            sendCommand(`AUTH LOGIN\r\n`);
          } else {
            step = 6;
            sendCommand(`MAIL FROM:<${from}>\r\n`);
          }
        }
      } else if (step === 2) {
        // Sent EHLO over TLS
        if (code === '250') {
          if (user && pass) {
            step = 3;
            sendCommand(`AUTH LOGIN\r\n`);
          } else {
            step = 6;
            sendCommand(`MAIL FROM:<${from}>\r\n`);
          }
        } else {
          fail(`Error después de EHLO sobre TLS: ${line}`);
        }
      } else if (step === 3) {
        // Sent AUTH LOGIN, should expect 334 (Username challenge)
        if (code === '334') {
          step = 4;
          const userBase64 = Buffer.from(user).toString('base64');
          sendCommand(`${userBase64}\r\n`);
        } else {
          fail(`Error en AUTH LOGIN: ${line}`);
        }
      } else if (step === 4) {
        // Sent Username, should expect 334 (Password challenge)
        if (code === '334') {
          step = 5;
          const passBase64 = Buffer.from(pass).toString('base64');
          sendCommand(`${passBase64}\r\n`);
        } else {
          fail(`Error de usuario SMTP: ${line}`);
        }
      } else if (step === 5) {
        // Sent Password, should expect 235 (Auth successful)
        if (code === '235') {
          step = 6;
          sendCommand(`MAIL FROM:<${from}>\r\n`);
        } else {
          fail(`Error de autenticación SMTP (contraseña incorrecta): ${line}`);
        }
      } else if (step === 6) {
        // Sent MAIL FROM, expect 250
        if (code === '250') {
          step = 7;
          recipientIndex = 0;
          sendNextRecipient();
        } else {
          fail(`Error en MAIL FROM: ${line}`);
        }
      } else if (step === 7) {
        // Sent RCPT TO, expect 250
        if (code === '250' || code === '251') {
          recipientIndex++;
          if (recipientIndex < recipients.length) {
            sendNextRecipient();
          } else {
            step = 8;
            sendCommand(`DATA\r\n`);
          }
        } else {
          fail(`Error en RCPT TO para <${recipients[recipientIndex]}>: ${line}`);
        }
      } else if (step === 8) {
        // Sent DATA, expect 354
        if (code === '354') {
          step = 9;
          
          // Format headers and body
          const encodedSubject = '=?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=';
          const toHeader = recipients.join(', ');
          const messageId = `<${crypto.randomBytes(16).toString('hex')}@ferpacific.com>`;
          const dateHeader = new Date().toUTCString();
          
          let rawMessage;
          if (attachments && attachments.length > 0) {
            const boundary = '----Boundary_SacosVacios_' + crypto.randomBytes(8).toString('hex');
            
            const rawMessageParts = [
              `From: "Alertas Sacos Vacios" <${from}>`,
              `To: ${toHeader}`,
              `Subject: ${encodedSubject}`,
              `Message-ID: ${messageId}`,
              `Date: ${dateHeader}`,
              `Mime-Version: 1.0`,
              `Content-Type: multipart/mixed; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/html; charset=utf-8`,
              `Content-Transfer-Encoding: 7bit`,
              ``,
              html,
              ``
            ];

            attachments.forEach(att => {
              rawMessageParts.push(`--${boundary}`);
              rawMessageParts.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
              rawMessageParts.push(`Content-Transfer-Encoding: base64`);
              rawMessageParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
              rawMessageParts.push(``);
              rawMessageParts.push(wrapBase64(att.content.toString('base64')));
              rawMessageParts.push(``);
            });

            rawMessageParts.push(`--${boundary}--`);
            rawMessageParts.push(`.`);
            
            rawMessage = rawMessageParts.join('\r\n') + '\r\n';
          } else if (pdfBuffer) {
            const boundary = '----Boundary_SacosVacios_' + crypto.randomBytes(8).toString('hex');
            const pdfBase64 = wrapBase64(pdfBuffer.toString('base64'));
            
            rawMessage = [
              `From: "Alertas Sacos Vacios" <${from}>`,
              `To: ${toHeader}`,
              `Subject: ${encodedSubject}`,
              `Message-ID: ${messageId}`,
              `Date: ${dateHeader}`,
              `Mime-Version: 1.0`,
              `Content-Type: multipart/mixed; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/html; charset=utf-8`,
              `Content-Transfer-Encoding: 7bit`,
              ``,
              html,
              ``,
              `--${boundary}`,
              `Content-Type: application/pdf; name="Requisicion_Sacos_Vacios.pdf"`,
              `Content-Transfer-Encoding: base64`,
              `Content-Disposition: attachment; filename="Requisicion_Sacos_Vacios.pdf"`,
              ``,
              pdfBase64,
              ``,
              `--${boundary}--`,
              `.`
            ].join('\r\n') + '\r\n';
          } else {
            rawMessage = [
              `From: "Alertas Sacos Vacios" <${from}>`,
              `To: ${toHeader}`,
              `Subject: ${encodedSubject}`,
              `Message-ID: ${messageId}`,
              `Date: ${dateHeader}`,
              `Mime-Version: 1.0`,
              `Content-Type: text/html; charset=utf-8`,
              `Content-Transfer-Encoding: 7bit`,
              ``,
              html,
              `.`
            ].join('\r\n') + '\r\n';
          }

          // Write raw message
          const socketToUse = secureSocket || socket;
          socketToUse.write(rawMessage);
          addLog("C: [Enviando cuerpo del mensaje]");
        } else {
          fail(`Error en comando DATA: ${line}`);
        }
      } else if (step === 9) {
        // Sent message body and dots, expect 250 (Message accepted)
        if (code === '250') {
          step = 10;
          sendCommand(`QUIT\r\n`);
        } else {
          fail(`Error al enviar contenido del correo: ${line}`);
        }
      } else if (step === 10) {
        // Sent QUIT, expect 221
        cleanup();
        resolve({ success: true, log: log });
      }
    }

    let recipientIndex = 0;
    function sendNextRecipient() {
      sendCommand(`RCPT TO:<${recipients[recipientIndex]}>\r\n`);
    }

    function fail(errMessage) {
      cleanup();
      reject({ message: errMessage, log: log });
    }

    function handleError(err) {
      cleanup();
      reject({ message: `Error de Socket: ${err.message}`, log: log });
    }

    // Connect to server
    addLog(`Conectando a ${host}:${port} (secure: ${secure})...`);
    if (secure) {
      // Direct TLS
      socket = tls.connect({
        host: host,
        port: port,
        rejectUnauthorized: false // Permite certificados auto-firmados en intranets
      }, () => {
        addLog("Conexión TLS directa establecida.");
      });
      secureSocket = socket;
    } else {
      // Plain TCP
      socket = net.connect({
        host: host,
        port: port
      }, () => {
        addLog("Conexión TCP inicial establecida.");
      });
    }

    socket.on('data', handleData);
    socket.on('error', handleError);

    // Timeout safety
    socket.setTimeout(15000, () => {
      cleanup();
      reject({ message: "Tiempo de espera agotado (Timeout) al conectar con el servidor SMTP.", log: log });
    });
  });
}

function getAlertHtml(lowStockItems, threshold) {
  const rowsHtml = lowStockItems.map(item => {
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 13px;">${item.code}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.desc}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #d32f2f;">${Number(item.total).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: #666;">${Number(threshold).toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alerta de Stock Bajo: Sacos de Especialidades</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; background-color: #f9f9f9;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); padding: 25px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">ALERTA DE STOCK BAJO</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sacos de Especialidades con saldos menores al mínimo</p>
        </div>

        <!-- Body -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; margin-top: 0;">Estimado equipo,</p>
          <p style="font-size: 14px; color: #555;">
            Se ha realizado una actualización del saldo de sacos vacíos en el sistema. Durante este proceso, se han detectado ítems del grupo de <strong>Especialidades</strong> cuyos saldos están por debajo del límite mínimo establecido de <strong>${Number(threshold).toLocaleString()} unidades</strong>.
          </p>
          <p style="font-size: 14px; color: #555; font-weight: bold;">
            Se solicita gestionar la reposición o solicitar la compra de estos ítems de forma inmediata.
          </p>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: left;">Código</th>
                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: left;">Descripción</th>
                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: right;">Saldos Actuales</th>
                <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: right;">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding: 15px; background-color: #ffebee; border-left: 4px solid #f44336; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #c62828; font-weight: bold;">
              Nota: Este es un correo automático informativo enviado tras la actualización de stock en la aplicación local.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0;">&copy; 2026 Ferpacific - Control de Sacos Vacíos</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getProjectionAlertHtml(criticalItems) {
  const rowsHtml = criticalItems.map(item => {
    const isUrgent = item.alertStatus === "URGENTE";
    const statusText = isUrgent ? "🔴 URGENTE" : "🟠 SOLICITAR";
    const statusColor = isUrgent ? "#d32f2f" : "#e65100";
    const statusBg = isUrgent ? "#ffebee" : "#fff3e0";
    
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-family: monospace; font-size: 13px;">${item.code}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${item.desc}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px;">${item.linea}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${Number(item.total).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: #555;">${Number(item.totalTransit).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: #555;">${Number(item.jul26).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: #555;">${Number(item.projection3Months).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">
          <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: ${statusColor}; background-color: ${statusBg};">${statusText}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #004b8c;">${Number(item.suggestedOrder).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold; color: #2e7d32;">${Number(item.requisition || 0).toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-size: 11px; color: #444; max-width: 250px; word-wrap: break-word;">${item.observation}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Requerimiento de Sacos Vacíos - Proyecciones a 3 Meses</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; background-color: #f9f9f9;">
      <div style="max-width: 1100px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #002b54 0%, #001B3A 100%); padding: 25px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">ALERTA DE REPOSICIÓN DE SACOS</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Reporte de Necesidades y Pedidos Sugeridos basados en Proyecciones a 3 Meses (Ferpacific)</p>
        </div>

        <!-- Body -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; margin-top: 0;">Estimado equipo,</p>
          <p style="font-size: 14px; color: #555;">
            Se ha realizado una actualización del saldo de sacos vacíos en el sistema. Se detallan a continuación los códigos que presentan alertas de stock según las proyecciones de ventas a partir de <strong>Julio 2026</strong>.
          </p>
          <p style="font-size: 14px; color: #555;">
            Las alertas consideran el inventario físico actual y el tránsito total (pendiente de ingreso a bodega):
          </p>
          <ul style="font-size: 13px; color: #555; margin-bottom: 20px;">
            <li><strong>URGENTE</strong>: El stock físico en bodega es inferior al consumo proyectado del primer mes (Julio). Existe riesgo inminente de quiebre.</li>
            <li><strong>SOLICITAR</strong>: El total consolidado (físico + tránsito) es inferior a la demanda proyectada de 3 meses. Requiere emitir pedido.</li>
          </ul>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; border: 1px solid #eee;">
            <thead>
              <tr style="background-color: #f5f5f5; border-bottom: 2px solid #ddd;">
                <th style="padding: 10px; text-align: left;">Código</th>
                <th style="padding: 10px; text-align: left;">Descripción</th>
                <th style="padding: 10px; text-align: left;">Línea</th>
                <th style="padding: 10px; text-align: right;">Físico</th>
                <th style="padding: 10px; text-align: right;">Tránsito</th>
                <th style="padding: 10px; text-align: right;">Proy. Jul</th>
                <th style="padding: 10px; text-align: right;">Demanda 3M</th>
                <th style="padding: 10px; text-align: center;">Alerta</th>
                <th style="padding: 10px; text-align: right;">Ped. Sug.</th>
                <th style="padding: 10px; text-align: right;">Requisición</th>
                <th style="padding: 10px; text-align: left; max-width: 250px;">Observación IA</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding: 15px; background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #0d47a1; font-weight: bold;">
              Nota: Este es un reporte de alerta automático generado por el sistema de control local de sacos vacíos de Ferpacific.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0;">&copy; 2026 Ferpacific - Control de Sacos Vacíos</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const https = require('https');

function sanitizeForPDF(str) {
  if (!str) return "";
  return str
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U')
    .replace(/[ñ]/g, 'n')
    .replace(/[Ñ]/g, 'N')
    .replace(/⚠️/g, ' [!] ')
    .replace(/🔴/g, ' [URGENTE] ')
    .replace(/🟠/g, ' [SOLICITAR] ')
    .replace(/📦/g, ' [BODEGA] ')
    .replace(/🔔/g, ' [REPOSICION] ')
    .replace(/✅/g, ' [OK] ')
    .replace(/[^ -~]/g, ''); // Keep only ASCII standard printable characters
}

function getCoverageTime(item) {
  const stock = item.total;
  const jul = item.jul26 || 0;
  const aug = item.aug26 || 0;
  const sep = item.sep26 || 0;
  const oct = item.oct26 || 0;
  const nov = item.nov26 || 0;
  const dec = item.dec26 || 0;

  const months = [
    { name: "Julio 2026", days: 31, demand: jul },
    { name: "Agosto 2026", days: 31, demand: aug },
    { name: "Septiembre 2026", days: 30, demand: sep },
    { name: "Octubre 2026", days: 31, demand: oct },
    { name: "Noviembre 2026", days: 30, demand: nov },
    { name: "Diciembre 2026", days: 31, demand: dec }
  ];

  let remainingStock = stock;
  let totalDays = 0;

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (m.demand <= 0) {
      continue;
    }
    if (remainingStock >= m.demand) {
      remainingStock -= m.demand;
      totalDays += m.days;
    } else {
      const dailyConsumption = m.demand / m.days;
      const daysInMonth = dailyConsumption > 0 ? Math.floor(remainingStock / dailyConsumption) : m.days;
      totalDays += daysInMonth;
      return {
        days: totalDays,
        month: m.name,
        exactText: `aproximadamente ${totalDays} dias (Ruptura en ${m.name})`
      };
    }
  }

  return {
    days: totalDays || 180,
    month: "mas de 6 meses",
    exactText: `mas de 180 dias`
  };
}

function generateAlertPDF(criticalAlerts) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  const lines = [];
  lines.push("FERPACIFIC - REPORTE DE ALERTAS CRITICAS DE SACOS VACIOS");
  lines.push(`Fecha de Emision: ${new Date().toLocaleString()}`);
  lines.push(`Total de Items en Alerta: ${criticalAlerts.length}`);
  lines.push("");
  lines.push("=========================================================================");
  lines.push("");
  
  criticalAlerts.forEach((item, index) => {
    const coverage = getCoverageTime(item);
    const isUrgent = item.alertStatus === "URGENTE";
    const statusText = isUrgent ? "ALERTA URGENTE (Quiebre Inminente)" : "SOLICITAR PEDIDO";
    
    lines.push(sanitizeForPDF(`${index + 1}. PRODUCTO: ${item.code} - ${item.desc}`));
    lines.push(sanitizeForPDF(`   Linea: ${item.linea} | Tipo: ${item.tipo}`));
    lines.push(sanitizeForPDF(`   Estado Alerta: ${statusText}`));
    lines.push(sanitizeForPDF(`   Stock Fisico: ${Number(item.total).toLocaleString()} ud (Ferpasur: ${Number(item.ferpasur || 0).toLocaleString()} ud, Unica: ${Number(item.unica || 0).toLocaleString()} ud)`));
    lines.push(sanitizeForPDF(`   Transito: ${Number(item.totalTransit).toLocaleString()} ud`));
    if (item.totalTransit > 0) {
      const trDetails = [];
      if (item.transitSacoplast > 0) trDetails.push(`Sacoplast: ${Number(item.transitSacoplast).toLocaleString()}`);
      if (item.transitInterama > 0) trDetails.push(`Interama: ${Number(item.transitInterama).toLocaleString()}`);
      if (item.transitPlasticsack > 0) trDetails.push(`Plasticsack: ${Number(item.transitPlasticsack).toLocaleString()}`);
      if (item.transitReysac > 0) trDetails.push(`Reysac: ${Number(item.transitReysac).toLocaleString()}`);
      lines.push(sanitizeForPDF(`     Detalle Transito: ${trDetails.join(', ')}`));
    }
    lines.push(sanitizeForPDF(`   Proyeccion Ventas Julio 2026: ${Number(item.jul26 || 0).toLocaleString()} ud`));
    lines.push(sanitizeForPDF(`   Demanda Proyectada 3 Meses: ${Number(item.projection3Months || 0).toLocaleString()} ud`));
    lines.push(sanitizeForPDF(`   Pedido Sugerido: ${Number(item.suggestedOrder || 0).toLocaleString()} ud`));
    lines.push(sanitizeForPDF(`   Requisicion Manual Registrada: ${Number(item.requisition || 0).toLocaleString()} ud`));
    lines.push(sanitizeForPDF(`   Tiempo Cobertura Estimado: ${coverage.exactText}`));
    
    const obs = item.observation || "Sin observaciones.";
    const obsLabel = "   Observacion IA: ";
    const maxLineLength = 70;
    if (obs.length > maxLineLength) {
      let tempObs = obs;
      let first = true;
      while (tempObs.length > 0) {
        const chunk = tempObs.substring(0, maxLineLength);
        tempObs = tempObs.substring(maxLineLength);
        if (first) {
          lines.push(sanitizeForPDF(obsLabel + chunk));
          first = false;
        } else {
          lines.push(sanitizeForPDF("                   " + chunk));
        }
      }
    } else {
      lines.push(sanitizeForPDF(obsLabel + obs));
    }
    lines.push("");
    lines.push("-------------------------------------------------------------------------");
    lines.push("");
  });
  
  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push(["No hay alertas criticas en este momento."]);
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
      if (i === 0 && lineIndex === 0) {
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
        stream += `/F1 14 Tf\n(${escaped}) Tj T*\n/F2 10 Tf\n12 TL\n`;
      } else {
        let isBold = false;
        if (line.includes("PRODUCTO:") || line.includes("Estado Alerta:") || line.includes("ALERTA CRITICAL:") || line.includes("========================")) {
          isBold = true;
        }
        
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
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

function sendFormSubmit({ to, cc, subject, mensaje, criticalAlerts, pdfBuffer, attachments }) {
  return new Promise((resolve, reject) => {
    const recipient = Array.isArray(to) ? to[0] : to;
    const ccHeader = Array.isArray(cc) ? cc.join(', ') : cc;

    if (pdfBuffer || (attachments && attachments.length > 0)) {
      // Multipart/form-data with file attachments
      const boundary = '----NodeFormBoundary' + crypto.randomBytes(8).toString('hex');
      
      const fields = {
        _subject: subject,
        _cc: ccHeader,
        _replyto: "no-reply@operaciones.com",
        _captcha: "false",
        mensaje: mensaje || "Estimado Johnny, se adjunta el reporte de alertas de sacos vacíos."
      };

      const chunks = [];
      
      // Fields text block
      let payloadText = [];
      for (const [key, val] of Object.entries(fields)) {
        payloadText.push(`--${boundary}`);
        payloadText.push(`Content-Disposition: form-data; name="${key}"`);
        payloadText.push('');
        payloadText.push(val);
      }

      // Add attachments
      if (attachments && attachments.length > 0) {
        attachments.forEach((att, index) => {
          const fieldName = index === 0 ? 'attachment' : `attachment_${index + 1}`;
          payloadText.push(`--${boundary}`);
          payloadText.push(`Content-Disposition: form-data; name="${fieldName}"; filename="${att.filename}"`);
          payloadText.push(`Content-Type: ${att.contentType}`);
          payloadText.push('');
          
          chunks.push(Buffer.from(payloadText.join('\r\n') + '\r\n', 'utf8'));
          payloadText = []; // Clear
          chunks.push(att.content);
          chunks.push(Buffer.from('\r\n', 'utf8'));
        });
      } else if (pdfBuffer) {
        payloadText.push(`--${boundary}`);
        payloadText.push(`Content-Disposition: form-data; name="attachment"; filename="Alerta_Sacos_Vacios.pdf"`);
        payloadText.push(`Content-Type: application/pdf`);
        payloadText.push('');
        
        chunks.push(Buffer.from(payloadText.join('\r\n') + '\r\n', 'utf8'));
        payloadText = [];
        chunks.push(pdfBuffer);
        chunks.push(Buffer.from('\r\n', 'utf8'));
      } else {
        chunks.push(Buffer.from(payloadText.join('\r\n') + '\r\n', 'utf8'));
      }
      
      chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
      
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);

      const options = {
        hostname: 'formsubmit.co',
        port: 443,
        path: `/${recipient}`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': totalLength,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
          'Origin': process.env.APP_URL || 'https://sistema-integral-operaciones.onrender.com',
          'Referer': `${process.env.APP_URL || 'https://sistema-integral-operaciones.onrender.com'}/`
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => {
          let cleanErrMsg = `Error de FormSubmit (Código ${res.statusCode})`;
          if (body && (body.includes('<!DOCTYPE') || body.includes('<html'))) {
            cleanErrMsg = `FormSubmit (Código ${res.statusCode}): Servicio de correo externo no disponible o requiere verificación.`;
          } else if (body) {
            cleanErrMsg = `Error de FormSubmit (Código ${res.statusCode}): ${body}`;
          }

          try {
            const json = JSON.parse(body);
            if (res.statusCode === 200) {
              resolve({ success: true, log: [`FormSubmit (Multipart): ${json.message || 'Enviado con éxito.'}`] });
            } else {
              reject({ message: `Error de FormSubmit (Código ${res.statusCode}): ${json.message || cleanErrMsg}`, log: [body] });
            }
          } catch (e) {
            if (res.statusCode === 200) {
              resolve({ success: true, log: [`FormSubmit (Multipart): Enviado (Respuesta no parseada)`] });
            } else {
              reject({ message: cleanErrMsg, log: [body] });
            }
          }
        });
      });

      req.setTimeout(5000, () => {
        req.destroy(new Error("Timeout de conexión con FormSubmit (5s)"));
      });

      req.on('error', (e) => {
        reject({ message: `Error de conexión: ${e.message}`, log: [] });
      });

      // Write all buffer chunks
      chunks.forEach(chunk => {
        req.write(chunk);
      });
      req.end();
    } else {
      // Fallback JSON payload
      const payload = {
        _subject: subject,
        _cc: ccHeader,
        _replyto: "no-reply@operaciones.com",
        "Mensaje Informativo": mensaje || "Este es un reporte detallado de alertas de sacos vacios de Ferpacific."
      };

      if (Array.isArray(criticalAlerts)) {
        criticalAlerts.forEach((item, index) => {
          const isUrgent = item.alertStatus === "URGENTE";
          const statusText = isUrgent ? "🔴 URGENTE (Quiebre Inminente)" : "🟠 SOLICITAR PEDIDO";
          
          const details = [
            `Estado Alerta: ${statusText}`,
            `Codigo Producto: ${item.code}`,
            `Descripcion: ${item.desc}`,
            `Linea: ${item.linea}`,
            `----------------------------------------`,
            `[INVENTARIO Y TRANSITO]`,
            `Saldo Bodega Total: ${Number(item.total).toLocaleString()} ud`,
            `  - Bodega Ferpasur: ${Number(item.ferpasur || 0).toLocaleString()} ud`,
            `  - Bodega Unica: ${Number(item.unica || 0).toLocaleString()} ud`,
            `Transito Total: ${Number(item.totalTransit).toLocaleString()} ud`,
            `  - Transito Sacoplast: ${Number(item.transitSacoplast || 0).toLocaleString()} ud`,
            `  - Transito Interama: ${Number(item.transitInterama || 0).toLocaleString()} ud`,
            `  - Transito Plasticsack: ${Number(item.transitPlasticsack || 0).toLocaleString()} ud`,
            `  - Transito Reysac: ${Number(item.transitReysac || 0).toLocaleString()} ud`,
            `----------------------------------------`,
            `[SUGERENCIA DE COMPRA]`,
            `Pedido Sugerido (Sistema): ${Number(item.suggestedOrder).toLocaleString()} ud`,
            `Pedido Requisicion (Manual): ${Number(item.requisition || 0).toLocaleString()} ud`,
            `----------------------------------------`,
            `[ANALISIS DE OBSERVACION IA]`,
            `${item.observation}`
          ].join('\n');

          payload[`Producto_${index + 1} (${item.code})`] = details;
        });
      } else if (typeof criticalAlerts === 'string') {
        payload["Detalle de Alertas"] = criticalAlerts;
      }

      const payloadString = JSON.stringify(payload);

      const options = {
        hostname: 'formsubmit.co',
        port: 443,
        path: `/ajax/${recipient}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payloadString.length,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
          'Origin': process.env.APP_URL || 'https://sistema-integral-operaciones.onrender.com',
          'Referer': `${process.env.APP_URL || 'https://sistema-integral-operaciones.onrender.com'}/`
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => {
          let cleanErrMsg = `Error de FormSubmit (Código ${res.statusCode})`;
          if (body && (body.includes('<!DOCTYPE') || body.includes('<html'))) {
            cleanErrMsg = `FormSubmit (Código ${res.statusCode}): Servicio de correo externo no disponible o requiere verificación.`;
          } else if (body) {
            cleanErrMsg = `Error de FormSubmit (Código ${res.statusCode}): ${body}`;
          }

          try {
            const json = JSON.parse(body);
            if (res.statusCode === 200) {
              resolve({ success: true, log: [`FormSubmit: ${json.message || 'Enviado con éxito.'}`] });
            } else {
              reject({ message: `Error de FormSubmit (Código ${res.statusCode}): ${json.message || cleanErrMsg}`, log: [body] });
            }
          } catch (e) {
            if (res.statusCode === 200) {
              resolve({ success: true, log: [`FormSubmit: Enviado (Respuesta no parseada)`] });
            } else {
              reject({ message: cleanErrMsg, log: [body] });
            }
          }
        });
      });

      req.setTimeout(5000, () => {
        req.destroy(new Error("Timeout de conexión con FormSubmit (5s)"));
      });

      req.on('error', (e) => {
        reject({ message: `Error de conexión: ${e.message}`, log: [] });
      });

      req.write(payloadString);
      req.end();
    }
  });
}

function findTemplatePath() {
  if (process.env.TEMPLATE_PATH && fs.existsSync(process.env.TEMPLATE_PATH)) {
    return process.env.TEMPLATE_PATH;
  }
  
  const localTemplateDir = path.join(__dirname, 'templates');
  if (fs.existsSync(localTemplateDir)) {
    const files = fs.readdirSync(localTemplateDir);
    const found = files.find(f => f.toLowerCase().includes("req ferp") && f.toLowerCase().endsWith(".xlsx"));
    if (found) return path.join(localTemplateDir, found);
  }

  const localFile = path.join(__dirname, "REQ FERP.  SACOS VACÍOS.xlsx");
  if (fs.existsSync(localFile)) {
    return localFile;
  }

  return null;
}

function generateRequisitionExcel(criticalAlerts) {
  const templatePath = findTemplatePath();
  if (!templatePath) {
    throw new Error("No se encontro la plantilla de requisicion Excel en el Escritorio.");
  }
  
  const buffer = fs.readFileSync(templatePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Hoja1'];
  
  // Get critical items to order (quantity > 0)
  const itemsToOrder = criticalAlerts.filter(item => (item.requisition || item.suggestedOrder) > 0);
  const N = itemsToOrder.length;
  
  // Determine minimum coverage time for justification
  let minDays = Infinity;
  let minDaysText = "pocos dias";
  criticalAlerts.forEach(item => {
    const cov = getCoverageTime(item);
    if (cov.days < minDays) {
      minDays = cov.days;
      minDaysText = cov.exactText || `${cov.days} dias`;
    }
  });
  
  const today = new Date();
  const dayStr = String(today.getDate()).padStart(2, '0');
  const monthStr = String(today.getMonth() + 1).padStart(2, '0');
  const yearStr = String(today.getFullYear());
  
  const limitDate = new Date();
  limitDate.setDate(today.getDate() + 7); // + 7 days limit
  const limitDayStr = String(limitDate.getDate()).padStart(2, '0');
  const limitMonthStr = String(limitDate.getMonth() + 1).padStart(2, '0');
  const limitYearStr = String(limitDate.getFullYear());

  const newSheet = {};
  
  // Copy original cells
  for (let z in sheet) {
    if (z[0] === '!') {
      newSheet[z] = sheet[z];
      continue;
    }
    
    const match = z.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) continue;
    
    const col = match[1];
    const row = parseInt(match[2], 10);
    
    if (row <= 10) {
      newSheet[z] = sheet[z];
    } else if (row >= 15) {
      const newRow = row + (N - 4);
      const newAddr = `${col}${newRow}`;
      
      newSheet[newAddr] = { ...sheet[z] };
      
      if (col === 'G' && row === 18) {
        newSheet[newAddr].v = `Justificación: Reposicion automatica para evitar desabastecimiento de sacos de especialidades y tradicionales (Ruptura inminente calculada en ${minDaysText}).`;
      }
      
      if (row === 22) {
        if (col === 'C') newSheet[newAddr].v = parseInt(dayStr, 10);
        if (col === 'D') newSheet[newAddr].v = parseInt(monthStr, 10);
        if (col === 'E') newSheet[newAddr].v = parseInt(yearStr, 10);
        if (col === 'M') newSheet[newAddr].v = parseInt(limitDayStr, 10);
        if (col === 'N') newSheet[newAddr].v = parseInt(limitMonthStr, 10);
        if (col === 'O') newSheet[newAddr].v = parseInt(limitYearStr, 10);
      }
    }
  }
  
  newSheet['M1'] = { t: 's', v: `${dayStr}/${monthStr}/${yearStr}` };
  
  const reqNum = `2026${monthStr}${dayStr}${Math.floor(100 + Math.random() * 900)}`;
  newSheet['M2'] = { t: 'n', v: parseInt(reqNum, 10) };
  
  itemsToOrder.forEach((item, i) => {
    const row = 11 + i;
    
    newSheet[`A${row}`] = { t: 'n', v: i + 1 };
    newSheet[`B${row}`] = { t: 's', v: item.code };
    newSheet[`C${row}`] = { t: 's', v: 'Unidad ' };
    newSheet[`D${row}`] = { t: 'n', v: item.requisition || item.suggestedOrder };
    newSheet[`E${row}`] = { t: 's', v: sanitizeForPDF(item.desc) };
    newSheet[`L${row}`] = { t: 'n', v: item.total };
    newSheet[`M${row}`] = { t: 'n', v: 0 };
  });
  
  const lastRow = 31 + (N - 4);
  newSheet['!ref'] = `A1:O${lastRow}`;
  
  if (sheet['!merges']) {
    newSheet['!merges'] = sheet['!merges'].map(m => {
      const startRow = m.s.r + 1;
      
      if (startRow <= 10) {
        return m;
      } else if (startRow >= 15) {
        return {
          s: { r: m.s.r + (N - 4), c: m.s.c },
          e: { r: m.e.r + (N - 4), c: m.e.c }
        };
      } else {
        return null;
      }
    }).filter(Boolean);
    
    for (let i = 0; i < N; i++) {
      newSheet['!merges'].push({
        s: { r: 10 + i, c: 4 },
        e: { r: 10 + i, c: 10 }
      });
    }
  }

  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, newSheet, 'Hoja1');
  
  return XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' });
}

function generateRequisitionPDF(criticalAlerts) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  const itemsToOrder = criticalAlerts.filter(item => (item.requisition || item.suggestedOrder) > 0).slice(0, 30);
  
  let minDays = Infinity;
  let minDaysText = "pocos dias";
  criticalAlerts.forEach(item => {
    const cov = getCoverageTime(item);
    if (cov.days < minDays) {
      minDays = cov.days;
      minDaysText = cov.exactText || `${cov.days} dias`;
    }
  });

  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
  const timeStr = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:${today.getSeconds().toString().padStart(2, '0')}`;
  const fullDateStr = `${dateStr} ${timeStr}`;
  
  const reqNumber = `2026${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}${Math.floor(100 + Math.random() * 900)}`;

  const pageCommands = [];
  
  // Set stroke color to dark slate-grey
  pageCommands.push("0.2 0.27 0.35 RG");
  pageCommands.push("0.7 w");
  
  // 1. Draw main border box
  pageCommands.push("20 30 572 732 re S");
  
  // 2. Draw Header Grid
  pageCommands.push("20 702 m 592 702 l S");
  pageCommands.push("430 702 m 430 762 l S");
  pageCommands.push("430 742 m 592 742 l S");
  pageCommands.push("430 722 m 592 722 l S");
  
  // 3. Draw Metadata Grid
  pageCommands.push("20 672 m 592 672 l S");
  pageCommands.push("20 642 m 592 642 l S");
  pageCommands.push("130 672 m 130 702 l S");
  pageCommands.push("270 672 m 270 702 l S");
  pageCommands.push("400 672 m 400 702 l S");
  pageCommands.push("180 642 m 180 672 l S");
  pageCommands.push("300 642 m 300 672 l S");
  
  // 4. Draw Table Grid (Y = 222 to 642)
  // Fill header background (Y = 617 to 642)
  pageCommands.push("0.85 0.88 0.92 rg");
  pageCommands.push("20 617 572 25 re f");
  pageCommands.push("0.2 0.27 0.35 RG"); // Restore stroke color
  
  // Column dividers
  pageCommands.push("45 222 m 45 642 l S");
  pageCommands.push("115 222 m 115 642 l S");
  pageCommands.push("160 222 m 160 642 l S");
  pageCommands.push("205 222 m 205 642 l S");
  pageCommands.push("400 222 m 400 642 l S");
  pageCommands.push("455 222 m 455 642 l S");
  pageCommands.push("495 222 m 495 642 l S");
  pageCommands.push("540 222 m 540 642 l S");
  
  // 30 Rows horizontal lines
  const rowH = 13.15;
  for (let k = 1; k <= 30; k++) {
    const y = 617 - k * rowH;
    pageCommands.push(`20 ${y} m 592 ${y} l S`);
  }
  
  // 5. Draw Justification Box (Y = 202 to 222)
  pageCommands.push("20 202 m 592 202 l S");
  
  // 6. Draw Footer Signature Grid (Y = 30 to 202)
  pageCommands.push("20 160 m 592 160 l S");
  pageCommands.push("20 118 m 592 118 l S");
  pageCommands.push("20 76 m 592 76 l S");
  pageCommands.push("200 30 m 200 202 l S");
  pageCommands.push("390 30 m 390 202 l S");

  // --- TEXT WRITING ---
  const txt = [];
  function drawText(font, size, x, y, strText) {
    const escaped = sanitizeForPDF(strText).replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
    txt.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escaped}) Tj ET`);
  }
  
  function drawTextColored(font, size, x, y, r, g, b, strText) {
    const escaped = sanitizeForPDF(strText).replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
    txt.push(`BT /${font} ${size} Tf ${r} ${g} ${b} rg ${x} ${y} Td (${escaped}) Tj ET`);
  }

  // Logo & Title
  drawTextColored('F1', 13, 25, 735, 0.05, 0.2, 0.4, 'FERPACIFIC');
  drawText('F1', 12, 140, 735, 'Requisición de Bodega y/o Solicitud de Compras.');
  
  // Top right Code Box
  drawText('F1', 6.5, 435, 749, 'Código: 2.4.3 FP COMP FOR');
  drawText('F1', 6.5, 435, 729, 'VERSIÓN: 000');
  drawText('F1', 6.5, 435, 709, 'FECHA : 05/05/2025');
  
  // Metadata Fields
  drawText('F1', 7.5, 25, 685, 'SUCURSAL:');
  drawText('F2', 7.5, 80, 685, 'FERPASUR');
  drawText('F1', 7.5, 145, 685, 'FECHA:');
  drawText('F2', 7.5, 185, 685, fullDateStr);
  drawText('F1', 7.5, 410, 685, 'N° de Requisición:');
  
  drawText('F1', 7.5, 25, 655, 'DEPARTAMENTO:');
  drawText('F2', 7.5, 105, 655, 'OPERACIONES');
  drawText('F1', 7.5, 185, 655, 'Prioridad:');
  drawTextColored('F1', 8, 235, 655, 0.9, 0.1, 0.1, 'URGENTE');
  drawText('F1', 9.5, 410, 655, reqNumber);

  // Table Headers
  drawText('F1', 6.5, 23, 627, '# items');
  drawText('F1', 6.5, 52, 627, 'Código del sistema');
  drawText('F1', 6.5, 122, 627, 'Cantidad');
  drawText('F1', 6.5, 164, 627, 'Unidad de medida');
  drawText('F1', 6.5, 210, 627, 'Nombre de artículo. Descripción de servicio.');
  drawText('F1', 5.5, 402, 631, 'Fecha de');
  drawText('F1', 5.5, 402, 623, 'último pedido');
  drawText('F1', 5.5, 458, 627, 'Stock actual');
  drawText('F1', 5.5, 498, 631, 'REFERENCIA');
  drawText('F1', 5.5, 498, 623, 'SIST. SIEMPRE');
  drawText('F1', 5.5, 543, 631, 'CRONOGRAMA');
  drawText('F1', 5.5, 543, 623, 'DE ENTREGA');

  // Table Rows (30 total)
  for (let k = 0; k < 30; k++) {
    const yRow = 617 - k * rowH - 9.5;
    
    // Row Index
    drawText('F2', 7.5, 25, yRow, `${k + 1})`);
    
    if (k < itemsToOrder.length) {
      const item = itemsToOrder[k];
      drawText('F2', 7.5, 48, yRow, item.code);
      drawText('F1', 7.5, 122, yRow, String(item.requisition || item.suggestedOrder));
      drawText('F2', 7.5, 168, yRow, 'U');
      drawText('F2', 6.5, 210, yRow, item.desc.substring(0, 48));
      drawText('F2', 7.5, 423, yRow, '-');
      drawText('F2', 7.5, 468, yRow, String(item.total));
      drawText('F2', 7.5, 513, yRow, '-');
      drawText('F2', 7.5, 558, yRow, '-');
    }
  }

  // Justification
  drawText('F1', 7, 25, 211, 'Justificación:');
  const justStr = `Reposición automática para evitar desabastecimiento de sacos. Riesgo de quiebre de stock en ${minDaysText}.`;
  drawText('F2', 7, 85, 211, justStr);

  // Footer Fields
  // Row 1
  drawText('F1', 6.5, 25, 192, 'Nombre del solicitante:');
  drawText('F1', 7.5, 25, 172, 'JOHNNY DURÁN');
  drawText('F1', 6.5, 205, 192, 'Firma:');
  // Blue ink signature
  drawTextColored('F4', 11, 230, 174, 0.1, 0.2, 0.6, 'Johnny Duran T.');
  drawText('F1', 6.5, 395, 192, 'Fecha de visita técnica:');
  drawText('F2', 7.5, 395, 172, '-');

  // Row 2
  drawText('F1', 6.5, 25, 150, 'Gerente General:');
  drawText('F1', 7.5, 25, 130, 'JUAN CARLOS DE YCAZA');
  drawText('F1', 6.5, 205, 150, 'Firma:');
  drawText('F1', 6.5, 395, 150, 'A ser recibido a más tardar:');
  drawText('F2', 7.5, 395, 130, '-');

  // Row 3
  drawText('F1', 6.5, 25, 108, 'Responsable técnico :');
  drawText('F1', 7.5, 25, 88, 'JOHNNY DURÁN');
  drawText('F1', 6.5, 205, 108, 'Firma:');
  drawText('F1', 6.5, 395, 108, 'Lugar de entrega:');
  drawText('F1', 7.5, 430, 88, 'FERPASUR');

  // Row 4
  drawText('F1', 6.5, 25, 66, 'Firma de autorización:');
  drawText('F1', 7.5, 25, 52, 'ING EMILIO ESPINOZA');
  drawText('F1', 6, 25, 42, 'SUB GERENTE ADMINISTRATIVO - FINANCIERO');
  drawText('F1', 6.5, 205, 66, 'Firma:');
  drawText('F1', 6.5, 395, 66, 'Nombre de personal asignado a recibir:');
  drawText('F1', 7.5, 430, 48, 'WALTER PEÑA');

  // Combine commands into page content stream
  const contentStream = pageCommands.join('\n') + '\n' + txt.join('\n');
  
  doc.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  doc.push("2 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj");
  
  // Font Resources: Helvetica-Bold, Helvetica, Helvetica-Oblique, Times-BoldItalic
  doc.push("3 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >> /F4 << /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic >> >> >>\nendobj");
  
  doc.push("4 0 obj\n<< /Type /Page /Parent 2 0 R /Resources 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj");

  const streamData = `BT\n18 TL\nET\n${contentStream}`;
  
  doc.push(`5 0 obj\n<< /Length ${streamData.length} >>\nstream\n${streamData}\nendstream\nendobj`);
  
  doc.push("xref");
  doc.push("0 6");
  doc.push("0000000000 65535 f\n");
  doc.push("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n310\n%%EOF");
  
  return Buffer.from(doc.join('\n'), 'utf8');
}

// ==========================================
// INVENTARIO BODEGA & CLIENTE PDF GENERATION
// ==========================================

function generateInventoryPDF(date, record, db) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  const lines = [];
  lines.push("FERPACIFIC - REPORTE DIARIO DE BODEGA");
  lines.push(`Fecha Planilla: ${date}`);
  lines.push(`Estado: FINALIZADO Y CERRADO`);
  lines.push(`Fecha de Emision: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("=========================================================================");
  lines.push("1. RESUMEN DE ACTIVIDAD DIARIA (PRODUCTOS CON MOVIMIENTOS)");
  lines.push("=========================================================================");
  lines.push("");

  const items = record.items || [];
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
    lines.push("No se registraron consumos o ingresos para esta fecha.");
  } else {
    activeItems.forEach((x, idx) => {
      lines.push(sanitizeForPDF(`${idx + 1}. PRODUCTO: ${x.stockItem.code} - ${x.stockItem.desc}`));
      lines.push(`   S. Inicial: Sist=${x.matched.initialSist.toLocaleString()} | Fis=${x.matched.initialPhys.toLocaleString()}`);
      
      let eDetails = [];
      if (x.matched.ferpagro) eDetails.push(`Ferpagro: ${x.matched.ferpagro}`);
      if (x.matched.doyle1) eDetails.push(`D1: ${x.matched.doyle1}`);
      if (x.matched.doyle2) eDetails.push(`D2: ${x.matched.doyle2}`);
      if (x.matched.nacional) eDetails.push(`Nac: ${x.matched.nacional}`);
      if (x.matched.sackett) eDetails.push(`Sackett: ${x.matched.sackett}`);
      if (x.matched.launica) eDetails.push(`La Unica: ${x.matched.launica}`);
      if (x.matched.storeocean) eDetails.push(`Storeocean: ${x.matched.storeocean}`);
      if (x.matched.otras) eDetails.push(`Otras Bod: ${x.matched.otras}`);
      if (x.matched.clientes) eDetails.push(`Clientes: ${x.matched.clientes}`);
      if (x.matched.damaged) eDetails.push(`Danados: ${x.matched.damaged}`);
      lines.push(`   Egresos: -${x.egresos.toLocaleString()} ud (${eDetails.join(', ') || 'N/A'})`);
      
      let iDetails = [];
      if (x.matched.interama) iDetails.push(`Interama: ${x.matched.interama}`);
      if (x.matched.sacoplast) iDetails.push(`Sacoplast: ${x.matched.sacoplast}`);
      if (x.matched.plasticsack) iDetails.push(`Plasticsack: ${x.matched.plasticsack}`);
      if (x.matched.reysac) iDetails.push(`Reysac: ${x.matched.reysac}`);
      lines.push(`   Ingresos: +${x.ingresos.toLocaleString()} ud (${iDetails.join(', ') || 'N/A'})`);

      const finalSist = Math.max(0, x.matched.initialSist - x.egresos + x.ingresos);
      const finalPhys = Math.max(0, x.matched.initialPhys - x.egresos + x.ingresos);
      lines.push(`   S. Final:   Sist=${finalSist.toLocaleString()} | Fis=${finalPhys.toLocaleString()}`);
      lines.push(sanitizeForPDF(`   Obs/Novedad: ${x.matched.observation || 'Sin novedades.'}`));
      lines.push("-------------------------------------------------------------------------");
    });
  }

  lines.push("");
  lines.push("=========================================================================");
  lines.push("2. DETALLE GENERAL DE SALDOS DE BODEGA");
  lines.push("=========================================================================");
  lines.push("");

  db.stock.forEach(stockItem => {
    const matched = items.find(it => it.code === stockItem.code) || {
      ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
      launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
      interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
      initialSist: stockItem.total || 0, initialPhys: stockItem.ferpasur || 0
    };
    const egresos = (matched.ferpagro || 0) + (matched.doyle1 || 0) + (matched.doyle2 || 0) + (matched.nacional || 0) + (matched.sackett || 0) + (matched.launica || 0) + (matched.storeocean || 0) + (matched.otras || 0) + (matched.clientes || 0) + (matched.damaged || 0);
    const ingresos = (matched.interama || 0) + (matched.sacoplast || 0) + (matched.plasticsack || 0) + (matched.reysac || 0);
    
    const finalSist = Math.max(0, matched.initialSist - egresos + ingresos);
    const finalPhys = Math.max(0, matched.initialPhys - egresos + ingresos);

    lines.push(sanitizeForPDF(`${stockItem.code} - ${stockItem.desc.substring(0, 45)}`));
    lines.push(`  Inicial: Sist=${matched.initialSist.toLocaleString()} Fis=${matched.initialPhys.toLocaleString()} | Final: Sist=${finalSist.toLocaleString()} Fis=${finalPhys.toLocaleString()}`);
    if (egresos > 0 || ingresos > 0) {
      lines.push(`  Movimientos: Egresos=-${egresos.toLocaleString()} | Ingresos=+${ingresos.toLocaleString()}`);
    }
    lines.push(".........................................................................");
  });

  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
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
      if (i === 0 && lineIndex === 0) {
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
        stream += `/F1 14 Tf\n(${escaped}) Tj T*\n/F2 10 Tf\n12 TL\n`;
      } else {
        let isBold = line.includes("PRODUCTO:") || line.includes("1. RESUMEN DE ACTIVIDAD") || line.includes("2. DETALLE GENERAL") || line.includes("====");
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
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

function generateClientInventoryPDF(date, record, db) {
  const doc = [];
  doc.push("%PDF-1.4");
  
  const lines = [];
  lines.push("FERPACIFIC - REPORTE DIARIO DE INVENTARIO CLIENTE");
  lines.push(`Fecha Planilla: ${date}`);
  lines.push(`Estado: FINALIZADO Y CERRADO`);
  lines.push(`Fecha de Emision: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("=========================================================================");
  lines.push("1. RESUMEN DE ACTIVIDAD DIARIA (PRODUCTOS CON MOVIMIENTOS)");
  lines.push("=========================================================================");
  lines.push("");

  const items = record.items || [];
  const activeItems = db.stock.map(stockItem => {
    const matched = items.find(it => it.code === stockItem.code) || {
      initialSist: stockItem.unica || 0,
      initialPhys: stockItem.unica || 0,
      egresos: 0,
      ingresos: 0,
      observation: ''
    };
    return { stockItem, matched };
  }).filter(x => x.matched.egresos > 0 || x.matched.ingresos > 0 || (x.matched.observation && x.matched.observation.trim().length > 0));

  if (activeItems.length === 0) {
    lines.push("No se registraron consumos o ingresos de cliente para esta fecha.");
  } else {
    activeItems.forEach((x, idx) => {
      lines.push(sanitizeForPDF(`${idx + 1}. PRODUCTO: ${x.stockItem.code} - ${x.stockItem.desc}`));
      lines.push(`   S. Inicial: Sist=${x.matched.initialSist.toLocaleString()} | Fis=${x.matched.initialPhys.toLocaleString()}`);
      lines.push(`   Egresos (Salidas): -${(x.matched.egresos||0).toLocaleString()} ud`);
      lines.push(`   Ingresos (Entradas): +${(x.matched.ingresos||0).toLocaleString()} ud`);
      
      const finalSist = Math.max(0, (x.matched.initialSist||0) - (x.matched.egresos||0) + (x.matched.ingresos||0));
      const finalPhys = Math.max(0, (x.matched.initialPhys||0) - (x.matched.egresos||0) + (x.matched.ingresos||0));
      lines.push(`   S. Final:   Sist=${finalSist.toLocaleString()} | Fis=${finalPhys.toLocaleString()}`);
      lines.push(sanitizeForPDF(`   Obs/Novedad: ${x.matched.observation || 'Sin novedades.'}`));
      lines.push("-------------------------------------------------------------------------");
    });
  }

  lines.push("");
  lines.push("=========================================================================");
  lines.push("2. DETALLE GENERAL DE SALDOS DE INVENTARIO CLIENTE");
  lines.push("=========================================================================");
  lines.push("");

  db.stock.forEach(stockItem => {
    const matched = items.find(it => it.code === stockItem.code) || {
      initialSist: stockItem.unica || 0,
      initialPhys: stockItem.unica || 0,
      egresos: 0,
      ingresos: 0
    };
    const finalSist = Math.max(0, (matched.initialSist||0) - (matched.egresos||0) + (matched.ingresos||0));
    const finalPhys = Math.max(0, (matched.initialPhys||0) - (matched.egresos||0) + (matched.ingresos||0));

    lines.push(sanitizeForPDF(`${stockItem.code} - ${stockItem.desc.substring(0, 45)}`));
    lines.push(`  Inicial: Sist=${(matched.initialSist||0).toLocaleString()} Fis=${(matched.initialPhys||0).toLocaleString()} | Final: Sist=${finalSist.toLocaleString()} Fis=${finalPhys.toLocaleString()}`);
    if ((matched.egresos||0) > 0 || (matched.ingresos||0) > 0) {
      lines.push(`  Movimientos: Egresos=-${(matched.egresos||0).toLocaleString()} | Ingresos=+${(matched.ingresos||0).toLocaleString()}`);
    }
    lines.push(".........................................................................");
  });

  const linesPerPage = 42;
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
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
      if (i === 0 && lineIndex === 0) {
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
        stream += `/F1 14 Tf\n(${escaped}) Tj T*\n/F2 10 Tf\n12 TL\n`;
      } else {
        let isBold = line.includes("PRODUCTO:") || line.includes("1. RESUMEN DE ACTIVIDAD") || line.includes("2. DETALLE GENERAL") || line.includes("====");
        const escaped = line.replace(/\\/g, '\\\\').replace(/[()]/g, '\\$&');
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

function generateInventoryExcel(date, record, db) {
  const wb = XLSX.utils.book_new();
  
  const wsData = [
    ["SISTEMA INTEGRAL DE OPERACIONES FERPACIFIC"],
    ["REPORTE DIARIO DE INVENTARIO FISICO Y CONSUMOS - BODEGA FERPASUR"],
    [`Fecha de Planilla: ${date}`],
    [`Fecha de Generación: ${new Date().toLocaleString()}`],
    ["Estado: FINALIZADO Y CERRADO"],
    [],
    [
      "Código", 
      "Descripción", 
      "Saldo Inicial (Sistema)", 
      "Saldo Inicial (Físico)",
      "Egresos Doyle 1",
      "Egresos Doyle 2",
      "Egresos Ferpagro",
      "Egresos Nacional",
      "Egresos Sackett",
      "Egresos La Única",
      "Egresos Storeocean",
      "Egresos Otras Bodegas",
      "Egresos Clientes",
      "Egresos Dañados (Merma)",
      "Total Egresos",
      "Ingresos Interama",
      "Ingresos Sacoplast",
      "Ingresos Plasticsack",
      "Ingresos Reysac",
      "Total Ingresos",
      "Saldo Final (Sistema)",
      "Saldo Final (Físico)",
      "Observación / Novedad"
    ]
  ];

  const items = record.items || [];
  db.stock.forEach(stockItem => {
    const matched = items.find(it => it.code === stockItem.code) || {
      ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
      launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
      interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
      observation: '',
      initialSist: stockItem.total || 0,
      initialPhys: stockItem.ferpasur || 0
    };

    const totalEgresos = (matched.ferpagro || 0) + (matched.doyle1 || 0) + (matched.doyle2 || 0) + (matched.nacional || 0) + (matched.sackett || 0) + (matched.launica || 0) + (matched.storeocean || 0) + (matched.otras || 0) + (matched.clientes || 0) + (matched.damaged || 0);
    const totalIngresos = (matched.interama || 0) + (matched.sacoplast || 0) + (matched.plasticsack || 0) + (matched.reysac || 0);

    const finalSist = Math.max(0, (matched.initialSist || 0) - totalEgresos + totalIngresos);
    const finalPhys = Math.max(0, (matched.initialPhys || 0) - totalEgresos + totalIngresos);

    wsData.push([
      stockItem.code,
      stockItem.desc,
      matched.initialSist || 0,
      matched.initialPhys || 0,
      matched.doyle1 || 0,
      matched.doyle2 || 0,
      matched.ferpagro || 0,
      matched.nacional || 0,
      matched.sackett || 0,
      matched.launica || 0,
      matched.storeocean || 0,
      matched.otras || 0,
      matched.clientes || 0,
      matched.damaged || 0,
      totalEgresos,
      matched.interama || 0,
      matched.sacoplast || 0,
      matched.plasticsack || 0,
      matched.reysac || 0,
      totalIngresos,
      finalSist,
      finalPhys,
      matched.observation || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Inventario Bodega");
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generateClientInventoryExcel(date, record, db) {
  const wb = XLSX.utils.book_new();
  
  const wsData = [
    ["SISTEMA INTEGRAL DE OPERACIONES FERPACIFIC"],
    ["REPORTE DIARIO DE INVENTARIO FISICO Y CONSUMOS - CLIENTE (LA UNICA)"],
    [`Fecha de Planilla: ${date}`],
    [`Fecha de Generación: ${new Date().toLocaleString()}`],
    ["Estado: FINALIZADO Y CERRADO"],
    [],
    [
      "Código", 
      "Descripción", 
      "Saldo Inicial (Sistema)", 
      "Saldo Inicial (Físico)",
      "Egresos (Salidas)",
      "Ingresos (Entradas)",
      "Saldo Final (Sistema)",
      "Saldo Final (Físico)",
      "Observación / Novedad"
    ]
  ];

  const items = record.items || [];
  db.stock.forEach(stockItem => {
    const matched = items.find(it => it.code === stockItem.code) || {
      egresos: 0,
      ingresos: 0,
      observation: '',
      initialSist: stockItem.unica || 0,
      initialPhys: stockItem.unica || 0
    };

    const finalSist = Math.max(0, (matched.initialSist || 0) - (matched.egresos || 0) + (matched.ingresos || 0));
    const finalPhys = Math.max(0, (matched.initialPhys || 0) - (matched.egresos || 0) + (matched.ingresos || 0));

    wsData.push([
      stockItem.code,
      stockItem.desc,
      matched.initialSist || 0,
      matched.initialPhys || 0,
      matched.egresos || 0,
      matched.ingresos || 0,
      finalSist,
      finalPhys,
      matched.observation || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Inventario Cliente");
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  sendMail,
  sendFormSubmit,
  getAlertHtml,
  getProjectionAlertHtml,
  getCoverageTime,
  generateAlertPDF,
  findTemplatePath,
  generateRequisitionExcel,
  generateRequisitionPDF,
  generateInventoryPDF,
  generateClientInventoryPDF,
  generateInventoryExcel,
  generateClientInventoryExcel
};

