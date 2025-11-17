# Flexible Multi-Sensor System - Instruments CRUD

## Overview
Implementasi sistem sensor yang flexible memungkinkan user untuk menambah lebih dari satu sensor dan menghapus sensor yang tidak diperlukan.

## Features Implemented

### 1. Dynamic Sensor Management
- **Add Sensor**: Tombol "Tambah Sensor" untuk menambah sensor baru
- **Remove Sensor**: Tombol hapus (trash icon) untuk setiap sensor
- **Multiple Sensors**: Tidak ada batasan jumlah sensor yang bisa ditambahkan
- **Unique IDs**: Setiap sensor memiliki ID unik untuk identifikasi

### 2. State Management
```typescript
// Array state untuk multiple sensors
const [sensorForms, setSensorForms] = useState<Array<{
  id: string;
  nama_sensor: string;
  merk_sensor: string;
  tipe_sensor: string;
  serial_number_sensor: string;
  range_capacity: string;
  range_capacity_unit: string;
  graduating: string;
  graduating_unit: string;
  funnel_diameter: number;
  funnel_diameter_unit: string;
  volume_per_tip: string;
  volume_per_tip_unit: string;
  funnel_area: number;
  funnel_area_unit: string;
  is_standard: boolean;
}>>([])
```

### 3. Core Functions

#### Add Sensor
```typescript
const addSensor = () => {
  const newSensor = {
    id: `sensor_${Date.now()}`, // Unique ID
    // ... all sensor fields with default values
  }
  setSensorForms([...sensorForms, newSensor])
}
```

#### Remove Sensor
```typescript
const removeSensor = (sensorId: string) => {
  setSensorForms(sensorForms.filter(sensor => sensor.id !== sensorId))
}
```

#### Update Sensor
```typescript
const updateSensor = (sensorId: string, field: string, value: any) => {
  setSensorForms(sensorForms.map(sensor => 
    sensor.id === sensorId ? { ...sensor, [field]: value } : sensor
  ))
}
```

## UI/UX Improvements

### 1. Header Section
- **Sensor Counter**: Menampilkan jumlah sensor saat ini
- **Add Button**: Tombol "Tambah Sensor" dengan icon plus
- **Visual Hierarchy**: Layout yang jelas dengan icon dan deskripsi

### 2. Empty State
- **No Sensors Message**: Pesan ketika belum ada sensor
- **Call to Action**: Panduan untuk menambah sensor pertama
- **Visual Icon**: Icon sensor untuk visual guidance

### 3. Sensor Cards
- **Individual Cards**: Setiap sensor dalam card terpisah
- **Sensor Numbering**: "Sensor 1", "Sensor 2", dst.
- **Delete Button**: Tombol hapus dengan icon trash di setiap card
- **Unique IDs**: Checkbox dengan ID unik untuk setiap sensor

### 4. Form Fields
- **Consistent Styling**: Semua field menggunakan styling yang konsisten
- **Placeholders**: Placeholder text yang informatif
- **Responsive Layout**: Grid layout yang responsif
- **Focus States**: Ring focus yang jelas untuk accessibility

## Technical Implementation

### 1. Dynamic Rendering
```jsx
{sensorForms.map((sensor, index) => (
  <div key={sensor.id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <h5 className="text-md font-semibold text-gray-800 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600">...</svg>
        Sensor {index + 1}
      </h5>
      <button
        type="button"
        onClick={() => removeSensor(sensor.id)}
        className="text-red-600 hover:text-red-800 transition-colors duration-200 p-1"
        title="Hapus sensor ini"
      >
        <svg className="w-5 h-5">...</svg>
      </button>
    </div>
    {/* Sensor form fields */}
  </div>
))}
```

### 2. Field Updates
```jsx
<input
  type="text"
  value={sensor.nama_sensor}
  onChange={(e) => updateSensor(sensor.id, 'nama_sensor', e.target.value)}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
  placeholder="Enter sensor name"
/>
```

### 3. Auto-reset Logic
```typescript
// Reset sensor forms when memiliki_lebih_satu is unchecked
useEffect(() => {
  if (!form.memiliki_lebih_satu) {
    setSensorForms([]);
  }
}, [form.memiliki_lebih_satu]);
```

## User Experience Benefits

### ✅ **Flexibility**
- **Unlimited Sensors**: User dapat menambah sebanyak mungkin sensor
- **Easy Management**: Mudah menambah dan menghapus sensor
- **Individual Control**: Setiap sensor dapat dikelola secara terpisah

### ✅ **Visual Feedback**
- **Sensor Counter**: Menampilkan jumlah sensor saat ini
- **Clear Actions**: Tombol add/remove yang jelas dan mudah dipahami
- **Empty State**: Panduan yang jelas ketika belum ada sensor

### ✅ **Data Integrity**
- **Unique IDs**: Setiap sensor memiliki ID unik
- **State Consistency**: State management yang konsisten
- **Auto-reset**: Otomatis reset ketika checkbox tidak dicentang

### ✅ **Accessibility**
- **Keyboard Navigation**: Semua field dapat diakses dengan keyboard
- **Screen Reader**: Label dan title yang jelas untuk screen reader
- **Focus Management**: Focus states yang jelas

## Usage Flow

1. **Enable Multi-Sensor**: User mencentang "Memiliki Lebih Satu Sensor"
2. **Add First Sensor**: Klik "Tambah Sensor" untuk menambah sensor pertama
3. **Fill Sensor Data**: Isi informasi sensor yang diperlukan
4. **Add More Sensors**: Klik "Tambah Sensor" lagi untuk sensor tambahan
5. **Remove Unnecessary**: Klik tombol hapus jika ada sensor yang tidak diperlukan
6. **Submit Form**: Submit form dengan semua sensor yang telah diisi

## Future Enhancements

- **Bulk Operations**: Copy/paste sensor data antar sensor
- **Sensor Templates**: Template sensor untuk pengisian yang lebih cepat
- **Validation**: Real-time validation untuk setiap sensor
- **Import/Export**: Import/export sensor data dari file
- **Drag & Drop**: Reorder sensor dengan drag & drop
- **Search/Filter**: Cari dan filter sensor berdasarkan kriteria tertentu

## Browser Compatibility
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Performance Considerations
- **Efficient Rendering**: Hanya render sensor yang ada
- **Memory Management**: Cleanup state ketika modal ditutup
- **Optimized Updates**: Update hanya field yang berubah
- **Debounced Inputs**: Untuk field yang memerlukan debouncing










