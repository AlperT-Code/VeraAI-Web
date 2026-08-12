/* ═══════════════════════════════════════════════════════════
   VeraBlob — tkinter'daki organik blob'un canvas versiyonu.
   Durumlar: 'idle' | 'speaking' | 'listening' | 'thinking' | 'sleeping'
   ═══════════════════════════════════════════════════════════ */
class VeraBlob {
  constructor(canvas, { size = 320, base = null } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.size = size;
    this.rBase = base || size * 0.34;
    this.rCur = this.rBase;
    this.rTgt = this.rBase;
    this.state = 'idle';
    this.t0 = performance.now();

    canvas.width = size * this.dpr;
    canvas.height = size * this.dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    this.ctx.scale(this.dpr, this.dpr);

    this._raf = null;
    this._loop = this._loop.bind(this);
  }

  setState(s) { this.state = s; }

  start() { if (!this._raf) this._loop(); }
  stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }

  _loop() {
    const ctx = this.ctx;
    const S = this.size;
    const CX = S / 2, CY = S / 2;
    const t = (performance.now() - this.t0) / 1000;
    const sleeping = this.state === 'sleeping';
    const speaking = this.state === 'speaking';
    const listening = this.state === 'listening';
    const thinking = this.state === 'thinking';

    ctx.clearRect(0, 0, S, S);

    // hedef yarıçap
    if (sleeping)       this.rTgt = this.rBase * 0.78 + 4 * Math.sin(t * 0.38);
    else if (speaking)  this.rTgt = this.rBase + 18 * Math.sin(t * 8);
    else if (thinking)  this.rTgt = this.rBase + 7 * Math.sin(t * 5);
    else if (listening) this.rTgt = this.rBase + 9 * Math.sin(t * 3);
    else                this.rTgt = this.rBase + 5 * Math.sin(t * 1.3);
    this.rCur += (this.rTgt - this.rCur) * 0.15;
    const r = this.rCur;

    const n = 220;
    const outer = [], inner = [];
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n;
      let w;
      if (sleeping) {
        w = 3 * Math.sin(3 * a + t * 0.35) + 2 * Math.sin(6 * a - t * 0.25);
      } else if (speaking) {
        w = 16 * Math.sin(5 * a + t * 9) + 9 * Math.sin(9 * a - t * 7) + 5 * Math.sin(15 * a + t * 5);
      } else if (thinking) {
        w = 6 * Math.sin(6 * a + t * 4) + 4 * Math.sin(11 * a - t * 3) + 3 * Math.sin(17 * a + t * 2);
      } else if (listening) {
        w = 9 * Math.sin(4 * a + t * 3) + 5 * Math.sin(8 * a - t * 2.4) + 3 * Math.sin(13 * a + t * 1.6);
      } else {
        w = 6 * Math.sin(4 * a + t * 1.5) + 3 * Math.sin(8 * a - t * 2) + 2 * Math.sin(13 * a + t);
      }
      const rr = r + w;
      const ri = Math.max(rr - 15, 18);
      outer.push([CX + rr * Math.cos(a), CY + rr * Math.sin(a)]);
      inner.push([CX + ri * Math.cos(a), CY + ri * Math.sin(a)]);
    }

    const cols = sleeping
      ? { sh: '#E8E8E8', fill: '#CCCCCC', in: '#F2F2F2', v: '#AAAAAA' }
      : { sh: '#E0E0E0', fill: '#111111', in: '#FFFFFF', v: '#111111' };

    this._poly(outer, cols.sh, 4);      // gölge
    this._poly(outer, cols.fill, 0);    // dış siyah
    this._poly(inner, cols.in, 0);      // iç beyaz

    // ortadaki "V"
    ctx.fillStyle = cols.v;
    const fs = Math.max(22, r * 0.78);
    ctx.font = `bold ${fs}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', CX, CY + 2);

    // uyku Z'leri
    if (sleeping) this._drawZ(t, CX, CY);

    this._raf = requestAnimationFrame(this._loop);
  }

  _poly(points, color, offset) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.fillStyle = color;
    // catmull-rom benzeri yumuşatma için basitçe quadratic
    const p = points.map(([x, y]) => [x + offset, y + offset]);
    ctx.moveTo((p[0][0] + p[p.length - 1][0]) / 2, (p[0][1] + p[p.length - 1][1]) / 2);
    for (let i = 0; i < p.length; i++) {
      const cur = p[i];
      const nxt = p[(i + 1) % p.length];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawZ(t, CX, CY) {
    const ctx = this.ctx;
    const period = 4.0;
    const cfgs = [
      [CX + 78, CY - 42, 0.0, 26],
      [CX + 86, CY - 64, 1.0, 20],
      [CX + 92, CY - 86, 2.0, 15],
      [CX + 95, CY - 108, 3.0, 11],
    ];
    for (const [zx, zy, off, bsize] of cfgs) {
      const prog = ((t + off) % period) / period;
      let a = prog < 0.22 ? prog / 0.22 : 1 - (prog - 0.22) / 0.78;
      if (a < 0.05) continue;
      const x = zx + prog * 8, y = zy - prog * 34;
      const g = Math.round(210 - a * 165);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      const fsize = Math.max(7, bsize * (0.45 + 0.55 * a));
      ctx.font = `bold italic ${fsize}px Georgia, serif`;
      ctx.fillText('Z', x, y);
    }
  }
}

window.VeraBlob = VeraBlob;
