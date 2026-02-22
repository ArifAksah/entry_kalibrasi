async function testSessionCreation() {
    try {
        const response = await fetch('http://localhost:3000/api/calibration-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                station_id: 1, // Valid station from previous check
                start_date: '2023-01-01',
                end_date: '2023-01-02',
                place: 'Test Place',
                status: 'draft',
                instrument_id: 61 // Valid instrument ID (Termometer Gelas) from previous check
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response Keys:', Object.keys(data));
        console.log('Full Response:', JSON.stringify(data, null, 2));

        if (data.session_id) console.log('Found session_id:', data.session_id);
        if (data.id) console.log('Found id:', data.id);

    } catch (error) {
        console.error('Error:', error);
    }
}

testSessionCreation();
