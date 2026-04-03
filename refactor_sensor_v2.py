"""
Refactor instruments-crud.tsx:
- Remove separate "Informasi Sensor" block for multi-sensor standard instruments
- Integrate full sensor form (nama, merk, tipe, serial, range, resolution, funnel fields)
  into the certificate card's per-sensor section
- Add "Tambah Sensor" button inside each cert card
- Keep globalCertificates state structure (cert -> sensorData[]) but extend sensorData
  to also carry full sensor identity fields
"""
import re

with open('app/ui/dashboard/instruments-crud.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Original length: {len(content)}")

# =====================================================================
# STEP 1: Extend the sensorData type in globalCertificates state comment
# Add identity fields to each sensorData entry
# =====================================================================

# Change the sensorData block in the existing sensorData "add" logic
# When clicking "+ Tambah Sensor" inside a cert, we push id + full identity fields

# =====================================================================  
# STEP 2: Replace the per-sensor data section inside cert.expanded
# Current: shows only small header + drift/u95/correction_data
# New: full sensor form (identity fields) + drift/u95/correction_data + delete button
# =====================================================================

OLD_SENSOR_SECTION = '''                                   {/* Per-sensor data cards */}
                                   {cert.expanded && (
                                     <div className="px-4 py-4 border-t border-orange-100 bg-white space-y-4">
                                       <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Teknis Per Sensor</p>
                                       {sensorForms.length === 0 && (
                                         <p className="text-xs text-gray-400 italic">Tambahkan sensor terlebih dahulu di bagian Informasi Sensor.</p>
                                       )}
                                       {sensorForms.map((sensor, sIdx) => {
                                         const sd = cert.sensorData?.find((d: any) => d.sensorLocalId === sensor.id) ||
                                           { sensorLocalId: sensor.id, drift: 0, u95_general: 0, correction_data: [] };

                                         const updateSensorData = (field: string, value: any) => {
                                           setGlobalCertificates(prev => prev.map((c, ci) => {
                                             if (ci !== certIdx) return c;
                                             const existing = c.sensorData?.find(d => d.sensorLocalId === sensor.id);
                                             if (existing) {
                                               return { ...c, sensorData: c.sensorData.map(d => d.sensorLocalId === sensor.id ? { ...d, [field]: value } : d) };
                                             } else {
                                               return { ...c, sensorData: [...(c.sensorData || []), { sensorLocalId: sensor.id, drift: 0, u95_general: 0, correction_data: [], [field]: value }] };
                                             }
                                           }));
                                         };

                                         return (
                                           <div key={sensor.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                             {/* Sensor header */}
                                             <div className="px-4 py-2.5 bg-gray-50 flex items-center gap-3">
                                               <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                               </svg>
                                               <div className="flex-1">
                                                 <span className="text-sm font-semibold text-gray-800">
                                                   {sensor.nama_sensor || sensor.tipe_sensor || `Sensor ${sIdx + 1}`}
                                                 </span>
                                                 {sensor.serial_number_sensor && <span className="text-xs text-gray-400 ml-2">SN: {sensor.serial_number_sensor}</span>}
                                               </div>
                                             </div>
                                             {/* Sensor drift, u95 */}
                                             <div className="px-4 py-3 grid grid-cols-2 gap-3">
                                               <div>
                                                 <label className="block text-xs font-medium text-gray-600 mb-1">Drift</label>
                                                 <input type="number" step="any" value={sd.drift}
                                                   onChange={e => updateSensorData('drift', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                   className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                   placeholder="Ex: -0.05"/>
                                               </div>
                                               <div>
                                                 <label className="block text-xs font-medium text-gray-600 mb-1">U95 General</label>
                                                 <input type="number" step="any" value={sd.u95_general}
                                                   onChange={e => updateSensorData('u95_general', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                   className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                   placeholder="Ex: 0.02"/>
                                               </div>
                                             </div>
                                             {/* Tabel Koreksi per sensor */}
                                             <div className="px-4 pb-4">
                                               <div className="flex justify-between items-center mb-2">
                                                 <span className="text-xs font-semibold text-gray-600">Tabel Koreksi &amp; Ketidakpastian</span>
                                                 <button type="button"
                                                   onClick={() => updateSensorData('correction_data', [...(sd.correction_data || []), {setpoint:'',correction:'',u95:''}])}
                                                   className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded border border-blue-200 transition-colors">
                                                   + Tambah Baris
                                                 </button>
                                               </div>
                                               <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                 <table className="min-w-full divide-y divide-gray-200 text-xs">
                                                   <thead className="bg-gray-50"><tr>
                                                     <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Setpoint</th>
                                                     <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Koreksi</th>
                                                     <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">U95</th>
                                                     <th className="px-3 py-1.5 w-10"></th>
                                                   </tr></thead>
                                                   <tbody className="bg-white divide-y divide-gray-100">
                                                     {(!sd.correction_data || sd.correction_data.length === 0) ? (
                                                       <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-400 italic">Klik "+ Tambah Baris" untuk menambah titik koreksi.</td></tr>
                                                     ) : sd.correction_data.map((row: any, rIdx: number) => (
                                                       <tr key={rIdx}>
                                                         <td className="px-2 py-1"><input type="number" step="any" value={row.setpoint}
                                                           onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],setpoint:e.target.value}; updateSensorData('correction_data',nd); }}
                                                           className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                         <td className="px-2 py-1"><input type="number" step="any" value={row.correction}
                                                           onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],correction:e.target.value}; updateSensorData('correction_data',nd); }}
                                                           className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                         <td className="px-2 py-1"><input type="number" step="any" value={row.u95}
                                                           onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],u95:e.target.value}; updateSensorData('correction_data',nd); }}
                                                           className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                         <td className="px-2 py-1 text-center">
                                                           <button type="button"
                                                             onClick={() => updateSensorData('correction_data', sd.correction_data.filter((_: any, ri: number) => ri !== rIdx))}
                                                             className="text-red-400 hover:text-red-600">
                                                             <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                           </button>
                                                         </td>
                                                       </tr>
                                                     ))}
                                                   </tbody>
                                                 </table>
                                               </div>
                                             </div>
                                           </div>
                                         );
                                       })}
                                     </div>
                                   )}'''

NEW_SENSOR_SECTION = '''                                   {/* Per-sensor data cards — full sensor form integrated */}
                                   {cert.expanded && (
                                     <div className="border-t border-orange-100 bg-white">
                                       <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                                         <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sensor Yang Dikalibrasi dalam Sertifikat Ini</p>
                                         <button type="button"
                                           onClick={() => {
                                             const newSensorId = `sensor_${Date.now()}`;
                                             const newSensor = {
                                               id: newSensorId,
                                               sensor_name_id: null,
                                               nama_sensor: '',
                                               merk_sensor: '',
                                               tipe_sensor: '',
                                               serial_number_sensor: '',
                                               range_capacity: '',
                                               range_capacity_unit: '',
                                               graduating: '',
                                               graduating_unit: '',
                                               resolution: null,
                                               funnel_diameter: 0,
                                               funnel_diameter_unit: '',
                                               volume_per_tip: '',
                                               volume_per_tip_unit: '',
                                               funnel_area: 0,
                                               funnel_area_unit: '',
                                               is_standard: true,
                                               certificates: []
                                             };
                                             setSensorForms(prev => [...prev, newSensor]);
                                             setGlobalCertificates(prev => prev.map((c, ci) => {
                                               if (ci !== certIdx) return c;
                                               return { ...c, sensorData: [...(c.sensorData || []), { sensorLocalId: newSensorId, drift: 0, u95_general: 0, correction_data: [] }] };
                                             }));
                                           }}
                                           className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                           + Tambah Sensor
                                         </button>
                                       </div>
                                       {(cert.sensorData?.length === 0 || !cert.sensorData) && (
                                         <p className="px-4 pb-4 text-xs text-gray-400 italic">Belum ada sensor. Klik "+ Tambah Sensor" untuk menambahkan sensor ke sertifikat ini.</p>
                                       )}
                                       <div className="px-4 pb-4 space-y-5">
                                       {(cert.sensorData || []).map((sd: any, sIdx: number) => {
                                         const sensor = sensorForms.find(s => s.id === sd.sensorLocalId) || {
                                           id: sd.sensorLocalId,
                                           sensor_name_id: sd.sensor_name_id ?? null,
                                           nama_sensor: sd.nama_sensor ?? '',
                                           merk_sensor: sd.merk_sensor ?? '',
                                           tipe_sensor: sd.tipe_sensor ?? '',
                                           serial_number_sensor: sd.serial_number_sensor ?? '',
                                           range_capacity: sd.range_capacity ?? '',
                                           range_capacity_unit: sd.range_capacity_unit ?? '',
                                           graduating: sd.graduating ?? '',
                                           graduating_unit: sd.graduating_unit ?? '',
                                           resolution: sd.resolution ?? null,
                                           funnel_diameter: 0,
                                           funnel_diameter_unit: '',
                                           volume_per_tip: '',
                                           volume_per_tip_unit: '',
                                           funnel_area: 0,
                                           funnel_area_unit: '',
                                           is_standard: true
                                         };

                                         const updateSensorIdentity = (field: string, value: any) => {
                                           setSensorForms(prev => prev.map(s => s.id === sd.sensorLocalId ? { ...s, [field]: value } : s));
                                         };

                                         const updateSensorData = (field: string, value: any) => {
                                           setGlobalCertificates(prev => prev.map((c, ci) => {
                                             if (ci !== certIdx) return c;
                                             const existing = c.sensorData?.find((d: any) => d.sensorLocalId === sd.sensorLocalId);
                                             if (existing) {
                                               return { ...c, sensorData: c.sensorData.map((d: any) => d.sensorLocalId === sd.sensorLocalId ? { ...d, [field]: value } : d) };
                                             } else {
                                               return { ...c, sensorData: [...(c.sensorData || []), { sensorLocalId: sd.sensorLocalId, drift: 0, u95_general: 0, correction_data: [], [field]: value }] };
                                             }
                                           }));
                                         };

                                         const isRainSensor = instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('hujan') ||
                                           instrumentNames.find(n => n.id === sensor.sensor_name_id)?.name?.toLowerCase().includes('rain');

                                         return (
                                           <div key={sd.sensorLocalId} className="border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                                             {/* Sensor header with delete */}
                                             <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between border-b border-blue-100">
                                               <div className="flex items-center gap-2">
                                                 <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                 </svg>
                                                 <span className="text-sm font-semibold text-blue-900">
                                                   Sensor {sIdx + 1}{sensor.nama_sensor ? ` — ${sensor.nama_sensor}` : ''}
                                                 </span>
                                               </div>
                                               <button type="button"
                                                 onClick={() => {
                                                   setSensorForms(prev => prev.filter(s => s.id !== sd.sensorLocalId));
                                                   setGlobalCertificates(prev => prev.map((c, ci) => {
                                                     if (ci !== certIdx) return c;
                                                     return { ...c, sensorData: c.sensorData.filter((d: any) => d.sensorLocalId !== sd.sensorLocalId) };
                                                   }));
                                                 }}
                                                 className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                 title="Hapus sensor ini dari sertifikat">
                                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                               </button>
                                             </div>

                                             <div className="p-4 space-y-4">
                                               {/* Identitas Sensor */}
                                               <div>
                                                 <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identitas Sensor</p>
                                                 <div className="space-y-3">
                                                   <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Nama Sensor</label>
                                                     <CustomSelect
                                                       options={instrumentNames.map(n => ({ value: n.id, label: n.name }))}
                                                       value={sensor.sensor_name_id}
                                                       onChange={(val) => updateSensorIdentity('sensor_name_id', val ? Number(val) : null)}
                                                       placeholder="-- Pilih Nama Sensor --"
                                                       clearLabel="— Tidak dipilih"
                                                     />
                                                   </div>
                                                   <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Alias Sensor</label>
                                                     <input type="text" value={sensor.nama_sensor}
                                                       onChange={e => updateSensorIdentity('nama_sensor', e.target.value)}
                                                       className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                       placeholder="Contoh: Sensor Suhu Ruang A..."/>
                                                   </div>
                                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                     <div>
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Merk</label>
                                                       <input type="text" value={sensor.merk_sensor}
                                                         onChange={e => updateSensorIdentity('merk_sensor', e.target.value)}
                                                         className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                         placeholder="Manufacturer"/>
                                                     </div>
                                                     <div>
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Tipe</label>
                                                       <input type="text" value={sensor.tipe_sensor}
                                                         onChange={e => updateSensorIdentity('tipe_sensor', e.target.value)}
                                                         className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                         placeholder="Tipe sensor"/>
                                                     </div>
                                                     <div>
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
                                                       <input type="text" value={sensor.serial_number_sensor}
                                                         onChange={e => updateSensorIdentity('serial_number_sensor', e.target.value)}
                                                         className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                         placeholder="SN"/>
                                                     </div>
                                                   </div>
                                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                     <div>
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Range Capacity</label>
                                                       <div className="flex gap-2">
                                                         <input type="text" value={sensor.range_capacity}
                                                           onChange={e => updateSensorIdentity('range_capacity', e.target.value)}
                                                           className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                           placeholder="Ex: 0-100"/>
                                                         <div className="w-24">
                                                           <UnitSelect units={units} value={sensor.range_capacity_unit}
                                                             onChange={val => updateSensorIdentity('range_capacity_unit', val)} placeholder="Unit"/>
                                                         </div>
                                                       </div>
                                                     </div>
                                                     <div>
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Graduating</label>
                                                       <div className="flex gap-2">
                                                         <input type="text" value={sensor.graduating}
                                                           onChange={e => updateSensorIdentity('graduating', e.target.value)}
                                                           className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                           placeholder="Ex: 0.01"/>
                                                         <div className="w-24">
                                                           <UnitSelect units={units} value={sensor.graduating_unit}
                                                             onChange={val => updateSensorIdentity('graduating_unit', val)} placeholder="Unit"/>
                                                         </div>
                                                       </div>
                                                     </div>
                                                     <div className="sm:col-span-2">
                                                       <label className="block text-xs font-medium text-gray-600 mb-1">Resolution <span className="text-gray-400 font-normal">(untuk perhitungan U95)</span></label>
                                                       <input type="number" step="any" value={sensor.resolution ?? ''}
                                                         onChange={e => updateSensorIdentity('resolution', e.target.value === '' ? null : parseFloat(e.target.value))}
                                                         className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                         placeholder="Ex: 0.01"/>
                                                     </div>
                                                   </div>
                                                   {isRainSensor && (
                                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                       <div>
                                                         <label className="block text-xs font-medium text-gray-600 mb-1">Funnel Diameter</label>
                                                         <div className="flex gap-2">
                                                           <input type="number" value={sensor.funnel_diameter}
                                                             onChange={e => updateSensorIdentity('funnel_diameter', parseFloat(e.target.value) || 0)}
                                                             className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white" placeholder="0"/>
                                                           <div className="w-20"><UnitSelect units={units} value={sensor.funnel_diameter_unit}
                                                             onChange={val => updateSensorIdentity('funnel_diameter_unit', val)} placeholder="Unit"/></div>
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <label className="block text-xs font-medium text-gray-600 mb-1">Volume Per Tip</label>
                                                         <div className="flex gap-2">
                                                           <input type="text" value={sensor.volume_per_tip}
                                                             onChange={e => updateSensorIdentity('volume_per_tip', e.target.value)}
                                                             className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white" placeholder="volume"/>
                                                           <div className="w-20"><UnitSelect units={units} value={sensor.volume_per_tip_unit}
                                                             onChange={val => updateSensorIdentity('volume_per_tip_unit', val)} placeholder="Unit"/></div>
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <label className="block text-xs font-medium text-gray-600 mb-1">Funnel Area</label>
                                                         <div className="flex gap-2">
                                                           <input type="number" value={sensor.funnel_area}
                                                             onChange={e => updateSensorIdentity('funnel_area', parseFloat(e.target.value) || 0)}
                                                             className="flex-1 text-sm px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white" placeholder="0"/>
                                                           <div className="w-20"><UnitSelect units={units} value={sensor.funnel_area_unit}
                                                             onChange={val => updateSensorIdentity('funnel_area_unit', val)} placeholder="Unit"/></div>
                                                         </div>
                                                       </div>
                                                     </div>
                                                   )}
                                                 </div>
                                               </div>

                                               {/* Data Kalibrasi */}
                                               <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-200">
                                                 <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">Data Kalibrasi</p>
                                                 <div className="grid grid-cols-2 gap-3 mb-3">
                                                   <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">Drift</label>
                                                     <input type="number" step="any" value={sd.drift}
                                                       onChange={e => updateSensorData('drift', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                       className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-amber-400 focus:border-amber-400 bg-white"
                                                       placeholder="Ex: -0.05"/>
                                                   </div>
                                                   <div>
                                                     <label className="block text-xs font-medium text-gray-600 mb-1">U95 General</label>
                                                     <input type="number" step="any" value={sd.u95_general}
                                                       onChange={e => updateSensorData('u95_general', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                       className="w-full text-sm px-2.5 py-1.5 border border-gray-300 rounded focus:ring-amber-400 focus:border-amber-400 bg-white"
                                                       placeholder="Ex: 0.02"/>
                                                   </div>
                                                 </div>
                                                 <div className="flex justify-between items-center mb-2">
                                                   <span className="text-xs font-semibold text-gray-600">Tabel Koreksi &amp; Ketidakpastian</span>
                                                   <button type="button"
                                                     onClick={() => updateSensorData('correction_data', [...(sd.correction_data || []), {setpoint:'',correction:'',u95:''}])}
                                                     className="text-xs bg-white hover:bg-amber-50 text-amber-700 px-2.5 py-1 rounded border border-amber-300 transition-colors">
                                                     + Tambah Baris
                                                   </button>
                                                 </div>
                                                 <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                   <table className="min-w-full divide-y divide-gray-200 text-xs">
                                                     <thead className="bg-gray-50"><tr>
                                                       <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Setpoint</th>
                                                       <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">Koreksi</th>
                                                       <th className="px-3 py-1.5 text-left text-gray-500 font-medium uppercase">U95</th>
                                                       <th className="px-3 py-1.5 w-10"></th>
                                                     </tr></thead>
                                                     <tbody className="bg-white divide-y divide-gray-100">
                                                       {(!sd.correction_data || sd.correction_data.length === 0) ? (
                                                         <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-400 italic">Klik "+ Tambah Baris" untuk menambah titik koreksi.</td></tr>
                                                       ) : sd.correction_data.map((row: any, rIdx: number) => (
                                                         <tr key={rIdx}>
                                                           <td className="px-2 py-1"><input type="number" step="any" value={row.setpoint}
                                                             onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],setpoint:e.target.value}; updateSensorData('correction_data',nd); }}
                                                             className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                           <td className="px-2 py-1"><input type="number" step="any" value={row.correction}
                                                             onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],correction:e.target.value}; updateSensorData('correction_data',nd); }}
                                                             className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                           <td className="px-2 py-1"><input type="number" step="any" value={row.u95}
                                                             onChange={e => { const nd=[...(sd.correction_data||[])]; nd[rIdx]={...nd[rIdx],u95:e.target.value}; updateSensorData('correction_data',nd); }}
                                                             className="w-full border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500"/></td>
                                                           <td className="px-2 py-1 text-center">
                                                             <button type="button"
                                                               onClick={() => updateSensorData('correction_data', sd.correction_data.filter((_: any, ri: number) => ri !== rIdx))}
                                                               className="text-red-400 hover:text-red-600">
                                                               <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                             </button>
                                                           </td>
                                                         </tr>
                                                       ))}
                                                     </tbody>
                                                   </table>
                                                 </div>
                                               </div>
                                             </div>
                                           </div>
                                         );
                                       })}
                                       </div>
                                     </div>
                                   )}'''

if OLD_SENSOR_SECTION in content:
    content = content.replace(OLD_SENSOR_SECTION, NEW_SENSOR_SECTION)
    print("✓ Replaced per-sensor section inside certificate card")
else:
    print("✗ Could not find OLD_SENSOR_SECTION")
    # Try to debug
    search_snippet = "Per-sensor data cards"
    if search_snippet in content:
        idx = content.index(search_snippet)
        print(f"Found start at {idx}")
        print(repr(content[idx-50:idx+200]))
    else:
        print("Not found at all")

# =====================================================================
# STEP 3: Remove the old multi-sensor "Informasi Sensor" block
# (lines ~1477-1736) since sensors are now managed inside cert cards
# For IsStandard + multi-sensor, the info is inside the cert card
# =====================================================================

OLD_MULTI_SENSOR_BLOCK = '''                    {/* Sensor Information - Conditional */}
                    {form.memiliki_lebih_satu && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">'''

if OLD_MULTI_SENSOR_BLOCK in content:
    # Find the end of this block
    block_start = content.index(OLD_MULTI_SENSOR_BLOCK)
    # Find "    </form>" after this block
    # The block always ends before </form>
    form_end = content.index('                  </form>', block_start)
    # Remove the block
    content = content[:block_start] + content[form_end:]
    print("✓ Removed old multi-sensor Informasi Sensor block")
else:
    print("✗ Could not find OLD_MULTI_SENSOR_BLOCK")

print(f"New length: {len(content)}")

with open('app/ui/dashboard/instruments-crud.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Run: npx tsc --noEmit to check")
