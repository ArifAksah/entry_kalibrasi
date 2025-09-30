// Script untuk debug assignment verifikator
// Jalankan di browser console atau Node.js

const checkCertificateAssignment = async (certificateId) => {
  try {
    // Cek data certificate
    const certResponse = await fetch('/api/certificates')
    const certificates = await certResponse.json()
    const cert = certificates.find(c => c.id === certificateId)
    
    console.log('=== Certificate Data ===')
    console.log('Certificate ID:', certificateId)
    console.log('Certificate Data:', cert)
    console.log('Verifikator 1:', cert?.verifikator_1)
    console.log('Verifikator 2:', cert?.verifikator_2)
    console.log('Verifikator 1 Type:', typeof cert?.verifikator_1)
    console.log('Verifikator 2 Type:', typeof cert?.verifikator_2)
    
    // Cek data personel
    const personelResponse = await fetch('/api/personel')
    const personel = await personelResponse.json()
    
    console.log('\n=== Personel Data ===')
    console.log('Total Personel:', personel.length)
    personel.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, Type: ${typeof p.id}`)
    })
    
    // Cek user yang sedang login
    const authResponse = await fetch('/api/auth/user')
    const user = await authResponse.json()
    console.log('\n=== Current User ===')
    console.log('User ID:', user?.id)
    console.log('User Type:', typeof user?.id)
    
    return { cert, personel, user }
  } catch (error) {
    console.error('Error checking assignment:', error)
  }
}

// Gunakan dengan: checkCertificateAssignment(123) // ganti 123 dengan ID certificate

