"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

export default function UploadTariffs() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  async function handleFile(e) {
    const f = e.target.files[0];
    setFile(f);

    const data = await f.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Trova riga intestazioni
    const headerRowIdx = raw.findIndex(row =>
      row.some(cell => typeof cell === "string" && cell.toLowerCase().includes("prov")) &&
      row.some(cell => typeof cell === "string" && cell.toLowerCase().includes("peso")) &&
      row.some(cell => typeof cell === "string" && cell.toLowerCase().includes("prezzo"))
    );

    if (headerRowIdx === -1) {
      setMessage("Intestazioni non trovate");
      return;
    }

    const headerRow = raw[headerRowIdx];
    const provinciaIdx = headerRow.findIndex(h => h.toLowerCase().includes("prov"));
    const pesoIdx = headerRow.findIndex(h => h.toLowerCase().includes("peso"));
    const prezzoIdx = headerRow.findIndex(h => h.toLowerCase().includes("prezzo"));

    const dataRows = raw.slice(headerRowIdx + 1);

    const jsonData = dataRows.map(row => ({
      Provincia: row[provinciaIdx],
      Peso: row[pesoIdx],
      Prezzo: row[prezzoIdx]
    })).filter(item => item.Provincia && item.Peso && item.Prezzo);

    // Invia al backend
    const res = await fetch("/api/upload-tariffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonData)
    });

    const json = await res.json();
    if (json.ok) {
      setMessage(`Caricati ${json.rows} record!`);
    } else {
      setMessage(`Errore: ${json.error || "unknown"}`);
    }
  }

  return (
    <div>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
      <p>{message}</p>
    </div>
  );
}


