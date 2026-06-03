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
      .order("names", { ascending: true });

    if (codeId) {
      query = query.eq("instrument_code_id", codeId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch instrument_code data separately to avoid JOIN issues
    const codeIds = Array.from(new Set((data || []).map((item: any) => item.instrument_code_id).filter(Boolean)));
    let codesMap: Record<number, any> = {};
    
    console.log('[API instrument-names] Fetched instrument_names:', data?.length || 0);
    console.log('[API instrument-names] Unique code_ids to fetch:', codeIds);
    
    if (codeIds.length > 0) {
      const { data: codesData, error: codesError } = await supabase
        .from("instrument_code")
        .select("id, code_alat, name")
        .in("id", codeIds);
      
      console.log('[API instrument-names] Fetched instrument_codes:', codesData?.length || 0, 'error:', codesError);
      
      if (codesData) {
        codesMap = Object.fromEntries(codesData.map((c: any) => [c.id, c]));
        console.log('[API instrument-names] Codes map:', codesMap);
      }
    }

    // Map 'names' column to 'name' for frontend compatibility
    // Also add instrument_code data
    const mapped = (data || []).map((item: any) => {
      const code = item.instrument_code_id ? codesMap[item.instrument_code_id] : null;
      return {
        ...item,
        name: item.names ?? item.name,
        code_alat: code?.code_alat ?? null,
        instrument_code_name: code?.name ?? null,
      };
    });

    console.log('[API instrument-names] Sample mapped data (first 3):', mapped.slice(0, 3));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Error in GET /api/instrument-names:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch instrument names" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, names, code_alat, instrument_code_id } = body;

    const nameValue = names || name;
    if (!nameValue) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const insertPayload: any = { names: nameValue };
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

    // Map 'names' to 'name' for frontend compatibility
    const mapped = { ...data, name: data.names ?? data.name };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create instrument name" },
      { status: 500 },
    );
  }
}
