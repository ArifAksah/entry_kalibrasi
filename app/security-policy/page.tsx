export const metadata = {
  title: 'Kebijakan Keamanan — SIMKAL',
}

const sections = [
  {
    title: 'Pelaporan Kerentanan',
    body: 'Temuan keamanan dapat dilaporkan ke security@bmkg.go.id. Sertakan langkah reproduksi, dampak, dan bukti pendukung. Kami berkomitmen menindaklanjuti laporan yang valid secara bertanggung jawab.',
  },
  {
    title: 'Cakupan',
    body: 'Kebijakan ini berlaku untuk aplikasi SIMKAL (Sistem Informasi Manajemen Kalibrasi) beserta API publik dan halaman verifikasi sertifikat yang berada di bawah domain resmi BMKG.',
  },
  {
    title: 'Penanganan Data',
    body: 'Data pribadi seperti NIK dan NIP tidak pernah ditampilkan pada endpoint publik. Halaman verifikasi sertifikat hanya menampilkan informasi yang diperlukan untuk memvalidasi keaslian dokumen.',
  },
  {
    title: 'Pengujian yang Diizinkan',
    body: 'Pengujian keamanan hanya boleh dilakukan pada akun dan data milik penguji, tanpa mengganggu ketersediaan layanan. Dilarang mengakses, mengubah, atau menyebarkan data milik pihak lain.',
  },
]

export default function SecurityPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Kebijakan Keamanan
          </h1>
          <p className="mt-1 text-gray-500">
            Kebijakan penanganan keamanan informasi dan pelaporan kerentanan
            SIMKAL.
          </p>
        </header>

        <div className="space-y-4">
          {sections.map((item) => (
            <section
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.body}
              </p>
            </section>
          ))}
        </div>

        <footer className="text-center text-xs text-slate-400 pt-4">
          BMKG — SIMKAL
        </footer>
      </div>
    </main>
  )
}
