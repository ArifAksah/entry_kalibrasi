import crypto from 'crypto'

// --- Server Side Utilities ---

/**
 * Decrypts data using the server's RSA Private Key.
 * Used to decrypt data sent from the client.
 */
export function decryptRSA(encryptedData: string): string {
    const privateKey = process.env.NIK_RSA_PRIVATE_KEY
    if (!privateKey) {
        throw new Error('NIK_RSA_PRIVATE_KEY is not defined')
    }

    try {
        const buffer = Buffer.from(encryptedData, 'base64')
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            buffer
        )
        return decrypted.toString('utf8')
    } catch (error) {
        console.error('RSA Decryption failed:', error)
        throw new Error('Failed to decrypt data')
    }
}

/**
 * Encrypts data using the server's AES Key.
 * Used for secure storage in the database.
 */
export function encryptAES(text: string): string {
    const keyHex = process.env.NIK_AES_KEY
    if (!keyHex) {
        throw new Error('NIK_AES_KEY is not defined')
    }

    const key = Buffer.from(keyHex, 'hex')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Return IV + Encrypted data (IV is needed for decryption)
    return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypts data using the server's AES Key.
 * Used to retrieve data from the database.
 */
export function decryptAES(encryptedText: string): string {
    const keyHex = process.env.NIK_AES_KEY
    if (!keyHex) {
        throw new Error('NIK_AES_KEY is not defined')
    }

    const textParts = encryptedText.split(':')
    if (textParts.length !== 2) {
        // Fallback: if data is not in IV:Data format, maybe it's legacy or plain text?
        // For security, we should probably fail or return as is if we are migrating.
        // But assuming strict mode:
        throw new Error('Invalid encrypted format')
    }

    const iv = Buffer.from(textParts[0], 'hex')
    const encryptedData = Buffer.from(textParts[1], 'hex')
    const key = Buffer.from(keyHex, 'hex')

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encryptedData)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
}

/**
 * Creates a blind index (hash) of the data.
 * Used for searching without decrypting.
 */
export function createBlindIndex(text: string): string {
    const salt = process.env.NIK_HMAC_SALT
    if (!salt) {
        throw new Error('NIK_HMAC_SALT is not defined')
    }

    const hmac = crypto.createHmac('sha256', salt)
    hmac.update(text)
    return hmac.digest('hex')
}

// --- Client Side Utilities ---
// Note: Client-side encryption should be done using JSEncrypt or Web Crypto API in the component.
// We can export the Public Key getter here if we had an API for it,
// but usually we just use the env var NEXT_PUBLIC_NIK_RSA_PUBLIC_KEY directly in the component.
