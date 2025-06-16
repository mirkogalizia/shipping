// Struttura definitiva del progetto Shopify Shipping App

/*
File: app/page.tsx
*/
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

interface Tariffa { Provincia: string; Peso: number; Prezzo: number; }
interface Breakdown { bancali: number; baseCost: number; fuelSurcharge: number; iva: number; total: number; }

export default function Dashboard() {
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const VAT_RATE = 0.22;            // 22% IVA
  const FUEL_SURCHARGE_RATE = 0.025; // 2.5% supplemento carburante

  // Mappa codici provincia a nome completo usati nel file Excel
  const provinceMap: Record<string, string> = {
    AG: "AGRIGENTO", AL: "ALESSANDRIA", AN: "ANCONA", AO: "AOSTA", AR: "AREZZO",
    AP: "ASCOLI PICENO", AT: "ASTI", AV: "AVELLINO", BA: "BARI", BG: "BERGAMO",
    BI: "BIELLA", BL: "BELLUNO", BN: "BENEVENTO", BO: "BOLOGNA", BR: "BRINDISI",
    BS: "BRESCIA", BT: "BARLETTA-ANDRIA-TRANI", CA: "CAGLIARI", CB: "CAMPOBASSO",
    CE: "CASERTA", CG: "CAGLIARI", CH: "CHIETI", CI: "CARBONIA-IGLESIAS", CL: "CALTANISSETTA",
    CN: "CUNEO", CO: "COMO", CR: "CREMONA", CS: "COSENZA", CT: "CATANIA",
    CZ: "CATANZARO", EN: "ENNA", FC: "FORLI'-CESENA", FE: "FERRARA", FG: "FOGGIA",
    FI: "FIRENZE", FM: "Fermo", FR: "FROSINONE", GE: "GENOVA", GO: "GORIZIA",
    GR: "GROSSETO", IM: "IMPERIA", IS: "ISERNIA", KR: "CROTONE", LC: "LECCO",
    LE: "LECCE", LI: "LIVORNO", LO: "LODI", LU: "LUCCA", MB: "MONZA BRIANZA",
    MC: "MACERATA", ME: "MESSINA", MI: "MILANO", MN: "MANTOVA", MO: "MODENA",
    MS: "MASSA CARRARA", MT: "MATERA", NA: "NAPOLI", NO: "NOVARA", NP: "NAPOLI",
    NU: "NUORO", OR: "ORISTANO", PA: "PALERMO", PC: "PIACENZA", PD: "PADOVA",
    PE: "PESCARA", PG: "PERUGIA", PI: "PISA", PN: "PORDENONE", PO: "PRATO",
    PR: "PARMA", PT: "PISTOIA", PU: "PESARO URBINO", PV: "PAVIA", PZ: "POTENZA",
    RA: "RAVENNA", RC: "REGGIO CALABRIA", RE: "REGGIO EMILIA", RG: "RAGUSA",
    RI: "RIETI", RM: "ROMA", RN: "RIMINI", RO: "ROVIGO", SA: "SALERNO",
    SI: "SIENA", SO: "SONDRIO", SP: "SPEZIA", SR: "SIRACUSA", SS: "SASSARI",
    SV: "SAVONA", TA: "TARANTO", TE: "TERAMO", TN: "TRENTO", TO: "TORINO",
    TP: "TRAPANI", TR: "TERNI", TS: "TRIESTE", TV: "TREVISO", VA: "VARESE",
    VB: "VERBANIA", VC: "VERCELLI", VE: "VENEZIA", VI: "VICENZA", VR: "VERONA",
    VT: "VITERBO", VS: "SUD SARDEGNA"
  };

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      const weightsRow = raw[3];
      const rows = raw.slice(4).filter((r: any) => r[1]);
      const tariffs: Tariffa[] = [];

      rows.forEach((r: any) => {
        const prov = String(r[1]).trim();
        weightsRow.forEach((cell: any, idx: number) => {
          if (idx < 2) return;
          let wtVal = parseFloat(
            String(cell).replace(/[^0-9.,]/g, "").replace(",", ".")
          );
          if (isNaN(wtVal)) return;
          const wt = wtVal < 10 ? wtVal * 1000 : wtVal;
          const price = parseFloat(
            String(r[idx]).replace(/[^0-9.,]/g, "").replace(",", ".")
          );
          if (!isNaN(price)) {
            tariffs.push({ Provincia: prov, Peso: wt, Prezzo: price });
          }
        });
      });

      setData(tariffs);
      setBreakdown(null);
    };
    reader.readAsBinaryString(file);
  }

  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!provincia || pesoKg <= 0 || data.length === 0) {
      setBreakdown(null);
      return;
    }
    // Converti codice provincia to nome completo
    const provCode = provincia.trim().toUpperCase();
    const provName = provinceMap[provCode] || provincia;

    const list = data
      .filter(d => d.Provincia.toLowerCase() === provName.toLowerCase())
      .sort((a, b) => a.Peso - b.Peso);
    let rem = pesoKg;
    let baseCost = 0;
    let bancali = 0;
    while (rem > 0 && list.length) {
      bancali += 1;
      const entry = list.find(d => d.Peso >= rem) || list[list.length - 1];
      baseCost += entry.Prezzo;
      rem -= entry.Peso;
    }
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    setBreakdown({ bancali, baseCost, fuelSurcharge: fuel, iva, total: subtotal + iva });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tariffe Spedizione Personalizzate</h1>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="mb-4"
      />

      {data.length > 0 && (
        <div className="mb-6 overflow-auto">
          <h2 className="text-xl font-semibold mb-2">Tutte le tariffe importate:</h2>
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Provincia</th>
                <th className="border p-2">Peso (kg)</th>
                <th className="border p-2">Prezzo (€)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="border p-2">{row.Provincia}</td>
                  <td className="border p-2">{row.Peso}</td>
                  <td className="border p-2">€{row.Prezzo.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-4">
        <input
          placeholder="Codice Provincia (es. MI)"
          value={provincia}
          onChange={e => setProvincia(e.target.value)}
          className="border p-2 mr-2"
        />
        <input
          placeholder="Peso in kg"
          type="number"
          value={peso}
          onChange={e => setPeso(e.target.value)}
          className="border p-2 mr-2"
        />
        <button
          onClick={calcolaPrezzo}
          className="bg-black text-white px-4 py-2"
        >
          Calcola costo
        </button>
      </div>

      {breakdown && (
        <div className="bg-gray-100 p-4 rounded whitespace-pre-line">
          <p><strong>Numero bancali:</strong> {breakdown.bancali}</p>
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
