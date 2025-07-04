import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Mappa sigla → nome esteso di tutte le province
const provinceMap: Record<string, string> = {
  "AG":"AGRIGENTO","AL":"ALESSANDRIA","AN":"ANCONA","AO":"AOSTA","AR":"AREZZO",
  "AP":"ASCOLI PICENO","AT":"ASTI","AV":"AVELLINO","BA":"BARI","BT":"BARLETTA-ANDRIA-TRANI",
  "BL":"BELLUNO","BN":"BENEVENTO","BG":"BERGAMO","BI":"BIELLA","BO":"BOLOGNA",
  "BZ":"BOLZANO","BS":"BRESCIA","BR":"BRINDISI","CA":"CAGLIARI","CL":"CALTANISSETTA",
  "CB":"CAMPOBASSO","CI":"CARBONIA-IGLESIAS","CE":"CASERTA","CT":"CATANIA","CZ":"CATANZARO",
  "CH":"CHIETI","CO":"COMO","CS":"COSENZA","CR":"CREMONA","KR":"CROTONE","CN":"CUNEO",
  "EN":"ENNA","FM":"FERMO","FE":"FERRARA","FI":"FIRENZE","FG":"FOGGIA","FC":"FORLÌ-CESENA",
  "FR":"FROSINONE","GE":"GENOVA","GO":"GORIZIA","GR":"GROSSETO","IM":"IMPERIA","IS":"ISERNIA",
  "SP":"LA SPEZIA","AQ":"L'AQUILA","LT":"LATINA","LE":"LECCE","LC":"LECCO","LI":"LIVORNO",
  "LO":"LODI","LU":"LUCCA","MC":"MACERATA","MN":"MANTOVA","MS":"MASSA-CARRARA","MT":"MATERA",
  "VS":"MEDIO CAMPIDANO","ME":"MESSINA","MI":"MILANO","MO":"MODENA","MB":"MONZA E DELLA BRIANZA",
  "NA":"NAPOLI","NO":"NOVARA","NU":"NUORO","OG":"OGLIASTRA","OT":"OLBIA-TEMPIO","OR":"ORISTANO",
  "PD":"PADOVA","PA":"PALERMO","PR":"PARMA","PV":"PAVIA","PG":"PERUGIA","PU":"PESARO E URBINO",
  "PE":"PESCARA","PC":"PIACENZA","PI":"PISA","PT":"PISTOIA","PN":"PORDENONE","PZ":"POTENZA",
  "PO":"PRATO","RG":"RAGUSA","RA":"RAVENNA","RC":"REGGIO CALABRIA","RE":"REGGIO EMILIA",
  "RI":"RIETI","RN":"RIMINI","RM":"ROMA","RO":"ROVIGO","SA":"SALERNO","SS":"SASSARI",
  "SV":"SAVONA","SI":"SIENA","SR":"SIRACUSA","SO":"SONDRIO","TA":"TARANTO","TE":"TERAMO",
  "TR":"TERNI","TO":"TORINO","TP":"TRAPANI","TN":"TRENTO","TV":"TREVISO","TS":"TRIESTE",
  "UD":"UDINE","VA":"VARESE","VE":"VENEZIA","VB":"VERBANO-CUSIO-OSSOLA","VC":"VERCELLI",
  "VR":"VERONA","VV":"VIBO VALENTIA","VI":"VICENZA","VT":"VITERBO"
};

const VAT_RATE = 0.22;
const FUEL_SURCHARGE_RATE = 0.025;

export async function POST(req: NextRequest) {
  try {
    // 1) Carica le tariffe
    const jsonPath = path.join(process.cwd(), "public", "tariffs.json");
    const file = await fs.readFile(jsonPath, "utf8");
    const tariffs = JSON.parse(file) as { Provincia: string; Peso: number; Prezzo: number; }[];

    // 2) Debug flag
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // 3) Estrai il wrapper rate
    const { rate } = await req.json();
    console.log("➤ carrier-service payload:", JSON.stringify(rate));

    // 4) Estrai provincia da destination
    const rawProv = (rate.destination?.province || "").toString().trim();
    if (!rawProv) {
      return NextResponse.json({ error: "Provincia non valida" }, { status: 400 });
    }
    const key = rawProv.toUpperCase();
    const prov = provinceMap[key] || rawProv.toUpperCase();

    // 5) Calcola peso totale in kg
    const items = rate.line_items || rate.items || [];
    const pesoTotaleKg =
      items.reduce((sum: number, i: any) => sum + (Number(i.grams) || 0) * (i.quantity || 1), 0) / 1000;
    if (pesoTotaleKg <= 0) {
      return NextResponse.json({ error: "Peso non valido" }, { status: 400 });
    }

    // 6) Filtra tariffe per provincia
    const list = tariffs
      .filter(t => t.Provincia.toUpperCase() === prov)
      .sort((a, b) => a.Peso - b.Peso);
    if (list.length === 0) {
      return NextResponse.json({ error: `Provincia "${rawProv}" (${prov}) non trovata.` }, { status: 400 });
    }

    // 7) Calcolo bancali (soglia 1000kg)
    const MAX_PER_PALLET = 1000;
    const bracketWeights = list.map(t => t.Peso).filter(w => w <= MAX_PER_PALLET);
    const bracketPrices = list.filter(t => t.Peso <= MAX_PER_PALLET).map(t => t.Prezzo);

    const bancali = Math.ceil(pesoTotaleKg / MAX_PER_PALLET);
    const firstWeight = Math.min(pesoTotaleKg, MAX_PER_PALLET);

    let idx = bracketWeights.findIndex(w => firstWeight <= w);
    if (idx === -1) idx = bracketWeights.length - 1;

    const pricePerPallet = bracketPrices[idx];
    const baseCost = bancali * pricePerPallet;

    // 8) Carburante + IVA
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
      description: `Bancali: ${bancali}, fascia fino a ${bracketWeights[idx]}kg`
    };

    // 10) Risposta con debug opzionale
    if (debug) {
      return NextResponse.json({
        rates: [shippingRate],
        debug: { rawProv, prov, pesoTotaleKg, bancali, firstWeight, bracketWeights, bracketPrices, idx, pricePerPallet, baseCost, fuel, subtotal, iva, totalPriceCents }
      });
    }

    // 11) Risposta standard
    return NextResponse.json({ rates: [shippingRate] });
  } catch (e: any) {
    console.error("➤ carrier-service error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
