// scripts/export-tariffs.js
const XLSX = require('xlsx');
const fs = require('fs');

// 1. Carica il workbook
const wb = XLSX.readFile('costo spedizione.xlsx');

// 2. Prendi il primo foglio
const ws = wb.Sheets[wb.SheetNames[0]];

// 3. Leggi come matrice (righe e colonne)
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

// 4. Estrai la riga dei pesi (indice 3) e le righe dati (da 4 in poi)
const weightsRow = raw[3];
const rows = raw.slice(4).filter(r => r[1] !== undefined && r[1] !== null);

const tariffs = [];

rows.forEach(row => {
  const prov = String(row[1]).trim();
  weightsRow.forEach((cell, idx) => {
    if (idx < 2) return;                     // prima 2 colonne non utili
    const wt = parseFloat(
      String(cell || '')
        .replace(/[^0-9.,]/g, '')
        .replace(',', '.')
    );
    const price = parseFloat(
      String(row[idx] || 0)
        .replace(/[^0-9.,]/g, '')
        .replace(',', '.')
    );
    if (!isNaN(wt) && !isNaN(price)) {
      tariffs.push({ Provincia: prov, Peso: wt, Prezzo: price });
    }
  });
});

// 5. Scrivi su file JSON
fs.writeFileSync('tariffs.json', JSON.stringify(tariffs, null, 2), 'utf8');
console.log(`✅ Generati ${tariffs.length} record in tariffs.json`);
