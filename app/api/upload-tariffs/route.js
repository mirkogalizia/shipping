import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Import xlsx come namespace (funziona su Next.js 14+)
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // Prendi il form data e il file
    const formData = await req.formData();
    const file = formData.get('file');

    // Debug: log del tipo file e oggetto file
    console.log("DEBUG file:", file);

    if (!file) {
      return NextResponse.json({ error: 'File mancante' }, { status: 400 });
    }

    // Controllo che sia un Blob (come in Next.js 14)
    if (typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Formato file non valido (no arrayBuffer)' }, { status: 400 });
    }

    // Converto in buffer Node.js
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Leggi Excel (debug anche di xlsx)
    console.log("DEBUG xlsx.read:", typeof xlsx.read);

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Debug output tariffe
    console.log("DEBUG dati tariffe estratti:", data);

    // Salva su tariffs.json
    await writeFile(join(process.cwd(), 'tariffs.json'), JSON.stringify(data, null, 2));

    // Risposta JSON
    return NextResponse.json({ ok: true, rows: data.length });
  } catch (error) {
    console.error("Errore upload-tariffs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
