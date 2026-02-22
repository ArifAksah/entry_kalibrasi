async function testCalibrationSession() {
    try {
        const response = await fetch('http://localhost:3000/api/calibration-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                station_id: 1, // Assumptions: ID 1 exists
                start_date: '2023-01-01',
                end_date: '2023-01-02',
                place: 'Test Place',
                notes: 'Test Notes',
                status: 'draft'
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testCalibrationSession();
