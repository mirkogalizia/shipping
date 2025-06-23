// File: app/page.tsx
"use client";

import { useState, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import './globals.css';

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

  // Load saved tariffs
  useEffect(() => {
    const saved = localStorage.getItem('tariffsData');
    if (saved) {
      const parsed: Tariffa[] = JSON.parse(saved);
      setData(parsed);
      const provinces = Array.from(new Set(parsed.map(t => t.Provincia))).sort();
      setProvinceList(provinces);
    }
  }, []);

  // Filtered for combobox
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
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Calcolo Spedizioni</h1>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
          className="w-full border rounded p-2 mb-4" />

        {provinceList.length > 0 && (
          <div className="space-y-4 mb-4">
            <Combobox value={selectedProvince} onChange={setSelectedProvince} nullable>
              <div className="relative">
                <Combobox.Input
                  className="w-full border rounded p-2"
                  placeholder="Cerca Provincia..."
                  onChange={e => setQuery(e.target.value)}
                  displayValue={(prov: string | null) => prov || ''}
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </Combobox.Button>

                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                  className="absolute mt-1 w-full bg-white shadow-lg max-h-60 overflow-auto rounded-md z-10"
                >
                  <Combobox.Options>
                    {filteredProvinces.length === 0 && query !== '' ? (
                      <div className="p-2 text-gray-500">Nessuna provincia trovata.</div>
                    ) : (
                      filteredProvinces.map((p, idx) => (
                        <Combobox.Option
                          key={idx}
                          value={p}
                          className={({ active }) =>
                            `cursor-pointer select-none p-2 ${active ? 'bg-blue-100' : ''}`
                          }
                        >
                          {({ selected, active }) => (
                            <div className="flex items-center">
                              {selected && <CheckIcon className="h-5 w-5 text-blue-600 mr-2" />}
                              <span className={`${selected ? 'font-semibold' : ''}`}>{p}</span>
                            </div>
                          )}
                        </Combobox.Option>
                      ))
                    )}
                  </Combobox.Options>
                </Transition>
              </div>
            </Combobox>

            <input value={peso} onChange={e => setPeso(e.target.value)} placeholder="Peso (kg)" type="number"
              className="w-full border rounded p-2" />

            <button onClick={calcolaPrezzo}
              className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700">
              Calcola
            </button>
          </div>
        )}

        {breakdown && (
          <div className="space-y-2 mt-4 p-4 bg-gray-50 rounded">
            <div><strong>Bancali:</strong> {breakdown.bancali}</div>
            <div><strong>Costo Base:</strong> €{breakdown.baseCost.toFixed(2)}</div>
            <div><strong>Carburante (2.5%):</strong> €{breakdown.fuelSurcharge.toFixed(2)}</div>
            <div><strong>IVA (22%):</strong> €{breakdown.iva.toFixed(2)}</div>
            <div className="text-lg font-bold mt-2"><strong>Totale:</strong> €{breakdown.total.toFixed(2)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
