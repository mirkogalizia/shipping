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
  // Configurazione Shopify dinamica
  const [shopStore, setShopStore] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('shopStore') || '' : '');
  const [shopApiKey, setShopApiKey] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('shopApiKey') || '' : '');
  const [shopApiSecret, setShopApiSecret] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('shopApiSecret') || '' : '');
  const [apiVersion, setApiVersion] = useState<string>(typeof window !== 'undefined' ? localStorage.getItem('apiVersion') || '2025-04' : '2025-04');

  // Persistenza configurazioni
  useEffect(() => { localStorage.setItem('shopStore', shopStore); }, [shopStore]);
  useEffect(() => { localStorage.setItem('shopApiKey', shopApiKey); }, [shopApiKey]);
  useEffect(() => { localStorage.setItem('shopApiSecret', shopApiSecret); }, [shopApiSecret]);
  useEffect(() => { localStorage.setItem('apiVersion', apiVersion); }, [apiVersion]);

  // Dati tariffe e input utente
  const [data, setData] = useState<Tariffa[]>([]);
  const [provincia, setProvincia] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const VAT_RATE = 0.22;
  const FUEL_SURCHARGE_RATE = 0.025;

  // Caricamento dati Excel da localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tariffsData');
    if (saved) setData(JSON.parse(saved));
  }, []);

  // Mappa province 2-letter
  const provinceMap: Record<string,string> = { MI: "MILANO", RM: "ROMA" /* ...aggiungi tutte... */};

  // Parsing Excel
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: any) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header:1 }) as any[][];
      const weightsRow = raw[3];
      const rows = raw.slice(4).filter(r => r[1]);
      const tariffs: Tariffa[] = [];
      rows.forEach(r => {
        const prov = String(r[1]).trim();
        weightsRow.forEach((cell, idx) => {
          if (idx < 2) return;
          const wtVal = parseFloat(String(cell).replace(/[^0-9.,]/g,'').replace(',','.'));
          if (isNaN(wtVal)) return;
          const wt = wtVal < 10 ? wtVal * 1000 : wtVal;
          const price = parseFloat(String(r[idx]).replace(/[^0-9.,]/g,'').replace(',','.'));
          if (!isNaN(price)) tariffs.push({ Provincia:prov, Peso:wt, Prezzo:price });
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
    if (!provincia || pesoKg <= 0 || !data.length) { setBreakdown(null); return; }
    const code = provincia.trim().toUpperCase();
    const fullProv = provinceMap[code] || provincia;
    const list = data.filter(d=>d.Provincia.toLowerCase() === fullProv.toLowerCase()).sort((a,b)=>a.Peso-b.Peso);
    let rem = pesoKg, baseCost = 0, bancali = 0;
    while(rem > 0 && list.length) { bancali++; const e = list.find(d=>d.Peso >= rem) || list[list.length-1]; baseCost+=e.Prezzo; rem-=e.Peso; }
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    setBreakdown({ bancali, baseCost, fuelSurcharge: fuel, iva, total: subtotal + iva });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      {/* Config Shopify */}
      <section className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">Configurazione Shopify</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input value={shopStore} onChange={e=>setShopStore(e.target.value)} placeholder="Store domain"
            className="border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:outline-none" />
          <input value={shopApiKey} onChange={e=>setShopApiKey(e.target.value)} placeholder="API Key"
            className="border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:outline-none" />
          <input value={shopApiSecret} onChange={e=>setShopApiSecret(e.target.value)} placeholder="API Secret"
            className="border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:outline-none" />
          <input value={apiVersion} onChange={e=>setApiVersion(e.target.value)} placeholder="API Version"
            className="border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:outline-none" />
        </div>
        <button onClick={()=>alert('Configurazione salvata')} className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full px-6 py-2 hover:opacity-90">
          Salva Configurazione
        </button>
      </section>

      {/* Upload Excel */}
      <section className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">Importa Tariffe</h2>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
          className="w-full border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 hover:border-blue-500" />
      </section>

      {/* Tariffe Tabella */}
      {data.length > 0 && (
        <section className="bg-white shadow-xl rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-2xl font-bold mb-4">Elenco Tariffe</h2>
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">Provincia</th>
                <th className="px-4 py-2">Peso (kg)</th>
                <th className="px-4 py-2">Prezzo (€)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row,i)=>(
                <tr key={i} className={i % 2 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2">{row.Provincia}</td>
                  <td className="px-4 py-2">{row.Peso}</td>
                  <td className="px-4 py-2">€{row.Prezzo.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Calcolo */}
      <section className="bg-white shadow-xl rounded-2xl p-6">
        <h2 className="text-2xl font-bold mb-4">Calcolo Spedizione</h2>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input placeholder="Codice Provincia"
            value={provincia} onChange={e=>setProvincia(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 flex-1 focus:ring-blue-500 focus:outline-none" />
          <input placeholder="Peso in kg" type="number"
            value={peso} onChange={e=>setPeso(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 w-32 focus:ring-blue-500 focus:outline-none" />
          <button onClick={calcolaPrezzo}
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-full px-6 py-3 hover:opacity-90">
            Calcola
          </button>
        </div>
        {breakdown && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Bancali</p>
              <p className="text-xl font-bold text-blue-700">{breakdown.bancali}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Base</p>
              <p className="text-xl font-bold text-green-700">€{breakdown.baseCost.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Carburante</p>
              <p className="text-xl font-bold text-yellow-700">€{breakdown.fuelSurcharge.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">IVA</p>
              <p className="text-xl font-bold text-purple-700">€{breakdown.iva.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg text-center">
              <p className="text-sm text-gray-500">Totale</p>
              <p className="text-2xl font-extrabold text-gray-900">€{breakdown.total.toFixed(2)}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
