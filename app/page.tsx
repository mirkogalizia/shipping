"use client";

import React, { useState, useEffect, Fragment } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

interface Tariffa {
  Provincia: string;
  Peso: number;
  Prezzo: number;
}

interface Rate {
  service_name: string;
  service_code: string;
  total_price: string; // in centesimi
  currency: string;
  description: string;
}

export default function Page() {
  const [tariffs, setTariffs] = useState<Tariffa[]>([]);
  const [provinceList, setProvinceList] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [rate, setRate] = useState<Rate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carica il JSON statico da public/tariffs.json
  useEffect(() => {
    fetch("/tariffs.json")
      .then(r => r.json())
      .then((data: Tariffa[]) => {
        setTariffs(data);
        const provs = Array.from(new Set(data.map(t => t.Provincia))).sort();
        setProvinceList(provs);
      })
      .catch(err => setError("Impossibile caricare tariffe: " + err.message));
  }, []);

  const filteredProvinces =
    query === ""
      ? provinceList
      : provinceList.filter(p => p.toLowerCase().includes(query.toLowerCase()));

  async function handleCalcola() {
    setError(null);
    setRate(null);
    if (!selectedProvince || !peso) {
      setError("Seleziona provincia e inserisci peso");
      return;
    }
    const pesoKg = parseFloat(peso);
    if (isNaN(pesoKg) || pesoKg <= 0) {
      setError("Peso non valido");
      return;
    }
    setLoading(true);
    try {
      const grams = Math.round(pesoKg * 1000);
      const res = await fetch("/api/carrier-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate: {
            shipping_address: { province: selectedProvince },
            line_items: [{ grams, quantity: 1 }]
          }
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore dal server");
      }
      const json = await res.json();
      setRate(json.rates[0]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Calcolo Spedizione</h1>
        {error && <div className="mb-4 text-red-600">{error}</div>}

        <div className="mb-4">
          <Combobox value={selectedProvince} onChange={setSelectedProvince} nullable>
            <Combobox.Label className="block text-gray-700">Provincia</Combobox.Label>
            <div className="relative mt-1">
              <Combobox.Input
                className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-400"
                placeholder="Cerca provincia..."
                onChange={e => setQuery(e.target.value)}
                displayValue={(prov: string) => prov}
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
              </Combobox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded bg-white shadow-lg z-10">
                  {filteredProvinces.length === 0 && query !== "" ? (
                    <div className="p-2 text-gray-500">Nessuna provincia</div>
                  ) : (
                    filteredProvinces.map((prov, idx) => (
                      <Combobox.Option
                        key={idx}
                        value={prov}
                        className={({ active }) =>
                          `cursor-pointer select-none p-2 ${active ? "bg-blue-100" : ""}`
                        }
                      >
                        {({ selected }) => (
                          <div className="flex items-center">
                            {selected && <CheckIcon className="h-4 w-4 text-blue-600 mr-2" />}
                            <span>{prov}</span>
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
          <label className="block text-gray-700">Peso (kg)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={handleCalcola}
          disabled={loading}
          className={`w-full py-2 rounded text-white ${
            loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Calcolo..." : "Calcola Costo"}
        </button>

        {rate && (
          <div className="mt-6 bg-gray-100 p-4 rounded">
            <p className="font-semibold">{rate.service_name}</p>
            <p>
              Totale:{" "}
              <span className="font-bold">
                {(parseInt(rate.total_price, 10) / 100).toFixed(2)}€
              </span>
            </p>
            <p className="text-sm text-gray-600">{rate.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}


