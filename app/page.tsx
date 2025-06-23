// File: app/page.tsx
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import './globals.css';

interface Tariffa { Provincia: string; Peso: number; Prezzo: number; }
interface Breakdown { bancali: number; baseCost: number; fuelSurcharge: number; iva: number; total: number; }

enum Region {
  NORD = "Nord",
  CENTRO = "Centro",
  SUD = "Sud",
  ISOLE = "Isole"
}

// Mappa province a regioni (senza duplicati)
const regionMap: Record<string, Region> = {
  // Nord
  AO: Region.NORD, BI: Region.NORD, BL: Region.NORD, BS: Region.NORD, CO: Region.NORD,
  CR: Region.NORD, CN: Region.NORD, GE: Region.NORD, GO: Region.NORD, LC: Region.NORD,
  LO: Region.NORD, MI: Region.NORD, MB: Region.NORD, NO: Region.NORD, PV: Region.NORD,
  VR: Region.NORD, VI: Region.NORD,
  // Centro
  FI: Region.CENTRO, FR: Region.CENTRO, GR: Region.CENTRO, LI: Region.CENTRO,
  LU: Region.CENTRO, PI: Region.CENTRO, PT: Region.CENTRO, RM: Region.CENTRO,
  RI: Region.CENTRO, TE: Region.CENTRO, TR: Region.CENTRO,
  // Sud
  AV: Region.SUD, BA: Region.SUD, BN: Region.SUD, BR: Region.SUD, BT: Region.SUD,
  CE: Region.SUD, CS: Region.SUD, FG: Region.SUD, SA: Region.SUD, TA: Region.SUD,
  // Isole
  CA: Region.ISOLE, CL: Region.ISOLE, ME: Region.ISOLE, NU: Region.ISOLE, OR: Region.ISOLE,
  SS: Region.ISOLE
};

export default function Dashboard() {
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const VAT_RATE = 0.22;
  const FUEL_SURCHARGE_RATE = 0.025;

  // Carica tariffe salvate
  useEffect(() => {
    const saved = localStorage.getItem('tariffsData');
    if (saved) {
      try { setData(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Upload e parsing Excel
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header:1 }) as any[][];
      const weights = raw[3] || [];
      const rows = raw.slice(4).filter(r => r[1]);
      const tariffs: Tariffa[] = [];
      rows.forEach(r => {
        const prov = String(r[1]).trim();
        weights.forEach((cell, idx) => {
          if (idx < 2) return;
          const w = parseFloat(String(cell).replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (isNaN(w)) return;
          const wt = w < 10 ? w * 1000 : w;
          const price = parseFloat(String(r[idx]).replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(price)) tariffs.push({ Provincia: prov, Peso: wt, Prezzo: price });
        });
      });
      setData(tariffs);
      localStorage.setItem('tariffsData', JSON.stringify(tariffs));
      setBreakdown(null);
    };
    reader.readAsBinaryString(file);
  }

  // Calcolo spedizione
  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!provincia || pesoKg <=0 || data.length===0) { setBreakdown(null); return; }
    const code = provincia.trim().toUpperCase();
    const list = data.filter(d=>d.Provincia.toUpperCase().startsWith(code))
                     .sort((a,b)=>a.Peso-b.Peso);
    let rem = pesoKg, baseCost = 0, bancali = 0;
    while(rem>0 && list.length) {
      bancali++;
      const entry = list.find(d=>d.Peso>=rem) || list[list.length-1];
      baseCost += entry.Prezzo;
      rem -= entry.Peso;
    }
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    setBreakdown({ bancali, baseCost, fuelSurcharge:fuel, iva, total:subtotal+iva });
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Calcolo Spedizioni</h1>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
          className="w-full border rounded p-2 mb-4" />
        <div className="flex space-x-4 mb-6">
          <input value={provincia} onChange={e=>setProvincia(e.target.value)} placeholder="Provincia (MI)"
            className="border rounded p-2 flex-1" />
          <input value={peso} onChange={e=>setPeso(e.target.value)} placeholder="Peso kg" type="number"
            className="border rounded p-2 w-24" />
          <button onClick={calcolaPrezzo} className="bg-blue-600 text-white rounded p-2">Calcola</button>
        </div>
        {breakdown && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded text-center">
              <div className="text-sm text-gray-500">Bancali</div>
              <div className="text-lg font-bold">{breakdown.bancali}</div>
            </div>
            <div className="bg-green-50 p-4 rounded text-center">
              <div className="text-sm text-gray-500">Base (€)</div>
              <div className="text-lg font-bold">{breakdown.baseCost.toFixed(2)}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded text-center">
              <div className="text-sm text-gray-500">Carburante (€)</div>
              <div className="text-lg font-bold">{breakdown.fuelSurcharge.toFixed(2)}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded text-center">
              <div className="text-sm text-gray-500">IVA (€)</div>
              <div className="text-lg font-bold">{breakdown.iva.toFixed(2)}</div>
            </div>
            <div className="col-span-2 bg-gray-100 p-4 rounded text-center">
              <div className="text-sm text-gray-500">Totale (€)</div>
              <div className="text-2xl font-extrabold">{breakdown.total.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Raggruppamento Tariffe per Regione */}
      {Object.entries(regionMap).length>0 && (data.length>0) && (
        <div className="max-w-4xl mx-auto space-y-8">
          {Object.entries(regionMap).reduce((acc, [prov, reg]) => {
            if(!acc[reg]) acc[reg]=[];
            acc[reg].push(...data.filter(d=>d.Provincia.toUpperCase().startsWith(prov)));
            return acc;
          }, {} as Record<string, Tariffa[]>).map(([reg, list]) => (
            list.length>0 && (
              <section key={reg} className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">{reg}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {list.map((t,i)=>(
                    <div key={i} className="border p-4 rounded">
                      <div className="font-bold">{t.Provincia}</div>
                      <div>{t.Peso} kg</div>
                      <div>€{t.Prezzo.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}
    </div>
  );
}
