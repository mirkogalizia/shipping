// app/page.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface Tariffa {
  Provincia: string;
  Peso: number;
  Prezzo: number;
}

export default function Dashboard() {
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [risultato, setRisultato] = useState<string | null>(null);

  const VAT_RATE = 0.22; // 22% IVA
  const FUEL_SURCHARGE_RATE = 0.025; // 2.5% supplemento carburante

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      const weightsRow = raw[3];
      const rows = raw.slice(4).filter(r => r[1] && r[1].toString().trim());
      const tarifas: Tariffa[] = [];

      rows.forEach(r => {
        const prov = r[1].toString().trim();
        weightsRow.forEach((cell, idx) => {
          if (idx < 2) return;
          const wtStr = cell?.toString() || "";
          const wtNum = parseFloat(wtStr.replace(/[^0-9.,]/g, "").replace(",", "."));
          const price = parseFloat((r[idx] || 0).toString().replace(/[^0-9.,]/g, "").replace(",", "."));
          if (!isNaN(wtNum) && !isNaN(price)) {
            tarifas.push({ Provincia: prov, Peso: wtNum, Prezzo: price });
          }
        });
      });

      setData(tarifas);
      setRisultato(null);
    };
    reader.readAsBinaryString(file);
  }

  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!provincia || !pesoKg || data.length === 0) return;

    const list = data.filter(d => d.Provincia.toLowerCase() === provincia.toLowerCase());
    if (list.length === 0) {
      setRisultato("Provincia non trovata nelle tariffe.");
      return;
    }
    list.sort((a, b) => a.Peso - b.Peso);

    let rem = pesoKg;
    let baseCost = 0;
    while (rem > 0) {
      const entry = list.find(d => d.Peso >= rem) || list[list.length - 1];
      baseCost += entry.Prezzo;
      rem -= entry.Peso;
    }

    // Calcolo supplemento carburante e IVA
    const fuelSurcharge = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuelSurcharge;
    const iva = subtotal * VAT_RATE;
    const total = subtotal + iva;

    setRisultato(
      `Costo base: €${baseCost.toFixed(2)}\n` +
      `Supplemento carburante (2.5%): €${fuelSurcharge.toFixed(2)}\n` +
      `IVA (22%): €${iva.toFixed(2)}\n` +
      `———\nTotale: €${total.toFixed(2)}`
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto whitespace-pre-line">
      <h1 className="text-2xl font-bold mb-4">Tariffe Spedizione Personalizzate</h1>

      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="mb-4" />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Provincia"
          value={provincia}
          onChange={e => setProvincia(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          type="number"
          placeholder="Peso in kg"
          value={peso}
          onChange={e => setPeso(e.target.value)}
          className="border p-2 mr-2"
        />
        <button onClick={calcolaPrezzo} className="bg-black text-white px-4 py-2">
          Calcola costo
        </button>
      </div>

      {risultato && <p className="text-lg font-semibold">{risultato}</p>}
    </div>
  );
}
