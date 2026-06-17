// minimap.js – miniaturka tablicy

export class Minimap {
  constructor(containerEl) {
    this.el = containerEl;
    this.canvas = document.createElement('canvas');
    this.canvas.width  = 180;
    this.canvas.height = 110;
    this.canvas.style.cssText = 'display:block;border-radius:4px;';
    this.el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.visible = true;
  }

  // Przelicz pozycję karty na minimap
  _toMini(x, y, boardW, boardH) {
    return {
      mx: 4 + (x / boardW) * (this.canvas.width - 8),
      my: 4 + (y / boardH) * (this.canvas.height - 8),
    };
  }

  update(cards, pins, threads, pan, zoom, boardW, boardH, viewW, viewH) {
    if (!this.visible) return;
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;

    // Tło – kolor korka
    ctx.fillStyle = '#C9894E';
    ctx.fillRect(0, 0, cw, ch);

    // Ramka
    ctx.strokeStyle = '#7D4E22';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cw, ch);

    const scale = cw / boardW;

    // Karty
    const TYPE_COLORS = {
      person: '#3a7bd5', unknown: '#aaa', party: '#2e7d32',
      law: '#c8a000', news: '#e63946', note: '#f9c811',
      date: '#9c27b0', group: '#ff6b35',
    };

    cards.forEach(card => {
      const mx = 4 + (card.x / boardW) * (cw - 8);
      const my = 4 + (card.y / boardH) * (ch - 8);
      ctx.fillStyle = TYPE_COLORS[card.type] || '#888';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(mx, my, 10, 7);
    });

    // Nitki
    ctx.globalAlpha = 0.55;
    const pinMap = {};
    pins.forEach(p => { pinMap[p.id] = p; });
    threads.forEach(t => {
      const from = pinMap[t.fromPin];
      const to   = pinMap[t.toPin];
      if (!from || !to) return;
      const x1 = 4 + (from.x / boardW) * (cw - 8);
      const y1 = 4 + (from.y / boardH) * (ch - 8);
      const x2 = 4 + (to.x   / boardW) * (cw - 8);
      const y2 = 4 + (to.y   / boardH) * (ch - 8);
      ctx.strokeStyle = '#cc3333';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Viewport rectangle
    ctx.globalAlpha = 1;
    const vpX = 4 + (-pan.x / zoom / boardW) * (cw - 8);
    const vpY = 4 + (-pan.y / zoom / boardH) * (ch - 8);
    const vpW = (viewW / zoom / boardW) * (cw - 8);
    const vpH = (viewH / zoom / boardH) * (ch - 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpX, vpY, vpW, vpH);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(vpX, vpY, vpW, vpH);
  }

  toggle() {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }
}
