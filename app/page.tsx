"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface Tariffa { Provincia: string; Peso: number; Prezzo: number; }
interface Breakdown { baseCost: number; fuelSurcharge: number; iva: number; total: number; }

export default function Dashboard() {
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const VAT_RATE = 0.22;
  const FUEL_SURCHARGE_RATE = 0.025;

  function handleFileUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const weightsRow = raw[3];
      const rows = raw.slice(4).filter((r:any) => r[1]);
      const tariffs: Tariffa[] = [];
      rows.forEach((r:any) => {
        const prov = String(r[1]).trim();
        weightsRow.forEach((cell:any, idx:number) => {
          if (idx < 2) return;
          const wt = parseFloat(String(cell).replace(/[^0-9.,]/g, '').replace(',', '.'));
          const price = parseFloat(String(r[idx]).replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(wt) && !isNaN(price)) tariffs.push({ Provincia: prov, Peso: wt, Prezzo: price });
        });
      });
      setData(tariffs);
      setBreakdown(null);
    };
    reader.readAsBinaryString(file);
  }

  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!provincia || pesoKg <= 0 || data.length === 0) { setBreakdown(null); return; }
    const list = data.filter(d => d.Provincia.toLowerCase() === provincia.toLowerCase()).sort((a,b) => a.Peso - b.Peso);
    let rem = pesoKg, baseCost = 0;
    while (rem > 0) { const ent = list.find(d=>d.Peso>=rem)||list[list.length-1]; baseCost += ent.Prezzo; rem -= ent.Peso; }
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    setBreakdown({ baseCost, fuelSurcharge: fuel, iva, total: subtotal+iva });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tariffe Spedizione Personalizzate</h1>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="mb-4" />
      <div className="mb-4">
        <input placeholder="Provincia" value={provincia} onChange={e=>setProvincia(e.target.value)} className="border p-2 mr-2" />
        <input placeholder="Peso in kg" type="number" value={peso} onChange={e=>setPeso(e.target.value)} className="border p-2 mr-2" />
        <button onClick={calcolaPrezzo} className="bg-black text-white px-4 py-2">Calcola costo</button>
      </div>
      {breakdown && (
        <div className="bg-gray-100 p-4 rounded">
          <p><strong>Costo base:</strong> €{breakdown.baseCost.toFixed(2)}</p>
          <p><strong>Supplemento carburante (2.5%):</strong> €{breakdown.fuelSurcharge.toFixed(2)}</p>
          <p><strong>IVA (22%):</strong> €{breakdown.iva.toFixed(2)}</p>
          <hr className="my-2" />
          <p className="text-lg font-semibold"><strong>Totale:</strong> €{breakdown.total.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
