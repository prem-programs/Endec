/**
 * crypto.js — AES-256-GCM encryption/decryption via Web Crypto API
 * No DOM dependencies. Pure async functions.
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH = 256;

function _toBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

function _fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function _deriveKey(password, salt, usage) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
        keyMaterial,
        { name: "AES-GCM", length: KEY_LENGTH },
        false,
        [usage]
    );
}

/**
 * Encrypt plaintext message with a password.
 * Returns a single string: "saltB64:ivB64:ciphertextB64"
 */
async function encryptAESGCM(message, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await _deriveKey(password, salt, "encrypt");

    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(message)
    );

    return `${_toBase64(salt)}:${_toBase64(iv)}:${_toBase64(new Uint8Array(encrypted))}`;
}

/**
 * Decrypt a "saltB64:ivB64:ciphertextB64" string with a password.
 * Throws if format is invalid or password is wrong.
 */
async function decryptAESGCM(data, password) {
    const [saltB64, ivB64, encB64] = data.split(":");
    if (!saltB64 || !ivB64 || !encB64) throw new Error("Invalid encrypted format");

    const salt      = _fromBase64(saltB64);
    const iv        = _fromBase64(ivB64);
    const encrypted = _fromBase64(encB64);
    const key       = await _deriveKey(password, salt, "decrypt");

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
}

/**
 * Generate a secure random password-like string for zero-knowledge links.
 */
function generateRandomKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}
