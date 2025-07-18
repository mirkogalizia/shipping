// File: app/api/carrier-service/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Mappa sigla→nome esteso di tutte le province
type Tariff = { Provincia: string; Peso: number; Prezzo: number };
const provinceMap: Record<string, string> = {
  AG: "AGRIGENTO", AL: "ALESSANDRIA", AN: "ANCONA", AO: "AOSTA", AR: "AREZZO",
  AT: "ASTI", AV: "AVELLINO", BA: "BARI", BG: "BERGAMO", BI: "BIELLA",
  BL: "BELLUNO", BN: "BENEVENTO", BO: "BOLOGNA", BR: "BRINDISI", BS: "BRESCIA",
  BT: "BARLETTA-ANDRIA-TRANI", BZ: "BOLZANO", CA: "CAGLIARI", CB: "CAMPOBASSO",
  CE: "CASERTA", CH: "CHIETI", CN: "CUNEO", CO: "COMO", CR: "CREMONA",
  CS: "COSENZA", CT: "CATANIA", CZ: "CATANZARO", EN: "ENNA", FC: "FORLÌ-CESENA",
  FE: "FERRARA", FG: "FOGGIA", FI: "FIRENZE", FR: "FROSINONE", GE: "GENOVA",
  GO: "GORIZIA", GR: "GROSSETO", IM: "IMPERIA", IS: "ISERNIA", KR: "CROTONE",
  LC: "LECCO", LE: "LECCE", LI: "LIVORNO", LO: "LODI", LT: "LATINA",
  LU: "LUCCA", MB: "MONZA BRIANZA", MC: "MACERATA", ME: "MESSINA", MI: "MILANO",
  MN: "MANTOVA", MO: "MODENA", MS: "MASSA CARRARA", MT: "MATERA", NA: "NAPOLI",
  NO: "NOVARA", NU: "NUORO", OR: "ORISTANO", PA: "PALERMO", PC: "PIACENZA",
  PD: "PADOVA", PE: "PESCARA", PG: "PERUGIA", PI: "PISA", PN: "PORDENONE",
  PR: "PARMA", PT: "PISTOIA", PU: "PESARO URBINO", PV: "PAVIA", PZ: "POTENZA",
  RA: "RAVENNA", RC: "REGGIO CALABRIA", RE: "REGGIO EMILIA", RG: "RAGUSA",
  RI: "RIETI", RM: "ROMA", RN: "RIMINI", RO: "ROVIGO", SA: "SALERNO",
  SI: "SIENA", SO: "SONDRIO", SP: "LA SPEZIA", SR: "SIRACUSA", SS: "SASSARI",
  SV: "VERCELLI", TA: "TARANTO", TE: "TERAMO", TN: "TRENTO", TO: "TORINO",
  TP: "TRAPANI", TR: "TERNI", TS: "TRIESTE", TV: "TREVISO", UD: "UDINE",
  VA: "VARESE", VB: "VERBANIA", VC: "VERCELLI", VE: "VENEZIA", VI: "VICENZA",
  VR: "VERONA", VT: "VITERBO"
};

const VAT_RATE = 0.22;
const FUEL_SURCHARGE_RATE = 0.025;
const PICKUP_FEE = 3;
const DEFAULT_GRAMS = 1000;
const MAX_PER_PALLET = 1200;

export async function POST(req: NextRequest) {
  try {
    // Carica tariffe
    const jsonPath = path.join(process.cwd(), "public", "tariffs.json");
    const file = await fs.readFile(jsonPath, "utf8");
    const tariffs = JSON.parse(file) as Tariff[];

    // Debug?
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // Parse payload
    const { rate } = await req.json();
    console.log("➤ carrier-service payload:", JSON.stringify(rate));

    // Determina provincia
    const rawProv = (rate.destination?.province || "").toString().trim();
    if (!rawProv) return NextResponse.json({ error: "Provincia non valida" }, { status: 400 });
    const key = rawProv.toUpperCase();
    const prov = provinceMap[key] || rawProv.toUpperCase();

    // Calcola peso totale in kg
    const items = (rate.line_items || rate.items || []) as any[];
    const pesoTotaleKg =
      items
        .map(li => ({ ...li, grams: li.grams && li.grams > 0 ? li.grams : DEFAULT_GRAMS }))
        .reduce((sum, i) => sum + Number(i.grams) * (i.quantity || 1), 0) / 1000;
    if (pesoTotaleKg <= 0) return NextResponse.json({ error: "Peso non valido" }, { status: 400 });

    // Filtra tariffe per provincia
    const list = tariffs.filter(t => t.Provincia.toUpperCase() === prov).sort((a, b) => a.Peso - b.Peso);
    if (!list.length) {
      return NextResponse.json({ error: `Provincia "${rawProv}" (${prov}) non trovata.` }, { status: 400 });
    }

    // Suddivide in bancali
    const bracketWeights = list.map(t => t.Peso).filter(w => w <= MAX_PER_PALLET);
    const bracketPrices = list.filter(t => t.Peso <= MAX_PER_PALLET).map(t => t.Prezzo);

    let rem = pesoTotaleKg;
    let bancali = 0;
    let baseCost = 0;
    const breakdownWeights: number[] = [];

    while (rem > 0) {
      bancali++;
      const palletWeight = Math.min(rem, MAX_PER_PALLET);
      let idx = bracketWeights.findIndex(w => palletWeight <= w);
      if (idx === -1) idx = bracketWeights.length - 1;
      breakdownWeights.push(bracketWeights[idx]);
      baseCost += bracketPrices[idx];
      rem -= palletWeight;
    }

    // Calcola supplementi e IVA
    const fuel = baseCost * FUEL_SURCHARGE_RATE;
    const subtotalExclVat = baseCost + fuel + PICKUP_FEE;
    const iva = subtotalExclVat * VAT_RATE;
    const totalPriceCents = Math.round((subtotalExclVat + iva) * 100);

    // Description: mostra solo fasce peso
    const details = breakdownWeights
      .map((w, i) => `Bancale ${i+1}: fino a ${w}kg`)
      .join(", ");

    const shippingRate = {
      service_name: "Corriere One Express",
      service_code: "CUSTOM",
      total_price: totalPriceCents.toString(),
      currency: "EUR",
      description: details
    };

    if (debug) {
      return NextResponse.json({ rates: [shippingRate], debug: { prov, pesoTotaleKg, bancali, breakdownWeights, baseCost, fuel, pickup: PICKUP_FEE, iva, totalPriceCents } });
    }

    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    console.error("➤ carrier-service error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

