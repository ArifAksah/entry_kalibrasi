import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../lib/supabase";
import { InstrumentNameInsert } from "../../../lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get("instrument_code_id");

    let query = supabase
      .from("instrument_names")
      .select("*")
      .order("name", { ascending: true });

    if (codeId) {
      query = query.eq("instrument_code_id", codeId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch instrument names" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code_alat, instrument_code_id } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const insertPayload: any = { name };
    if (code_alat !== undefined) insertPayload.code_alat = code_alat;
    if (instrument_code_id !== undefined)
      insertPayload.instrument_code_id = instrument_code_id;

    const { data, error } = await supabase
      .from("instrument_names")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create instrument name" },
      { status: 500 },
    );
  }
}
