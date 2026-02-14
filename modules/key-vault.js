/**
 * Key Vault — bezpieczne przechowywanie klucza API
 * Standard: Web Crypto API (AES-256-GCM) + PBKDF2 z PINem użytkownika
 * 
 * Tryby:
 *   1. PIN + AES-GCM → klucz zaszyfrowany w localStorage
 *   2. SessionStorage → klucz plaintext, ginie po zamknięciu karty
 *   3. Memory-only → klucz nigdzie nie zapisywany
 * 
 * Auto-lock: po 30 min bezczynności klucz wymazywany z pamięci
 */

const VAULT_STORAGE_KEY = 'nostradamnos_vault';
const VAULT_SALT_KEY = 'nostradamnos_vault_salt';
const VAULT_MODE_KEY = 'nostradamnos_vault_mode';
const AUTO_LOCK_MS = 30 * 60 * 1000; // 30 minut

// Stan wewnętrzny
let _decryptedKey = null;
let _autoLockTimer = null;
let _onLockCallback = null;

// =====================================================
// CRYPTO HELPERS (Web Crypto API)
// =====================================================

/**
 * Generuj losowy salt (16 bajtów)
 */
function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generuj losowy IV (12 bajtów, standard dla AES-GCM)
 */
function generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Derywuj klucz AES-256 z PINu via PBKDF2
 */
async function deriveKey(pin, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Szyfruj tekst AES-256-GCM
 */
async function encrypt(plaintext, pin) {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKey(pin, salt);

    const encoder = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext)
    );

    // Zapisz salt + iv + ciphertext jako base64
    const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Odszyfruj tekst AES-256-GCM
 */
async function decrypt(encryptedBase64, pin) {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const key = await deriveKey(pin, salt);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    return new TextDecoder().decode(decrypted);
}

// =====================================================
// VAULT PUBLIC API
// =====================================================

/**
 * Zwraca aktualny tryb przechowywania: 'pin' | 'session' | 'memory'
 */
export function getVaultMode() {
    return localStorage.getItem(VAULT_MODE_KEY) || 'pin';
}

/**
 * Ustaw tryb przechowywania
 */
export function setVaultMode(mode) {
    if (!['pin', 'session', 'memory'].includes(mode)) return;
    localStorage.setItem(VAULT_MODE_KEY, mode);
    console.log(`[KeyVault] Mode set to: ${mode}`);
}

/**
 * Czy vault ma zapisany zaszyfrowany klucz?
 */
export function hasStoredKey() {
    const mode = getVaultMode();
    if (mode === 'pin') return !!localStorage.getItem(VAULT_STORAGE_KEY);
    if (mode === 'session') return !!sessionStorage.getItem(VAULT_STORAGE_KEY);
    return false; // memory — nigdy nie przechowuje
}

/**
 * Czy klucz jest aktualnie odszyfrowany w pamięci?
 */
export function isUnlocked() {
    return _decryptedKey !== null && _decryptedKey.length > 0;
}

/**
 * Pobierz odszyfrowany klucz (lub null jeśli locked)
 */
export function getKey() {
    if (_decryptedKey) resetAutoLock();
    return _decryptedKey;
}

/**
 * Zapisz klucz API (szyfruje PINem lub zapisuje w session/memory)
 * @param {string} apiKey - klucz API  
 * @param {string} pin - PIN użytkownika (wymagany tylko dla trybu 'pin')
 */
export async function storeKey(apiKey, pin = null) {
    const mode = getVaultMode();

    if (mode === 'pin') {
        if (!pin || pin.length < 4) {
            throw new Error('PIN musi mieć co najmniej 4 znaki');
        }
        const encrypted = await encrypt(apiKey, pin);
        localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
        console.log('[KeyVault] Key encrypted and stored in localStorage');
    } else if (mode === 'session') {
        sessionStorage.setItem(VAULT_STORAGE_KEY, apiKey);
        console.log('[KeyVault] Key stored in sessionStorage');
    }
    // memory — nic nie zapisujemy

    _decryptedKey = apiKey;
    resetAutoLock();
}

/**
 * Odblokuj vault PINem (tryb 'pin')
 * @param {string} pin
 * @returns {string} odszyfrowany klucz API
 * @throws jeśli PIN nieprawidłowy
 */
export async function unlock(pin) {
    const mode = getVaultMode();

    if (mode === 'pin') {
        const encrypted = localStorage.getItem(VAULT_STORAGE_KEY);
        if (!encrypted) throw new Error('Brak zapisanego klucza');

        try {
            _decryptedKey = await decrypt(encrypted, pin);
        } catch (e) {
            throw new Error('Nieprawidłowy PIN');
        }
    } else if (mode === 'session') {
        _decryptedKey = sessionStorage.getItem(VAULT_STORAGE_KEY) || null;
        if (!_decryptedKey) throw new Error('Brak klucza w sesji');
    }

    resetAutoLock();
    console.log('[KeyVault] Vault unlocked');
    return _decryptedKey;
}

/**
 * Zablokuj vault — wymaż klucz z pamięci
 */
export function lock() {
    _decryptedKey = null;
    clearAutoLockTimer();
    console.log('[KeyVault] Vault locked');
    if (_onLockCallback) _onLockCallback();
}

/**
 * Wyczyść vault — usuń wszystko
 */
export function clearVault() {
    _decryptedKey = null;
    clearAutoLockTimer();
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(VAULT_SALT_KEY);
    sessionStorage.removeItem(VAULT_STORAGE_KEY);
    console.log('[KeyVault] Vault cleared');
}

/**
 * Zmień PIN (re-encrypt z nowym PINem)
 */
export async function changePin(oldPin, newPin) {
    if (getVaultMode() !== 'pin') throw new Error('Zmiana PINu dostępna tylko w trybie PIN');
    if (!newPin || newPin.length < 4) throw new Error('Nowy PIN musi mieć co najmniej 4 znaki');

    // Odszyfruj starym PINem
    const apiKey = await unlock(oldPin);

    // Zaszyfruj nowym PINem
    const encrypted = await encrypt(apiKey, newPin);
    localStorage.setItem(VAULT_STORAGE_KEY, encrypted);

    console.log('[KeyVault] PIN changed successfully');
}

/**
 * Ustaw callback wywoływany przy auto-lock
 */
export function onLock(callback) {
    _onLockCallback = callback;
}

/**
 * Migruj istniejący plaintext klucz z localStorage do vault
 * @param {string} plaintextKey - stary klucz
 * @param {string} pin - nowy PIN
 */
export async function migrateFromPlaintext(plaintextKey, pin) {
    if (!plaintextKey) return;
    setVaultMode('pin');
    await storeKey(plaintextKey, pin);
    // Usuń stary plaintext
    localStorage.removeItem('aiChat_apiKey');
    console.log('[KeyVault] Migrated from plaintext to encrypted vault');
}

// =====================================================
// AUTO-LOCK (30 min bezczynności)
// =====================================================

function clearAutoLockTimer() {
    if (_autoLockTimer) {
        clearTimeout(_autoLockTimer);
        _autoLockTimer = null;
    }
}

function resetAutoLock() {
    clearAutoLockTimer();
    if (_decryptedKey) {
        _autoLockTimer = setTimeout(() => {
            console.log('[KeyVault] Auto-lock triggered after 30 min inactivity');
            lock();
        }, AUTO_LOCK_MS);
    }
}

// Resetuj timer przy interakcji użytkownika
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
ACTIVITY_EVENTS.forEach(event => {
    document.addEventListener(event, () => {
        if (_decryptedKey) resetAutoLock();
    }, { passive: true });
});
