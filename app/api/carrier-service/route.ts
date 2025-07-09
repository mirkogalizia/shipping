// File: app/api/carrier-service/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Mappa sigla→nome esteso di tutte le province
const provinceMap: Record<string, string> = {
  AG: "AGRIGENTO", AL: "ALESSANDRIA", AN: "ANCONA", AO: "AOSTA", AR: "AREZZO",
  AT: "ASTI", AV: "AVELLINO", BA: "BARI", BG: "BERGAMO", BI: "BIELLA",
  BL: "BELLUNO", BN: "BENEVENTO", BO: "BOLOGNA", BR: "BRINDISI", BS: "BRESCIA",
  BT: "BARLETTA-ANDRIA-TRANI", BZ: "BOLZANO", CA: "CAGLIARI", CB: "CAMPOBASSO",
  CE: "CASERTA", CH: "CHIETI", CI: "CARBONIA-IGLESIAS", CN: "CUNEO", CO: "COMO",
  CR: "CREMONA", CS: "COSENZA", CT: "CATANIA", CZ: "CATANZARO", EN: "ENNA",
  FC: "FORLÌ-CESENA", FE: "FERRARA", FG: "FOGGIA", FI: "FIRENZE", FR: "FROSINONE",
  GE: "GENOVA", GO: "GORIZIA", GR: "GROSSETO", IM: "IMPERIA", IS: "ISERNIA",
  KR: "CROTONE", LC: "LECCO", LE: "LECCE", LI: "LIVORNO", LO: "LODI",
  LT: "LATINA", LU: "LUCCA", MB: "MONZA BRIANZA", MC: "MACERATA", ME: "MESSINA",
  MI: "MILANO", MN: "MANTOVA", MO: "MODENA", MS: "MASSA CARRARA", MT: "MATERA",
  NA: "NAPOLI", NO: "NOVARA", NP: "NORTHERN PROVINCE", NU: "NUORO", OR: "ORISTANO",
  PA: "PALERMO", PC: "PIACENZA", PD: "PADOVA", PE: "PESCARA", PG: "PERUGIA",
  PI: "PISA", PN: "PORDENONE", PO: "POZZUOLI", PR: "PARMA", PT: "PISTOIA",
  PU: "PESARO URBINO", PV: "PAVIA", PZ: "POTENZA", RA: "RAVENNA", RC: "REGGIO CALABRIA",
  RE: "REGGIO EMILIA", RG: "RAGUSA", RI: "RIETI", RM: "ROMA", RN: "RIMINI",
  RO: "ROVIGO", SA: "SALERNO", SI: "SIENA", SO: "SONDRIO", SP: "LA SPEZIA",
  SR: "SIRACUSA", SS: "SASSARI", SV: "ALESSANDRIA", TA: "TARANTO", TE: "TERAMO",
  TN: "TRENTO", TO: "TORINO", TP: "TRAPANI", TR: "TERNI", TS: "TRIESTE",
  TV: "TREVISO", UD: "UDINE", VA: "VARESE", VB: "VERBANIA", VC: "VERCELLI",
  VE: "VENEZIA", VI: "VICENZA", VR: "VERONA", VT: "VITERBO"
};

const VAT_RATE = 0.22;
const FUEL_SURCHARGE_RATE = 0.025;
// Peso di default (in grammi) per line_items senza peso
const DEFAULT_GRAMS = 1000;

export async function POST(req: NextRequest) {
  try {
    // 1) Carica le tariffe da public/tariffs.json
    const jsonPath = path.join(process.cwd(), "public", "tariffs.json");
    const file = await fs.readFile(jsonPath, "utf8");
    const tariffs = JSON.parse(file) as {
      Provincia: string;
      Peso: number;
      Prezzo: number;
    }[];

    // 2) Debug?
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // 3) Estrai il rate wrapper
    const { rate } = await req.json();
    console.log("➤ carrier-service payload:", JSON.stringify(rate));

    // 4) Leggi la provincia (destination)
    const rawProv = (rate.destination?.province || "").toString().trim();
    if (!rawProv) {
      return NextResponse.json({ error: "Provincia non valida" }, { status: 400 });
    }
    const key = rawProv.toUpperCase();
    const prov = provinceMap[key] || rawProv.toUpperCase();

    // 5) Calcola peso totale in kg con fallback DEFAULT_GRAMS
    const items = rate.line_items || rate.items || [];
    const pesoTotaleKg =
      items
        .map(li => ({
          ...li,
          grams: (li.grams && li.grams > 0) ? li.grams : DEFAULT_GRAMS
        }))
        .reduce((sum, i) => sum + (Number(i.grams) * (i.quantity || 1)), 0)
      / 1000;
    if (pesoTotaleKg <= 0) {
      return NextResponse.json({ error: "Peso non valido" }, { status: 400 });
    }

    // 6) Filtra tariffe per provincia
    const list = tariffs
      .filter(t => t.Provincia.toUpperCase() === prov)
      .sort((a, b) => a.Peso - b.Peso);
    if (list.length === 0) {
      return NextResponse.json(
        { error: `Provincia "${rawProv}" (${prov}) non trovata.` },
        { status: 400 }
      );
    }

    // 7) Calcolo bancali con scarto +10%
    const MAX_PER_PALLET = 1000;
    const pesoConScarto = pesoTotaleKg * 1.1;

    // costruisci le fasce fino a 1000kg
    const bracketWeights = list.map(t => t.Peso).filter(w => w <= MAX_PER_PALLET);
    const bracketPrices = list.filter(t => t.Peso <= MAX_PER_PALLET).map(t => t.Prezzo);

    let rem = pesoConScarto;
    let baseCost = 0;
    let bancali = 0;

    while (rem > 0) {
      bancali++;
      const palletWeight = Math.min(rem, MAX_PER_PALLET);

      let idx = bracketWeights.findIndex(w => palletWeight <= w);
      if (idx === -1) idx = bracketWeights.length - 1;

      baseCost += bracketPrices[idx];
      rem -= palletWeight;
    }

    // 8) Supplemento carburante + IVA
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotal = baseCost + fuel;
    const iva = subtotal * VAT_RATE;
    const totalPriceCents = Math.round((subtotal + iva) * 100);

    // 9) Prepara shipping rate
    const shippingRate = {
      service_name: "Spedizione Personalizzata",
      service_code: "CUSTOM",
      total_price: totalPriceCents.toString(),
      currency: "EUR",
      description: `Bancali: ${bancali}, fascia fino a ${bracketWeights[bracketWeights.length-1]}kg`
    };

    // 10) Risposta con debug se richiesto
    if (debug) {
      return NextResponse.json({
        rates: [shippingRate],
        debug: {
          rawProv, prov, pesoTotaleKg, pesoConScarto, bancali,
          bracketWeights, bracketPrices, baseCost, fuel, subtotal, iva, totalPriceCents
        }
      });
    }

    // 11) Risposta standard
    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    console.error("➤ carrier-service error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
