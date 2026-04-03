import sys

with open('app/ui/dashboard/instruments-crud.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Extract the Multi-Sensor Form content
# The form starts with <div className="space-y-4"> inside  {sensorForms.map((sensor, index) => (
# It ends right before:  <div className="mt-4 flex items-center space-x-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">

start_marker = '                                <div className="space-y-4">'
end_marker = '                                <div className="mt-4 flex items-center space-x-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">'

if start_marker not in text or end_marker not in text:
    print("Could not find markers for sensor info block.")
    sys.exit(1)

# Grab the block
sensor_info_block = text.split(start_marker)[1].split(end_marker)[0]
# Add the start marker back
sensor_info_block = start_marker + sensor_info_block

# 2. Inject it into the Certificate sensor loop
# Where does the certificate sensor loop map elements?
cert_sensor_map_start = "{sensorForms.map((sensor, sIdx) => {"
cert_sensor_return = "                                          <div className=\"flex-1\">\n                                            <span className=\"text-sm font-semibold text-gray-800\">\n                                              {sensor.nama_sensor || sensor.tipe_sensor || `Sensor ${sIdx + 1}`}\n                                            </span>\n                                          </div>\n                                        </div>\n"

if cert_sensor_map_start not in text or cert_sensor_return not in text:
    print("Could not find certificate sensor map markers.")
    sys.exit(1)

# We want to replace the generic "Sensor Header" with the actual sensor fields PLUS keeping the Drift/U95 section.
# Actually, the user still wants a header like "Sensor 1...". 
# The simplest approach is to put the `sensor_info_block` just before the Drift section.
# The drift section starts with: `{/* Sensor drift, u95 */}`
drift_marker = '                                            {/* Sensor drift, u95 */}'

# We will inject `sensor_info_block` right before `drift_marker` but we need to adjust the variables.
# In the `sensorForms.map` of Certificate, the variable is `sensor` and `sIdx`. In the original info block, the index is `index`.
# Wait, `sensor_info_block` doesn't use `index` much, except for `Sensor {index + 1}` (but that's in the header, which we didn't slice).
# Let's inspect `sensor_info_block` usage of `index`: It uses `sensor.id` mostly.

# Inject the block
parts = text.split(drift_marker)
# We might have multiple drift_markers! Wait, we only have one in the template structure for Cert.
if len(parts) != 2:
    print(f"Found {len(parts)-1} drift markers, expected 1.")
    # Actually wait! The `drift_marker` is inside `cert.expanded && (` block. There is exactly one in the code.
    
new_text = parts[0] + "\n" + sensor_info_block.replace("                                ", "                                            ") + "\n" + drift_marker + parts[1]


# 3. Add the "Tambah Sensor" button inside the Certificate block!
# Inside the certificate card, where should it go?
# At the bottom of `{cert.expanded && (`
# Look for:
#                                     </div>
#                                   )}
#                                 </div>
#                               ))}
#                             </div>
cert_expanded_end = "                                    </div>\n                                  )}\n                                </div>"

tambah_sensor_button = """                                      {/* Tombol Tambah Sensor di dalam Sertifikat */}
                                      <div className="px-4 py-4 border-t border-orange-100 bg-orange-50/30 flex justify-center">
                                          <button
                                            type="button"
                                            onClick={() => addSensor(true)}
                                            className="bg-white border text-xs border-blue-200 hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg transition-colors duration-200 flex items-center shadow-sm"
                                          >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            + Tambah Sensor ke Sertifikat
                                          </button>
                                      </div>
"""

new_text = new_text.replace(
    "                                      })}\n                                    </div>\n                                  )}", 
    "                                      })}\n" + tambah_sensor_button + "                                    </div>\n                                  )}"
)

# 4. Completely eliminate the old "Informasi Sensor" section!
# It starts at: {/* Sensor Multi-Sensor Form */}
# It ends at: </form> -> wait no, before that!
#   </form>
# </div>
# {/* Fixed Footer */}

multi_sensor_start = "                      {/* Sensor Multi-Sensor Form */}"
multi_sensor_end = "                    </form>"

pieces = new_text.split(multi_sensor_start)
tail_pieces = pieces[1].split(multi_sensor_end)

new_text = pieces[0] + multi_sensor_end + tail_pieces[1]

with open('app/ui/dashboard/instruments-crud.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Migration script completed successfully!")
