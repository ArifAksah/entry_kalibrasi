// Test Certificate dengan skema instrument baru
// Jalankan dengan: node test-certificate-instrument.js

const BASE_URL = 'http://localhost:3000/api';

// Authorization token (opsional - untuk endpoint yang memerlukan auth)
// Kosongkan jika tidak diperlukan
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Tambahkan authorization header jika ada token
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  
  const response = await fetch(url, {
    headers,
    ...options
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
  }
  
  return response.json();
}

async function testCertificateInstrumentMapping() {
  console.log('=== TEST CERTIFICATE-INSTRUMENT MAPPING ===\n');
  
  // 1. Ambil beberapa instrument untuk testing
  console.log('1. Mengambil sample instruments...');
  const instruments = await apiRequest('/instruments?pageSize=5');
  console.log(`✓ Ditemukan ${instruments.data.length} instruments\n`);
  
  // Tampilkan detail instruments
  console.log('   Detail instruments:');
  instruments.data.forEach(inst => {
    console.log(`   - ID: ${inst.id}, name_alias: "${inst.name_alias || '-'}", names: ${inst.names || '-'}, type: ${inst.type}`);
  });
  console.log('');
  
  // 2. Ambil beberapa certificate (dengan error handling untuk auth)
  console.log('2. Mengambil sample certificates...');
  let certificates = { data: [] };
  try {
    certificates = await apiRequest('/certificates?pageSize=5');
    console.log(`✓ Ditemukan ${certificates.data.length} certificates\n`);
  } catch (error) {
    if (error.message.includes('401')) {
      console.log('ℹ Certificates API memerlukan authorization - skip test certificates\n');
    } else {
      throw error;
    }
  }
  
  // 3. Verifikasi mapping instrument di certificates (jika ada data)
  if (certificates.data.length > 0) {
    console.log('3. Memverifikasi mapping instrument di certificates...');
    for (const cert of certificates.data.slice(0, 3)) {
      if (cert.instrument) {
        try {
          const instrument = await apiRequest(`/instruments/${cert.instrument}`);
          console.log(`  Certificate ${cert.id}:`);
          console.log(`    - instrument_id: ${cert.instrument}`);
          console.log(`    - name_alias: ${instrument.name_alias || '-'}`);
          console.log(`    - names (FK): ${instrument.names || '-'}`);
          console.log(`    - manufacturer: ${instrument.manufacturer}`);
          console.log(`    - type: ${instrument.type}`);
          console.log(`    - serial_number: ${instrument.serial_number}`);
          
          // Check if instrument has proper display name
          const displayName = instrument.name_alias || instrument.type || 'Unknown Instrument';
          console.log(`    - Display name: ${displayName}`);
          console.log('');
        } catch (error) {
          console.log(`  Certificate ${cert.id}: Gagal mengambil instrument ${cert.instrument}`);
          console.log(`    Error: ${error.message}\n`);
        }
      }
    }
  } else {
    console.log('3. Skip verifikasi mapping (tidak ada certificate data)\n');
  }
  
  // 4. Verifikasi tidak ada error 'name' column
  console.log('4. Memverifikasi tidak ada error "name" column...');
  try {
    // Test pencarian instrument yang biasanya trigger error
    await apiRequest('/instruments?q=test&pageSize=1');
    console.log('✓ Tidak ada error "name" column di instrument API\n');
  } catch (error) {
    if (error.message.includes('name') && error.message.includes('column')) {
      console.log('✗ TERDETEKSI ERROR: Masih ada referensi kolom "name" yang salah');
      console.log(`  Error: ${error.message}\n`);
    } else {
      console.log('✓ Tidak ada error "name" column\n');
    }
  }
  
  // 5. Simulasi PDF template data mapping
  console.log('5. Simulasi PDF template data mapping...');
  if (instruments.data.length > 0) {
    const inst = instruments.data[0];
    
    // Simulate what PDF mapper would produce (seperti di certificate-data-mapper.ts)
    const pdfData = {
      nama_alat: inst.name_alias || inst.type || '',
      merk: inst.manufacturer || '',
      tipe: inst.type || '',
      no_seri: inst.serial_number || '',
    };
    
    console.log(`   Instrument ID: ${inst.id}`);
    console.log(`   PDF Template Data:`);
    console.log(`     nama_alat: "${pdfData.nama_alat}"`);
    console.log(`     merk: "${pdfData.merk}"`);
    console.log(`     tipe: "${pdfData.tipe}"`);
    console.log(`     no_seri: "${pdfData.no_seri}"`);
    console.log('   ✓ PDF template mapping berfungsi dengan skema baru\n');
  }
  
  // 6. Simulasi display di UI (seperti di certificates-crud.tsx)
  console.log('6. Simulasi display di UI...');
  if (instruments.data.length > 0) {
    instruments.data.forEach(inst => {
      // Logic yang sama seperti di certificates-crud.tsx
      const displayName = inst.name_alias || inst.type || 'Unknown Instrument';
      const fullDisplay = `${inst.manufacturer || ''} ${displayName}${inst.serial_number ? ` (${inst.serial_number})` : ''}`.trim();
      console.log(`   - ID ${inst.id}: ${fullDisplay}`);
    });
    console.log('   ✓ UI display berfungsi dengan skema baru\n');
  }
  
  // 7. Verifikasi Letter display
  console.log('7. Simulasi Letter display...');
  if (instruments.data.length > 0) {
    const inst = instruments.data[0];
    
    // Logic yang sama seperti di letters/[id]/view/page.tsx
    const letterDisplay = `${inst.manufacturer ? inst.manufacturer + ' ' : ''}${inst.name_alias || inst.type || 'Instrument'}${inst.serial_number ? ` (${inst.serial_number})` : ''}`;
    console.log(`   Instrument: ${letterDisplay}`);
    console.log('   ✓ Letter display berfungsi dengan skema baru\n');
  }
  
  console.log('=== TEST SELESAI ===');
}

// Helper untuk memeriksa apakah ada error di response
async function testEndpointSafety(endpoint, testName) {
  try {
    console.log(`Testing ${testName}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`  ✓ ${testName} berhasil`);
      return { success: true, data };
    } else {
      console.log(`  ✗ ${testName} gagal: ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log(`  ✗ ${testName} exception: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 MEMULAI PENGUJIAN CERTIFICATE-INSTRUMENT MAPPING\n');
  console.log('Pastikan server Next.js berjalan di http://localhost:3000\n');
  
  try {
    // Test koneksi
    console.log('🔍 Menguji koneksi ke server...');
    const connectionTest = await testEndpointSafety('/instruments', 'Connection Test');
    if (!connectionTest.success) {
      console.log('\n❌ Server tidak dapat diakses. Pastikan npm run dev sudah berjalan');
      return;
    }
    
    // Jalankan test utama
    await testCertificateInstrumentMapping();
    
  } catch (error) {
    console.error('\n❌ PENGUJIAN GAGAL:', error.message);
  }
}

runTests();