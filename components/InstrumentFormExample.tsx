// Example React component showing conditional sensor fields
// This demonstrates how to implement the memiliki_lebih_satu logic

import React, { useState } from 'react';

interface InstrumentFormData {
  // Station fields
  wmo_id: string;
  nama_stasiun: string;
  
  // Instrument fields
  nama_alat: string;
  jenis_alat: string;
  merk: string;
  tipe: string;
  seria_number: string;
  memiliki_lebih_satu: boolean;
  
  // Sensor fields (conditional)
  nama_sensor?: string;
  merk_sensor?: string;
  tipe_sensor?: string;
  serial_number_sensor?: string;
  range_capacity?: string;
  range_capacity_unit?: string;
  graduating?: string;
  graduating_unit?: string;
  funnel_diameter?: number;
  funnel_diameter_unit?: string;
  volume_per_tip?: string;
  volume_per_tip_unit?: string;
  funnel_area?: number;
  funnel_area_unit?: string;
  is_standard?: boolean;
}

const InstrumentForm: React.FC = () => {
  const [formData, setFormData] = useState<InstrumentFormData>({
    wmo_id: '',
    nama_stasiun: '',
    nama_alat: '',
    jenis_alat: '',
    merk: '',
    tipe: '',
    seria_number: '',
    memiliki_lebih_satu: false,
    nama_sensor: '',
    merk_sensor: '',
    tipe_sensor: '',
    serial_number_sensor: '',
    range_capacity: '',
    range_capacity_unit: '',
    graduating: '',
    graduating_unit: '',
    funnel_diameter: 0,
    funnel_diameter_unit: '',
    volume_per_tip: '',
    volume_per_tip_unit: '',
    funnel_area: 0,
    funnel_area_unit: '',
    is_standard: false
  });

  const handleInputChange = (field: keyof InstrumentFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form className="space-y-6">
      {/* Station Information */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Informasi Stasiun</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">WMO ID</label>
            <input
              type="text"
              value={formData.wmo_id}
              onChange={(e) => handleInputChange('wmo_id', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nama Stasiun</label>
            <input
              type="text"
              value={formData.nama_stasiun}
              onChange={(e) => handleInputChange('nama_stasiun', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Instrument Information */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Informasi Alat</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Alat</label>
            <input
              type="text"
              value={formData.nama_alat}
              onChange={(e) => handleInputChange('nama_alat', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jenis Alat</label>
            <input
              type="text"
              value={formData.jenis_alat}
              onChange={(e) => handleInputChange('jenis_alat', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Merk</label>
            <input
              type="text"
              value={formData.merk}
              onChange={(e) => handleInputChange('merk', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipe</label>
            <input
              type="text"
              value={formData.tipe}
              onChange={(e) => handleInputChange('tipe', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.seria_number}
              onChange={(e) => handleInputChange('seria_number', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="memiliki_lebih_satu"
              checked={formData.memiliki_lebih_satu}
              onChange={(e) => handleInputChange('memiliki_lebih_satu', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="memiliki_lebih_satu" className="text-sm font-medium">
              Memiliki Lebih Satu Sensor
            </label>
          </div>
        </div>
      </div>

      {/* Sensor Information - Conditional */}
      {formData.memiliki_lebih_satu && (
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">Informasi Sensor</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nama Sensor</label>
              <input
                type="text"
                value={formData.nama_sensor || ''}
                onChange={(e) => handleInputChange('nama_sensor', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Merk Sensor</label>
              <input
                type="text"
                value={formData.merk_sensor || ''}
                onChange={(e) => handleInputChange('merk_sensor', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipe Sensor</label>
              <input
                type="text"
                value={formData.tipe_sensor || ''}
                onChange={(e) => handleInputChange('tipe_sensor', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Serial Number Sensor</label>
              <input
                type="text"
                value={formData.serial_number_sensor || ''}
                onChange={(e) => handleInputChange('serial_number_sensor', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Range Capacity</label>
              <input
                type="text"
                value={formData.range_capacity || ''}
                onChange={(e) => handleInputChange('range_capacity', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Range Capacity Unit</label>
              <input
                type="text"
                value={formData.range_capacity_unit || ''}
                onChange={(e) => handleInputChange('range_capacity_unit', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Graduating</label>
              <input
                type="text"
                value={formData.graduating || ''}
                onChange={(e) => handleInputChange('graduating', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Graduating Unit</label>
              <input
                type="text"
                value={formData.graduating_unit || ''}
                onChange={(e) => handleInputChange('graduating_unit', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Funnel Diameter</label>
              <input
                type="number"
                value={formData.funnel_diameter || ''}
                onChange={(e) => handleInputChange('funnel_diameter', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Funnel Diameter Unit</label>
              <input
                type="text"
                value={formData.funnel_diameter_unit || ''}
                onChange={(e) => handleInputChange('funnel_diameter_unit', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Volume Per Tip</label>
              <input
                type="text"
                value={formData.volume_per_tip || ''}
                onChange={(e) => handleInputChange('volume_per_tip', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Volume Per Tip Unit</label>
              <input
                type="text"
                value={formData.volume_per_tip_unit || ''}
                onChange={(e) => handleInputChange('volume_per_tip_unit', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Funnel Area</label>
              <input
                type="number"
                value={formData.funnel_area || ''}
                onChange={(e) => handleInputChange('funnel_area', parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Funnel Area Unit</label>
              <input
                type="text"
                value={formData.funnel_area_unit || ''}
                onChange={(e) => handleInputChange('funnel_area_unit', e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_standard"
                checked={formData.is_standard || false}
                onChange={(e) => handleInputChange('is_standard', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="is_standard" className="text-sm font-medium">
                Is Standard
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Simpan
        </button>
      </div>
    </form>
  );
};

export default InstrumentForm;
