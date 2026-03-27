import os

file_path = r'd:\entry_kalibrasi\next-dashboard-app\app\certificates\[id]\view\page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Rename PrintCertificatePage to ViewCertificatePage
text = text.replace('PrintCertificatePage', 'ViewCertificatePage')

# 2. Prevent window.print() and auto print logic
# Find the useEffect block for printing
import re

text = re.sub(
    r'(// Panggil print hanya setelah data.*?\n  useEffect\(\(\) => \{.*?\n  \}, \[loading, cert, verificationLoaded, handleQRRendered, isDownloadMode\]\))',
    r'  // Auto-print logic removed for View mode',
    text,
    flags=re.DOTALL
)

# 3. Add timelineLogs state and Srikandi timeline component
imports_end = text.index('\n// --- TIPE DATA KOMPREHENSIF ---')
timeline_state_code = """
  // State for Timeline
  const [timelineLogs, setTimelineLogs] = useState<any[]>([])

  useEffect(() => {
    if (!cert?.id) return
    fetch(`/api/certificate-logs?certificate_id=${cert.id}`)
      .then(res => res.json())
      .then(data => setTimelineLogs(data.data || []))
      .catch(err => console.error("Failed to load timeline logs", err))
  }, [cert?.id])

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      created: 'Dibuat',
      sent: 'Dikirim Ke Verifikator',
      approved_v1: 'Disetujui Verifikator 1',
      approved_v2: 'Disetujui Verifikator 2',
      approved_assignor: 'Disetujui Assignor',
      rejected_v1: 'Ditolak Verifikator 1',
      rejected_v2: 'Ditolak Verifikator 2',
      rejected_assignor: 'Ditolak Assignor',
      updated: 'Koreksi Data',
    }
    return map[action] || action
  }
"""

# Insert timeline state right before "const [isDownloadMode, setIsDownloadMode] = useState(false)"
text = text.replace(
    '  // Check if download or PDF parameter is present\n  const [isDownloadMode',
    timeline_state_code + '\n  // Check if download or PDF parameter is present\n  const [isDownloadMode'
)

# Add Linimasa Sidebar structure to the return statement.
# Find `  return (\n    <>` or `  return (`
# Actually the print page just returns `<div><style>{A4Style}</style><div className="print-container">...`

# The return is at `  return (\n    <div>\n      <style dangerouslySetInnerHTML={{ __html: A4Style }} />`
# Or `  return (\n    <div>\n      <style dangerouslySetInnerHTML`
# I will search for the first '<style' inside return.

return_match = re.search(r'return\s*\(\s*<div\s*>\s*<style\s*dangerouslySetInnerHTML', text)
if not return_match:
    # try another way
    return_match = re.search(r'return\s*\(\s*<div.*?>\s*<style.*?A4Style', text, re.DOTALL)

sidebar_jsx = """
        {/* Sidebar Linimasa Srikandi Style */}
        <div className="w-full md:w-80 flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-6 self-start sticky top-6">
          <h3 className="text-sm font-bold text-gray-900 flex flex-row items-center gap-2 mb-6 border-b pb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Linimasa Sertifikat
          </h3>
          {timelineLogs.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">Belum ada linimasa</div>
          ) : (
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
              {timelineLogs.map((log) => {
                const isRejected = log.action.includes('reject');
                const color = isRejected ? 'bg-red-500' : 'bg-green-500';
                const dateObj = new Date(log.created_at);
                const time = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
                const date = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                return (
                  <div key={log.id} className="relative mb-6 last:mb-0 ml-4">
                    <div className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white ${color} shadow-sm z-10`}></div>
                    <div className="text-[10px] font-bold text-gray-500 mb-0.5">{date}</div>
                    <div className="text-xs font-bold text-gray-900 mb-1">{formatAction(log.action)}</div>
                    <div className="text-[10px] bg-gray-100/50 text-gray-500 px-2 py-0.5 rounded inline-block mb-1">{time}</div>
                    <div className="text-[10px] text-gray-600 mt-1 leading-relaxed capitalize">
                      {log.performed_by_name || log.performed_by}
                    </div>
                    {log.notes && (
                      <div className="text-[10px] italic text-gray-500 mt-1 border-l-2 border-gray-200 pl-2">"{log.notes}"</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* Certificate A4 Container */}
        <div className="flex-1 overflow-auto bg-gray-100/50 p-6 flex justify-center items-start border rounded-lg shadow-inner">
          <div className="bg-white shadow-xl">
"""

text = text.replace(
    'return (\n    <div>',
    '''return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 min-h-screen items-start bg-gray-50">
      <div className="w-full flex justify-between items-center mb-6 md:col-span-2 hidden">
         <h1 className="text-2xl font-bold">View Certificate</h1>
      </div>
      <style dangerouslySetInnerHTML={{ __html: A4Style }} />
''' + sidebar_jsx + '\n<div>'
)

# And now close the newly opened divs right before the final closing div of the function.
# The end of the file looks like:
#         )}
#       </div>
#     </div>
#   )
# }
# export default ViewCertificatePage

text = text.replace(
    '    </div>\n  )\n}\n\nexport default ViewCertificatePage',
    '    </div>\n    </div>\n    </div>\n    </div>\n  )\n}\n\nexport default ViewCertificatePage'
)

# Inject the print tools header so user doesn't lose the back button
header_jsx = """
      {/* Header */}
      <div className="w-full bg-white shadow-sm border-b absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Image src={bmkgLogo} alt="BMKG" width={40} height={40} className="mr-3" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Certificate View</h1>
                <p className="text-sm text-gray-500">Sertifikat Kalibrasi - {cert.no_certificate}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/certificates/${cert.id}/print`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                Print
              </button>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-20 w-full flex flex-col md:flex-row gap-6">
"""

# Let's adjust the wrapper to include the header
text = text.replace(
    'return (\n    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 min-h-screen items-start bg-gray-50">',
    'return (\n    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-12 pt-16">\n' + header_jsx
)

# Fix the end wrapper string too
text = text.replace(
    '    </div>\n    </div>\n    </div>\n    </div>\n  )\n}\n\nexport default ViewCertificatePage',
    '    </div>\n    </div>\n    </div>\n    </div>\n    </div>\n  )\n}\n\nexport default ViewCertificatePage'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Done updating")
