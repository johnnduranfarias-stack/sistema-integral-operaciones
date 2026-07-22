const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
const dest = path.join(__dirname, 'xlsx.js');

console.log("Downloading from", url);
const file = fs.createWriteStream(dest);

https.get(url, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to get '${url}' (${response.statusCode})`);
    return;
  }
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log("Download complete: saved to", dest);
    // Try to require it
    try {
      const XLSX = require(dest);
      console.log("Successfully loaded XLSX!");
      console.log("Keys in XLSX:", Object.keys(XLSX).filter(k => k.toUpperCase() === k || k === 'version' || k === 'read'));
    } catch (err) {
      console.error("Error loading XLSX:", err);
    }
  });
}).on('error', (err) => {
  fs.unlink(dest, () => {});
  console.error("Error downloading file:", err.message);
});
