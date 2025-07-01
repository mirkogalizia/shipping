import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export async function POST(req) {
  try {
    const jsonData = await req.json();

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(
        "tariffs.json",
        new TextEncoder().encode(JSON.stringify(jsonData)),
        {
          upsert: true,
          contentType: "application/json"
        }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rows: jsonData.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


