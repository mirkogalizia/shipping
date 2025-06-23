/*
File: app/page.tsx
*/
"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import './globals.css';

interface Tariffa { Provincia: string; Peso: number; Prezzo: number; }
interface Breakdown { bancali: number; baseCost: number; fuelSurcharge: number; iva: number; total: number; }

export default function Dashboard() {
  // Stati principali
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const VAT_RATE = 0.22;
  const FUEL_SURCHARGE_RATE = 0.025;

  // Carica tariffe salvate su localStorage al mount
  useEffect(() => {
    const saved = localStorage.getItem('tariffsData');
    if (saved) {
      try { setData(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Mappa province (completa) oppure userà nome raw
  const provinceMap: Record<string,string> = {
    AG: "AGRIGENTO", AL: "ALESSANDRIA", AN: "ANCONA", AO: "AOSTA", AR: "AREZZO",
    AP: "ASCOLI PICENO", AT: "ASTI", AV: "AVELLINO", BA: "BARI", BG: "BERGAMO",
    BI: "BIELLA", BL: "BELLUNO", BN: "BENEVENTO", BO: "BOLOGNA", BR: "BRINDISI",
    BS: "BRESCIA", BT: "BARLETTA-ANDRIA-TRANI", CA: "CAGLIARI", CB: "CAMPOBASSO",
    CE: "CASERTA", CH: "CHIETI", CL: "CALTANISSETTA", CN: "CUNEO", CO: "COMO",
    CR: "CREMONA", CS: "COSENZA", CT: "CATANIA", CZ: "CATANZARO", EN: "ENNA",
    FC: "FORLI'-CESENA", FE: "FERRARA", FG: "FOGGIA", FI: "FIRENZE", FR: "FROSINONE",
    GE: "GENOVA", GO: "GORIZIA", GR: "GROSSETO", IM: "IMPERIA", IS: "ISERNIA",
    KR: "CROTONE", LC: "LECCO", LE: "LECCE", LI: "LIVORNO", LO: "LODI",
    LU: "LUCCA", MB: "MONZA BRIANZA", MC: "MACERATA", ME: "MESSINA", MI: "MILANO",
    MN: "MANTOVA", MO: "MODENA", MS: "MASSA CARRARA", MT: "MATERA", NA: "NAPOLI",
    NO: "NOVARA", NU: "NUORO", OR: "ORISTANO", PA: "PALERMO", PC: "PIACENZA",
    PD: "PADOVA", PE: "PESCARA", PG: "PERUGIA", PI: "PISA", PN: "PORDENONE",
    PR: "PARMA", PT: "PISTOIA", PU: "PESARO URBINO", PV: "PAVIA", PZ: "POTENZA",
    RA: "RAVENNA", RC: "REGGIO CALABRIA", RE: "REGGIO EMILIA", RG: "RAGUSA",
    RI: "RIETI", RM: "ROMA", RN: "RIMINI", RO: "ROVIGO", SA: "SALERNO",
    SI: "SIENA", SO: "SONDRIO", SP: "SPEZIA", SR: "SIRACUSA", SS: "SASSARI",
    SV: "SAVONA", TA: "TARANTO", TE: "TERAMO", TN: "TRENTO", TO: "TORINO",
    TP: "TRAPANI", TR: "TERNI", TS: "TRIESTE", TV: "TREVISO", VA: "VARESE",
    VB: "VERBANIA", VC: "VERCELLI", VE: "VENEZIA", VI: "VICENZA", VR: "VERONA",
    VT: "VITERBO", VS: "SUD SARDEGNA"
  };

  // Upload e parsing del file Excel
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
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

  // Calcola spedizione in base a provincia e peso
  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!provincia || pesoKg <= 0 || data.length === 0) {
      setBreakdown(null); return;
    }
    const code = provincia.trim().toUpperCase();
    const fullProv = provinceMap[code] || provincia;
    const list = data.filter(d => d.Provincia.toLowerCase() === fullProv.toLowerCase())
                     .sort((a, b) => a.Peso - b.Peso);
    let rem = pesoKg, baseCost = 0, bancali = 0;
    while (rem > 0 && list.length) {
      bancali++;
      const e = list.find(d => d.Peso >= rem) || list[list.length - 1];
      baseCost += e.Prezzo;
      rem -= e.Peso;
    }
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    setBreakdown({ bancali, baseCost, fuelSurcharge: fuel, iva, total: subtotal + iva });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold">Calcolo Spedizione Personalizzata</h1>

      {/* File Upload */}
      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
        className="border rounded p-2 w-full" />

      {/* Tabella Tariffe */}
      {data.length > 0 && (
        <table className="w-full table-auto border-collapse mt-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">Provincia</th>
              <th className="border p-2">Peso (kg)</th>
              <th className="border p-2">Prezzo (€)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i % 2 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border p-2">{row.Provincia}</td>
                <td className="border p-2">{row.Peso}</td>
                <td className="border p-2">€{row.Prezzo.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Input e Risultato */}
      <div className="flex items-center space-x-4 mt-4">
        <input placeholder="Provincia (es. MI)" value={provincia} onChange={e => setProvincia(e.target.value)}
          className="border rounded p-2 w-32" />
        <input placeholder="Peso kg" type="number" value={peso} onChange={e => setPeso(e.target.value)}
          className="border rounded p-2 w-24" />
        <button onClick={calcolaPrezzo} className="bg-black text-white px-4 py-2 rounded">Calcola</button>
      </div>

      {breakdown && (
        <div className="mt-4 space-y-2">
          <p><strong>Bancali:</strong> {breakdown.bancali}</p>
          <p><strong>Costo base:</strong> €{breakdown.baseCost.toFixed(2)}</p>
          <p><strong>Carburante (2.5%):</strong> €{breakdown.fuelSurcharge.toFixed(2)}</p>
          <p><strong>IVA (22%):</strong> €{breakdown.iva.toFixed(2)}</p>
          <p className="text-lg font-bold"><strong>Totale:</strong> €{breakdown.total.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
