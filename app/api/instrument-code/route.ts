import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("instrument_code")
      .select("*")
      .order("code_alat", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch instrument codes" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code_alat, name } = body;

    if (!code_alat) {
      return NextResponse.json(
        { error: "Kode alat is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("instrument_code")
      .insert({ code_alat, name })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create instrument code" },
      { status: 500 },
    );
  }
}
