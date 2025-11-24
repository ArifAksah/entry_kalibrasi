const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeys() {
    console.log('Generating RSA Key Pair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    console.log('Generating AES Key...');
    const aesKey = crypto.randomBytes(32).toString('hex'); // 256-bit key

    console.log('Generating HMAC Salt...');
    const hmacSalt = crypto.randomBytes(32).toString('hex');

    const envContent = `
# NIK SECURITY KEYS
# Generated on ${new Date().toISOString()}
NEXT_PUBLIC_NIK_RSA_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"
NIK_RSA_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"
NIK_AES_KEY="${aesKey}"
NIK_HMAC_SALT="${hmacSalt}"
`;

    const outputPath = path.join(__dirname, '../.env.keys');
    fs.writeFileSync(outputPath, envContent);

    console.log('\nKeys generated successfully!');
    console.log(`Keys saved to: ${outputPath}`);
    console.log('\nPlease append the content of .env.keys to your .env file.');
    console.log('---------------------------------------------------');
    console.log(envContent);
    console.log('---------------------------------------------------');
}

generateKeys();
