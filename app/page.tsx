// File: app/page.tsx
"use client";

import { useState, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface Tariffa { Provincia: string; Peso: number; Prezzo: number; }
interface Breakdown { bancali: number; baseCost: number; fuelSurcharge: number; iva: number; total: number; }

export default function Dashboard() {
  const [data, setData] = useState<Tariffa[]>([]);
  const [provinceList, setProvinceList] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const VAT_RATE = 0.22;
  const FUEL_SURCHARGE_RATE = 0.025;

  useEffect(() => {
    const saved = localStorage.getItem('tariffsData');
    if (saved) {
      const parsed: Tariffa[] = JSON.parse(saved);
      setData(parsed);
      const provinces = Array.from(new Set(parsed.map(t => t.Provincia))).sort();
      setProvinceList(provinces);
    }
  }, []);

  const filteredProvinces =
    query === ''
      ? provinceList
      : provinceList.filter(p => p.toLowerCase().includes(query.toLowerCase()));

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
      const provinces = Array.from(new Set(tariffs.map(t => t.Provincia))).sort();
      setProvinceList(provinces);
      setSelectedProvince(null);
      setQuery("");
      setBreakdown(null);
    };
    reader.readAsBinaryString(file);
  }

  function calcolaPrezzo() {
    const pesoKg = parseFloat(peso);
    if (!selectedProvince || pesoKg <= 0 || data.length === 0) { setBreakdown(null); return; }
    const list = data.filter(d => d.Provincia === selectedProvince).sort((a, b) => a.Peso - b.Peso);
    let rem = pesoKg, baseCost = 0, bancali = 0;
    while (rem > 0) {
      bancali++;
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
    <div className="min-h-screen bg-indigo-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-extrabold text-center text-indigo-600 mb-6">Calcolo Spedizioni</h1>
        <label className="block mb-2 font-medium text-gray-700">Carica tariffe Excel</label>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
          className="w-full file:py-2 file:px-4 file:border file:border-gray-300 file:rounded file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-6" />

        {provinceList.length > 0 && (
          <>
            <div className="mb-4">
              <label className="block mb-1 font-medium text-gray-700">Provincia</label>
              <Combobox value={selectedProvince} onChange={setSelectedProvince} nullable>
                <div className="relative">
                  <Combobox.Input
                    className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Cerca Provincia..."
                    onChange={e => setQuery(e.target.value)}
                    displayValue={(prov: string | null) => prov || ''}
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                  </Combobox.Button>

                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Combobox.Options className="absolute mt-1 w-full bg-white shadow-lg max-h-60 overflow-auto rounded-md z-10">
                      {filteredProvinces.length === 0 && query !== '' ? (
                        <div className="p-2 text-gray-500">Nessuna provincia trovata.</div>
                      ) : (
                        filteredProvinces.map((p, idx) => (
                          <Combobox.Option
                            key={idx}
                            value={p}
                            className={({ active }) =>
                              `cursor-pointer select-none p-2 ${active ? 'bg-indigo-100' : ''}`
                            }
                          >
                            {({ selected }) => (
                              <div className="flex items-center">
                                {selected && <CheckIcon className="h-5 w-5 text-indigo-600 mr-2" />}
                                <span className={selected ? 'font-medium' : 'font-normal'}>{p}</span>
                              </div>
                            )}
                          </Combobox.Option>
                        ))
                      )}
                    </Combobox.Options>
                  </Transition>
                </div>
              </Combobox>
            </div>

            <div className="mb-6">
              <label className="block mb-1 font-medium text-gray-700">Peso (kg)</label>
              <input value={peso} onChange={e => setPeso(e.target.value)} type="number"
                className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>

            <button onClick={calcolaPrezzo}
              className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-md hover:bg-indigo-700 transition">
              Calcola Costo
            </button>
          </>
        )}

        {breakdown && (
          <div className="mt-6 bg-gray-50 p-4 rounded-md border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Risultati</h2>
            <ul className="space-y-1 text-gray-700">
              <li><strong>Bancali:</strong> {breakdown.bancali}</li>
              <li><strong>Base (€):</strong> €{breakdown.baseCost.toFixed(2)}</li>
              <li><strong>Carburante (2.5%):</strong> €{breakdown.fuelSurcharge.toFixed(2)}</li>
              <li><strong>IVA (22%):</strong> €{breakdown.iva.toFixed(2)}</li>
            </ul>
            <div className="mt-4 text-2xl font-extrabold text-indigo-700 text-right">
              Totale:&nbsp;€{breakdown.total.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
