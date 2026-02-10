// Moduł geolokalizacji - ograniczenie dostępu do Europy
// Status: AKTYWNY (importowany w index.html)

// Lista krajów europejskich wg ISO 3166-1 alpha-2
const EUROPE = [
    "PL","DE","FR","ES","IT","PT","NL","BE","LU","AT","CZ","SK","HU","SI","HR",
    "RO","BG","GR","DK","SE","FI","NO","EE","LV","LT","IE","CY","MT","IS","LI","CH","UK","GB"
];

// Blokada strony
async function blockAccess(reason) {
    let phone = '';
    try {
        const res = await fetch('./project.json', { cache: 'no-store' });
        const data = await res.json();
        phone = data?.author?.phone || '';
    } catch { /* brak project.json */ }

    const contactLine = phone
        ? `<p>Poproś o dostęp (SMS) tel.: ${phone}</p>`
        : '';

    document.body.innerHTML = `
        <div style="padding:40px; font-family:Arial; text-align:center;">
            <h1>🌍 Dostęp ograniczony</h1>
            <p>Ta strona jest dostępna wyłącznie dla użytkowników z Europy.</p>
            ${contactLine}
            <p><strong>Powód:</strong> ${reason}</p>
        </div>
    `;
}

// 1. Sprawdzenie strefy czasowej
function checkTimezone() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz || !tz.startsWith("Europe/")) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// 2. Sprawdzenie języka przeglądarki
function checkLanguage() {
    const europeanLangs = [
        "pl","de","fr","es","it","pt","nl","sv","no","fi","da","cs","sk","hu",
        "ro","bg","el","lt","lv","et","sl","hr","ga","uk","en"
    ];

    const lang = navigator.language.toLowerCase();
    return europeanLangs.some(l => lang.startsWith(l));
}

// 3. Sprawdzenie IP (najdokładniejsze)
async function checkIP() {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        return EUROPE.includes(data.country);
    } catch {
        return null; // fallback
    }
}

// Główna funkcja - eksportowana
export async function enforceEuropeOnly() {
    console.log('🌍 Sprawdzanie geolokalizacji...');
    
    // Szybkie sprawdzenia lokalne
    if (checkTimezone()) {
        console.log('✅ Przepuszczono: strefa czasowa Europa');
        return;
    }
    
    if (checkLanguage()) {
        console.log('✅ Przepuszczono: język europejski');
        return;
    }

    // Dokładne sprawdzenie IP
    const ipCheck = await checkIP();

    if (ipCheck === true) {
        console.log('✅ Przepuszczono: IP z Europy');
        return;
    }
    
    if (ipCheck === false) {
        console.log('❌ Zablokowano: IP spoza Europy');
        blockAccess("Wykryto kraj spoza Europy (IP)");
        return;
    }

    // Jeśli API nie zadziałało — blokujemy ostrożnościowo
    console.log('❌ Zablokowano: nie udało się potwierdzić lokalizacji');
    blockAccess("Nie udało się potwierdzić lokalizacji");
}
