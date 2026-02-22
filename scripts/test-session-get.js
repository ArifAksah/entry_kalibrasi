async function testGet() {
    try {
        const response = await fetch('http://localhost:3000/api/calibration-sessions?station_id=1');
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testGet();
