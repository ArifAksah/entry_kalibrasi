async function testRawData() {
    try {
        const response = await fetch('http://localhost:3000/api/raw-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
                data: [{ name: 'Test Sheet', data: [['Header1'], [1]] }],
                filename: 'test.xlsx',
                uploaded_by: 'test-user'
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);
    } catch (error) {
        console.error('Error:', error);
    }
}

testRawData();
