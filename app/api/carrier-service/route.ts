import { NextResponse } from 'next/server';
import tariffs from '../../../tariffs.json';
export async function POST(req: Request) {
  const { rate } = await req.json();
  const province = rate.shipping_address.province;
  const items = rate.line_items;
  const totalKg = items.reduce((sum:any,li:any)=>sum+li.grams*li.quantity,0)/1000;
  const list = tariffs.filter((t:any)=>t.Provincia.toLowerCase()===province.toLowerCase()).sort((a:any,b:any)=>a.Peso-b.Peso);
  let rem=totalKg, baseCost=0;
  while(rem>0){const e=list.find((d:any)=>d.Peso>=rem)||list[list.length-1];baseCost+=e.Prezzo;rem-=e.Peso;}
  const fuel=baseCost*0.025, subtotal=baseCost+fuel, iva=subtotal*0.22;
  const totalPriceCents=Math.round((subtotal+iva)*100);
  const shippingRate={service_name:'Spedizione Personalizzata',service_code:'CUSTOM',total_price:totalPriceCents.toString(),currency:'EUR',description:'Carburante+IVA'};
  return NextResponse.json({ rates:[shippingRate] });
}
