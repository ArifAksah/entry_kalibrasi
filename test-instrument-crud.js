// Test Instrument CRUD API
// Jalankan dengan: node test-instrument-crud.js

const BASE_URL = 'http://localhost:3000/api/instruments';

// Helper function untuk fetch
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
  }
  
  return response.json();
}

// Data test
const testInstruments = [
  {
    // Single instrument tanpa sensor
    manufacturer: 'Vaisala',
    type: 'Barometer',
    serial_number: 'BP-2024-001',
    name_alias: 'Barometer Digital Vaisala',
    names: null, // FK ke instrument_names (null untuk test)
    station_id: 1, // Asumsi station dengan id 1 ada
    instrument_type_id: 1, // Digital
    memiliki_lebih_satu: false
  },
  {
    // Instrument standar (untuk sensor standar)
    manufacturer: 'Mettler Toledo',
    type: 'Timbangan Analitik',
    serial_number: 'MT-500-2024',
    name_alias: 'Timbangan Standar Kalibrasi',
    names: null,
    station_id: 1,
    instrument_type_id: 1,
    memiliki_lebih_satu: true, // Multi sensor
    others: 'Instrumen standar untuk kalibrasi massa'
  },
  {
    // Instrument dengan multi sensor (simulasi)
    manufacturer: 'Testo',
    type: 'Termohigrometer',
    serial_number: 'TH-835-001',
    name_alias: 'Termohigrometer Multi Sensor',
    names: null,
    station_id: 1,
    instrument_type_id: 2, // Analog
    memiliki_lebih_satu: true,
    instrument_code_id: null // Kode alat (opsional)
  }
];

// Test functions
async function testCreateInstruments() {
  console.log('=== TEST CREATE INSTRUMENTS ===');
  const createdIds = [];
  
  for (const [index, instrument] of testInstruments.entries()) {
    try {
      console.log(`\n[CREATE ${index + 1}] Membuat instrument: ${instrument.name_alias}`);
      const created = await apiRequest('', {
        method: 'POST',
        body: JSON.stringify(instrument)
      });
      console.log(`✓ Berhasil membuat instrument dengan ID: ${created.id}`);
      createdIds.push(created.id);
    } catch (error) {
      console.error(`✗ Gagal membuat instrument: ${error.message}`);
      // Coba dengan data yang lebih sederhana jika gagal
      try {
        console.log(`  Mencoba dengan data minimal...`);
        const minimal = {
          manufacturer: instrument.manufacturer,
          type: instrument.type,
          serial_number: instrument.serial_number,
          station_id: instrument.station_id
        };
        const created = await apiRequest('', {
          method: 'POST',
          body: JSON.stringify(minimal)
        });
        console.log(`✓ Berhasil dengan ID: ${created.id}`);
        createdIds.push(created.id);
      } catch (e2) {
        console.error(`  ✗ Tetap gagal: ${e2.message}`);
      }
    }
  }
  
  return createdIds;
}

async function testReadInstruments(instrumentIds = []) {
  console.log('\n=== TEST READ INSTRUMENTS ===');
  
  // 1. Get all instruments
  try {
    console.log('\n[READ ALL] Mengambil semua instrument...');
    const all = await apiRequest('?page=1&pageSize=5');
    console.log(`✓ Total instrument: ${all.total}`);
    console.log(`  Data ditemukan: ${all.data.length} instrument`);
  } catch (error) {
    console.error(`✗ Gagal mengambil semua instrument: ${error.message}`);
  }
  
  // 2. Filter by type 'standard' (memerlukan sensor is_standard=true)
  try {
    console.log('\n[READ STANDARD] Filter instrument standar...');
    const standard = await apiRequest('?type=standard&page=1&pageSize=5');
    console.log(`✓ Instrument standar ditemukan: ${standard.data.length}`);
  } catch (error) {
    console.error(`✗ Gagal filter standar: ${error.message}`);
  }
  
  // 3. Filter by type 'uut' (unit under test)
  try {
    console.log('\n[READ UUT] Filter instrument UUT...');
    const uut = await apiRequest('?type=uut&page=1&pageSize=5');
    console.log(`✓ Instrument UUT ditemukan: ${uut.data.length}`);
  } catch (error) {
    console.error(`✗ Gagal filter UUT: ${error.message}`);
  }
  
  // 4. Search by query
  try {
    console.log('\n[SEARCH] Mencari instrument dengan keyword "Vaisala"...');
    const search = await apiRequest('?q=Vaisala&page=1&pageSize=5');
    console.log(`✓ Hasil pencarian ditemukan: ${search.data.length} instrument`);
  } catch (error) {
    console.error(`✗ Gagal mencari instrument: ${error.message}`);
  }
  
  // 5. Get by ID (jika ada ID yang berhasil dibuat)
  if (instrumentIds.length > 0) {
    try {
      console.log(`\n[GET BY ID] Mengambil instrument dengan ID: ${instrumentIds[0]}`);
      const byId = await apiRequest(`/${instrumentIds[0]}`);
      console.log(`✓ Data instrument ditemukan: ${byId.name_alias || byId.type || 'No name'}`);
    } catch (error) {
      console.error(`✗ Gagal mengambil instrument by ID: ${error.message}`);
    }
  }
}

