import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "../../../../lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("instrument_code")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch instrument code" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
      .update({ code_alat, name })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update instrument code" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from("instrument_code")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Instrument code deleted successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete instrument code" },
      { status: 500 },
    );
  }
}
