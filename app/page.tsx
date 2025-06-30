"use client";

import React, { useState, useEffect, Fragment } from "react";
import { Combobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

interface Tariffa {
  Provincia: string;
  Peso: number;
  Prezzo: number;
}

interface RateResponse {
  rates: {
    service_name: string;
    service_code: string;
    total_price: string; // in centesimi
    currency: string;
    description: string;
  }[];
}

export default function CheckoutRates() {
  const [tariffs, setTariffs] = useState<Tariffa[]>([]);
  const [provinceList, setProvinceList] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [peso, setPeso] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState<RateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carica JSON delle tariffe una volta
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
    if (!selectedProvince || !peso) {
      setError("Seleziona provincia e inserisci peso");
      return;
    }
    setError(null);
    setLoading(true);
    setRate(null);

    try {
      const grams = Math.round(parseFloat(peso) * 1000);
      const response = await fetch("/api/carrier-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate: {
            shipping_address: { province: selectedProvince },
            line_items: [{ grams, quantity: 1 }],
          },
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore dal server");
      }
      const json: RateResponse = await response.json();
      setRate(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Calcolo Spedizione</h1>

        {error && (
          <div className="mb-4 text-red-600">
            {error}
          </div>
        )}

        <div className="mb-4">
          <Combobox value={selectedProvince} onChange={setSelectedProvince} nullable>
            <Combobox.Label className="block text-gray-700">Provincia</Combobox.Label>
            <div className="relative mt-1">
              <Combobox.Input
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Cerca Provincia"
                onChange={e => {
                  setQuery(e.target.value);
                }}
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
                <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded bg-white py-1 shadow-lg">
                  {filteredProvinces.length === 0 && query !== "" ? (
                    <div className="px-3 py-2 text-gray-500">Nessuna provincia</div>
                  ) : (
                    filteredProvinces.map((prov, idx) => (
                      <Combobox.Option
                        key={idx}
                        value={prov}
                        className={({ active }) =>
                          `cursor-pointer select-none px-3 py-2 ${active ? "bg-blue-100" : ""}`
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
            className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={handleCalcola}
          disabled={loading}
          className={`w-full py-2 rounded text-white ${
            loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Calcolo in corso..." : "Calcola Costo"}
        </button>

        {rate && (
          <div className="mt-6 bg-gray-100 p-4 rounded">
            {rate.rates.map(r => (
              <div key={r.service_code}>
                <p className="font-semibold">{r.service_name}</p>
                <p>
                  Totale: <span className="font-bold">{(parseInt(r.total_price) / 100).toFixed(2)}€</span>
                </p>
                <p className="text-sm text-gray-600">{r.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