async function testUpdateInstruments(instrumentIds = []) {
  console.log('\n=== TEST UPDATE INSTRUMENTS ===');
  
  if (instrumentIds.length === 0) {
    console.log('Tidak ada instrument untuk diupdate');
    return;
  }
  
  const updateData = {
    manufacturer: 'Updated Manufacturer',
    type: 'Updated Type',
    serial_number: `UPDATED-${Date.now()}`,
    name_alias: 'Instrument Updated',
    others: 'Data lain yang diupdate'
  };
  
  try {
    console.log(`\n[UPDATE] Mengupdate instrument dengan ID: ${instrumentIds[0]}`);
    const updated = await apiRequest(`/${instrumentIds[0]}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    console.log(`✓ Berhasil mengupdate instrument`);
    console.log(`  Manufacturer: ${updated.manufacturer}`);
    console.log(`  Type: ${updated.type}`);
    console.log(`  Serial: ${updated.serial_number}`);
  } catch (error) {
    console.error(`✗ Gagal mengupdate instrument: ${error.message}`);
  }
}

async function testDeleteInstruments(instrumentIds = []) {
  console.log('\n=== TEST DELETE INSTRUMENTS ===');
  
  if (instrumentIds.length === 0) {
    console.log('Tidak ada instrument untuk dihapus');
    return;
  }
  
  // Hapus dari ID terakhir untuk menghindari masalah foreign key
  for (let i = instrumentIds.length - 1; i >= 0; i--) {
    const id = instrumentIds[i];
    try {
      console.log(`\n[DELETE] Menghapus instrument dengan ID: ${id}`);
      await apiRequest(`/${id}`, { method: 'DELETE' });
      console.log(`✓ Berhasil menghapus instrument dengan ID: ${id}`);
    } catch (error) {
      console.error(`✗ Gagal menghapus instrument dengan ID ${id}: ${error.message}`);
      console.log(`  Kemungkinan masih memiliki sensor terkait atau digunakan di sertifikat`);
    }
  }
}

async function runTests() {
  console.log('🚀 MEMULAI PENGUJIAN CRUD INSTRUMENT\n');
  console.log('Pastikan server Next.js berjalan di http://localhost:3000\n');
  
  try {
    // Test koneksi ke server
    console.log('🔍 Menguji koneksi ke server...');
    await apiRequest('');
    console.log('✓ Server dapat diakses\n');
    
    // Jalankan test
    const createdIds = await testCreateInstruments();
    await testReadInstruments(createdIds);
    await testUpdateInstruments(createdIds);
    await testDeleteInstruments(createdIds);
    
    console.log('\n✅ PENGUJIAN SELESAI');
    
  } catch (error) {
    console.error('\n❌ PENGUJIAN GAGAL:', error.message);
    console.log('\nPastikan:');
    console.log('1. Server Next.js berjalan (npm run dev)');
    console.log('2. Database Supabase terhubung');
    console.log('3. Tabel instrument, station, dan instrument_names sudah dibuat');
  }
}

// Jalankan test
runTests();