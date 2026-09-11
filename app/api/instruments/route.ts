import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { clientSafeMessage } from "../../../lib/api-error";

// Menggunakan shared supabaseAdmin dari lib/supabase agar memiliki fallback env dan konfigurasi konsisten

function getInstrumentErrorMessage(error: any) {
  if (error?.code === "23502" && error?.message?.includes('column "id"')) {
    return "ID instrumen belum memiliki auto-increment. Jalankan script database/fix_instrument_id_sequence.sql di Supabase SQL Editor.";
  }

  if (error?.code === "23505" && error?.message?.includes("instrument_pkey")) {
    return "ID instrumen bentrok. Sequence auto-increment instrumen perlu disinkronkan.";
  }

  return error?.message || "Gagal menyimpan instrumen";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1,
    );
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10) || 10),
    );
    const q = (searchParams.get("q") || "").trim();
    const type = searchParams.get("type"); // 'standard' or 'uut'

    const userId = searchParams.get("user_id");

    // 1. Determine Station Join Logic
    // If strict user filtering, use !inner join on station -> user_stations
    let stationSelect = "station(id, name)";
    if (userId) {
      stationSelect = "station!inner(id, name, user_stations!inner(user_id))";
    }

    // 2. Tentukan Sensor Join Logic + komposisi query
    // NOTE: kolom resolution/graduating/range_capacity harus ikut diselect agar
    // U95 ketidakpastian (yang memakai resolusi UUT/STD) terbaca saat hitung di
    // QCDataModal. Kalau tidak, resolusi jatuh ke 0 dan uncertainty salah kecil.
    // Bila kolom-kolom itu belum ada di DB (migrasi belum dijalankan / schema
    // cache belum refresh), query retry memakai daftar kolom lama agar list
    // instrumen tidak 500 dan halaman print/edit tetap berfungsi.
    const sensorFields =
      "id, name, type, serial_number, is_standard, sensor_name_id, " +
      "resolution, graduating, graduating_unit, range_capacity, range_capacity_unit";
    const sensorFieldsLegacy =
      "id, name, type, serial_number, is_standard, sensor_name_id";

    // Untuk filter 'uut': sembunyikan instrumen yang memiliki sensor standar
    // (mis. alat standar), sehingga daftar hanya menampilkan UUT murni.
    // Relasi utama: kolom `sensor.instrument_id` (FK pada tabel sensor menunjuk ke instrument),
    // serta tabel junction `instrument_sensors` untuk konfigurasi multi-sensor lama.
    const uutExcluded = new Set<number>();
    if (type === "uut") {
      try {
        // 1) Instrumen dengan sensor langsung (sensor.instrument_id) berstatus standar
        const { data: directStandardSensors } = await supabaseAdmin
          .from("sensor")
          .select("id, instrument_id")
          .eq("is_standard", true);

        (directStandardSensors || []).forEach((row: any) => {
          const instrumentId = Number(row.instrument_id);
          if (Number.isFinite(instrumentId)) uutExcluded.add(instrumentId);
        });

        // 2) Instrumen multi-sensor via tabel junction `instrument_sensors`
        const standardSensorIds = (directStandardSensors || [])
          .map((row: any) => Number(row.id))
          .filter((value) => Number.isFinite(value));

        if (standardSensorIds.length > 0) {
          const { data: linkedInstruments, error: junctionError } =
            await supabaseAdmin
              .from("instrument_sensors")
              .select("instrument_id")
              .in("sensor_id", standardSensorIds);

          if (!junctionError) {
            (linkedInstruments || []).forEach((row: any) => {
              const instrumentId = Number(row.instrument_id);
              if (Number.isFinite(instrumentId)) uutExcluded.add(instrumentId);
            });
          }
        }
      } catch (filterError) {
        console.warn(
          "[instruments] Failed to apply UUT exclusion filter, falling back to unfiltered list:",
          filterError,
        );
      }
    }

    const buildInstrumentsQuery = (sensorFieldList: string) => {
      // Filter untuk standard gunakan !inner agar hanya instrumen bersensor standar
      const sensorSelect =
        type === "standard"
          ? `sensor!inner(${sensorFieldList})`
          : `sensor!left(${sensorFieldList})`;

      let queryBuilder = supabaseAdmin
        .from("instrument")
        .select(
          `
        id,
        manufacturer,
        type,
        serial_number,
        name_alias,
        others,
        names,
        instrument_code_id,
        instrument_type_id,
        instrument_id,
        memiliki_lebih_satu,
        station_id,
        created_at,
        ${stationSelect},
        ${sensorSelect}
      `,
          { count: "exact" },
        );

      if (type === "standard") {
        queryBuilder = queryBuilder.eq("sensor.is_standard", true);
      }

      if (type === "uut" && uutExcluded.size > 0) {
        queryBuilder = queryBuilder.not(
          "id",
          "in",
          `(${Array.from(uutExcluded).join(",")})`,
        );
      }

      // Tambahkan filter pencarian jika ada query 'q'
      if (q) {
        queryBuilder = queryBuilder.or(
          `manufacturer.ilike.%${q}%,type.ilike.%${q}%,serial_number.ilike.%${q}%,name_alias.ilike.%${q}%,others.ilike.%${q}%`,
        );
      }

      if (userId) {
        queryBuilder = queryBuilder.eq("station.user_stations.user_id", userId);
      }

      // Terapkan paginasi dan pengurutan
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      return queryBuilder.order("created_at", { ascending: false }).range(start, end);
    };

    // Eksekusi query — dengan fallback kolom sensor lama bila perlu
    let { data, error, count } = await buildInstrumentsQuery(sensorFields);

    const isMissingSensorColumn =
      !!error &&
      /could not find .*(resolution|graduating|range_capacity)/i.test(
        String(error.message || ""),
      );

    if (isMissingSensorColumn) {
      console.warn(
        "[instruments] Kolom sensor baru belum ada di DB, retry dengan daftar kolom lama:",
        error?.message,
      );
      const retryRes = await buildInstrumentsQuery(sensorFieldsLegacy);
      data = retryRes.data;
      error = retryRes.error;
      count = retryRes.count;
    }

    // Error handling yang lebih baik
    if (error) {
      console.error("Supabase query error in GET /api/instruments:", error); // Log error spesifik
      // Cek error terkait relasi (meskipun seharusnya tidak terjadi dengan kode yang disederhanakan)
      if (
        error.code === "42P01" ||
        error.message.includes('relation "station" does not exist')
      ) {
        return NextResponse.json(
          {
            error: "Data instrumen tidak dapat dimuat.",
          },
          { status: 500 },
        );
      }
      // Jika konektivitas ke Supabase gagal, kembalikan list kosong agar UI tetap jalan
      if (error.message?.toLowerCase?.().includes("fetch failed")) {
        console.warn(
          "[instruments] Supabase unreachable, returning empty list fallback.",
        );
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        });
      }
      // Handle error RLS atau lainnya
      return NextResponse.json(
        { error: clientSafeMessage(error, "Failed to fetch instruments") },
        { status: 500 },
      );
    }

    // Map data to ensure instrument_names_id is available for frontend
    const mappedData = (data || []).map((item: any) => ({
      ...item,
      instrument_names_id: item.names ?? item.instrument_names_id ?? null,
    }));

    console.log('[API instruments] Sample mapped data (first 2):', mappedData.slice(0, 2).map((i: any) => ({
      id: i.id,
      name_alias: i.name_alias,
      names: i.names,
      instrument_names_id: i.instrument_names_id,
      instrument_code_id: i.instrument_code_id
    })));

    // Kirim response sukses
    const total = count || 0;
    return NextResponse.json({
      data: mappedData,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e: any) {
    console.error("Catch block error in GET /api/instruments:", e); // Log exception lain
    // Fallback ketika undici fetch gagal (misconfig URL/keys atau Supabase down)
    if (
      typeof e?.message === "string" &&
      e.message.toLowerCase().includes("fetch failed")
    ) {
      console.warn(
        "[instruments] Supabase unreachable in catch, returning empty list fallback.",
      );
      return NextResponse.json({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to fetch instruments due to an unexpected server error.",
      },
      { status: 500 },
    );
  }
}

// Handler POST, PUT, DELETE (tetap sama seperti yang Anda unggah)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      manufacturer,
      type,
      serial_number,
      others,
      name,
      name_alias,
      names,
      instrument_names_id,
      instrument_code_id,
      station_id,
      memiliki_lebih_satu,
      instrument_type_id,
      instrument_id,
    } = body;

    // For single instrument: require manufacturer, type, serial_number
    // For multi-sensor instrument: these fields are at sensor level, not required here
    if (!memiliki_lebih_satu) {
      if (!manufacturer || !type || !serial_number) {
        return NextResponse.json(
          {
            error: "Manufacturer, type, and serial number are required for single instrument",
          },
          { status: 400 },
        );
      }
    }

    if (station_id) {
      const { data: stationData, error: stationError } = await supabaseAdmin
        .from("station")
        .select("id")
        .eq("id", station_id)
        .single();

      if (stationError || !stationData) {
        return NextResponse.json(
          {
            error: "Station ID tidak valid.",
          },
          { status: 400 },
        );
      }
    }

    // kolom aktual di DB: "names" (FK ke instrument_names), "name_alias" (alias teks bebas)
    const namesId = names ?? instrument_names_id;
    const aliasValue = name_alias || name || null;

    const { data, error } = await supabaseAdmin
      .from("instrument")
            .insert({
        manufacturer,
        type,
        serial_number,
        others: others || null,
        name_alias: aliasValue,
        names: namesId ? parseInt(namesId as any) : null,
        instrument_code_id: instrument_code_id
          ? parseInt(instrument_code_id as any)
          : null,
        instrument_type_id: instrument_type_id
          ? parseInt(instrument_type_id as any)
          : null,
        station_id: station_id ? parseInt(station_id as any) : null,
        memiliki_lebih_satu: memiliki_lebih_satu || false,
        instrument_id: instrument_id || null,
      })
      .select("*, station(id, name)") // Ambil data station setelah insert
      .single();

    if (error) {
      console.error("POST Instrument Error:", error);
      return NextResponse.json(
        { error: getInstrumentErrorMessage(error) },
        { status: 400 },
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("POST Instrument Exception:", e);
    return NextResponse.json(
      { error: "Failed to create instrument" },
      { status: 500 },
    );
  }
}
