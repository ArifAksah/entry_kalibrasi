-- ============================================================================
-- Backfill uut_correction untuk raw_data lama (unit-aware)
-- ============================================================================
--
-- Masalah:
--   Trigger `trg_calculate_calibration` versi baru sudah unit-aware, tetapi
--   DDL CREATE OR REPLACE hanya mengganti fungsi. Baris LAMA tidak dihitung
--   ulang, sehingga `uut_correction` masih memakai rumus mixed-unit (tanpa
--   konversi) untuk pasangan unit berbeda seperti hPa -> inHg dan m/s -> knot.
--
-- Solusi:
--   Sentuh ulang kolom `unit_uut` dengan nilainya sendiri. Kolom itu termasuk
--   daftar `UPDATE OF` pada trigger, sehingga trigger terpicu dan menghitung
--   ulang `std_correction`, `std_corrected`, dan `uut_correction` tanpa
--   mengubah nilai data.
--
-- Catatan:
--   - Dijalankan per rentang id (batching) agar tidak mengunci tabel terlalu
--     lama pada tabel besar (~400k baris).
--   - Idempotent: aman dijalankan berulang; baris yang sudah benar tetap
--     menghasilkan nilai yang sama.
--   - Disarankan menjalankan di luar jam sibuk.
--
-- Pemakaian: jalankan seluruh file ini di Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
    max_id    bigint;
    cur       bigint := 0;
    step      int    := 20000;
    affected  int;
    total     bigint := 0;
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM public.raw_data;
    RAISE NOTICE 'Mulai backfill raw_data sampai id=%', max_id;

    WHILE cur <= max_id LOOP
        UPDATE public.raw_data
        SET unit_uut = unit_uut
        WHERE id > cur
          AND id <= cur + step
          AND unit_std IS NOT NULL
          AND unit_uut IS NOT NULL
          AND btrim(unit_std) <> btrim(unit_uut)
          AND std_corrected IS NOT NULL
          AND uut_data IS NOT NULL;

        GET DIAGNOSTICS affected = ROW_COUNT;
        total := total + affected;
        RAISE NOTICE 'rentang %-%: % baris diproses', cur + 1, cur + step, affected;

        cur := cur + step;
    END LOOP;

    RAISE NOTICE 'Selesai. Total baris diproses: %', total;
END $$;

-- ─── Verifikasi setelah backfill ─────────────────────────────────────────────
-- Semua baris hPa->inHg yang masih memakai rumus mixed-unit punya nilai besar
-- (~1000). Setelah backfill, nilai seharusnya kecil (~0.00x).
--
-- SELECT count(*) AS masih_besar
-- FROM public.raw_data
-- WHERE unit_std = 'hPa' AND unit_uut = 'inHg'
--   AND abs(uut_correction) > 100;
--
-- SELECT count(*) AS masih_besar
-- FROM public.raw_data
-- WHERE unit_std = 'inHg' AND unit_uut = 'hPa'
--   AND abs(uut_correction) > 100;
