import { NextResponse } from 'next/server';
import tariffs from '../../../tariffs.json';
interface TariffaObj { Provincia: string; Peso: number; Prezzo: number; }
export async function POST(req: Request) {
  const { rate } = await req.json();
  const province = rate.shipping_address.province as string;
  const items = rate.line_items as { grams: number; quantity: number }[];
  const totalKg = items.reduce((sum, li) => sum + li.grams * li.quantity, 0) / 1000;
  const list = (tariffs as TariffaObj[])
    .filter(t => t.Provincia.toLowerCase() === province.toLowerCase())
    .sort((a, b) => a.Peso - b.Peso);
  let rem = totalKg;
  let baseCost = 0;
  while (rem > 0) {
    const entry = list.find(d => d.Peso >= rem) || list[list.length - 1];
    baseCost += entry.Prezzo;
    rem -= entry.Peso;
  }
  const fuel = baseCost * 0.025;
  const subtotal = baseCost + fuel;
  const iva = subtotal * 0.22;
  const totalPriceCents = Math.round((subtotal + iva) * 100);
  const shippingRate = {
    service_name: 'Spedizione Personalizzata',
    service_code: 'CUSTOM',
    total_price: totalPriceCents.toString(),
    currency: 'EUR',
    description: 'Incluso carburante e IVA'
  };
  return NextResponse.json({ rates: [shippingRate] });
}
