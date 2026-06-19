// export.js – eksport PNG, JSON; import JSON; URL hash

// ── JSON Export ──────────────────────────────────────────
export function exportJSON(state) {
  const data = JSON.stringify({ cards: state.cards, pins: state.pins, threads: state.threads }, null, 2);
  const blob  = new Blob([data], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `tablica-${dateStamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON Import ──────────────────────────────────────────
export function importJSON(onLoad) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.cards && data.pins && data.threads) {
          onLoad(data);
        } else {
          alert('Nieprawidłowy format pliku.');
        }
      } catch {
        alert('Błąd parsowania JSON.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── PNG Export (dom-to-image fallback via canvas) ────────
export async function exportPNG(boardEl, threadSvg) {
  // Używamy html2canvas załadowanego dynamicznie
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => { script.onload = resolve; });
  }
  try {
    const canvas = await window.html2canvas(boardEl, {
      useCORS: true,
      backgroundColor: '#C9894E',
      scale: 1.5,
      logging: false,
    });
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `tablica-${dateStamp()}.png`;
    a.click();
  } catch (e) {
    alert('Eksport PNG nieudany: ' + e.message);
  }
}

// ── URL Hash ─────────────────────────────────────────────
export function saveToHash(state) {
  try {
    const compact = {
      c: state.cards.map(c => ({ i:c.id, t:c.type, x:Math.round(c.x), y:Math.round(c.y), a:c.angle?.toFixed(1), d:c.data })),
      p: state.pins.map(p => ({ i:p.id, x:Math.round(p.x), y:Math.round(p.y), c:p.color, ci:p.cardId })),
      th: state.threads.map(t => ({ i:t.id, f:t.fromPin, t2:t.toPin, c:t.color, s:t.striped, c2:t.stripeColor2, l:t.label, w:t.width })),
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    // Chunk aby uniknąć RangeError przy spread >65536 elementów
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const encoded = btoa(binary);
    history.replaceState(null, '', '#' + encoded);
  } catch {
    // Zbyt duże – ignoruj
  }
}

export function loadFromHash() {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const bytes = atob(hash);
    const arr = new Uint8Array([...bytes].map(c => c.charCodeAt(0)));
    const raw = JSON.parse(new TextDecoder().decode(arr));
    return {
      cards:   raw.c.map(c => ({ id:c.i, type:c.t, x:c.x, y:c.y, angle:parseFloat(c.a||0), data:c.d })),
      pins:    raw.p.map(p => ({ id:p.i, x:p.x, y:p.y, color:p.c, cardId:p.ci })),
      threads: raw.th.map(t => ({ id:t.i, fromPin:t.f, toPin:t.t2, color:t.c, striped:t.s, stripeColor2:t.c2, label:t.l, width:t.w })),
    };
  } catch {
    return null;
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
}
