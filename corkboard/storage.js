// storage.js – localStorage persistence

const STORAGE_KEY = 'corkboard_v1';

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Zapis nieudany:', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Odczyt nieudany:', e);
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
