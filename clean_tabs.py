import re

with open('app/ui/dashboard/instruments-crud.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Tabs block
content = re.sub(r'\{\/\* Tabs \*\/.*?<\/nav>\s*<\/div>', '', content, flags=re.DOTALL)

# 2. Fix the header
header_content = r"""
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 font-medium">Filter:</span>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as any); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Semua Instrumen</option>
              <option value="uut">Instrumen UUT</option>
              <option value="standard">Instrumen Standar</option>
            </select>
          </div>
          <h2 className="text-xl font-bold text-gray-800 border-l border-gray-300 pl-4">
            Daftar Instrumen
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            placeholder="Cari instrumen..."
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />

          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {can('instrument', 'create') && (
            <button"""

def replace_chunk(text):
    start_tag = '<div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">'
    end_tag = 'onClick={() => openModal()}'
    
    parts = text.split(start_tag)
    if len(parts) > 1:
        tail_parts = parts[1].split(end_tag)
        result = parts[0] + header_content + '\n              ' + end_tag + tail_parts[1]
        return result
    return text

content = replace_chunk(content)

# Remove certStandard tab content
cert_start = "{/* Content for Certificate Management Tab */}"
cert_end = "{/* Existing Table Code but wrapped to only show when activeTab is not certStandard */}"

if cert_start in content and cert_end in content:
    before = content.split(cert_start)[0]
    after = content.split(cert_end)[1]
    content = before + after

# Remove activeTab !== 'certStandard' logic
content = content.replace("{\n        activeTab !== 'certStandard' && (\n          <div className=\"bg-white rounded-lg shadow overflow-hidden\">", 
                            "<div className=\"bg-white rounded-lg shadow overflow-hidden mt-6\">")

content = content.replace("          </div>\n        )\n      }\n\n      <div className=\"flex items-center justify-between px-4 py-3 border-t",
                            "          </div>\n\n      <div className=\"flex items-center justify-between px-4 py-3 border-t")


with open('app/ui/dashboard/instruments-crud.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
