const https = require('https');
const fs = require('fs');

console.log("Node version:", process.version);
console.log("Platform:", process.platform);

https.get('https://registry.npmjs.org/xlsx/latest', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("XLSX latest version:", json.version);
      console.log("XLSX tarball URL:", json.dist.tarball);
    } catch (e) {
      console.log("Failed to parse registry response:", e.message);
      console.log("Raw data sample:", data.substring(0, 200));
    }
  });
}).on('error', (err) => {
  console.log("HTTP Error:", err.message);
});
