// Canvas chart stubs: line (balance/PnL), candles (Coin screen), dashed exit line (Risk trailing stop).
const Chart = {
  _ctx(c){const r=window.devicePixelRatio||1;const w=c.clientWidth,h=c.clientHeight||c.height;c.width=w*r;c.height=h*r;const x=c.getContext('2d');x.scale(r,r);return [x,w,h];},
  line(canvas, pts, color='#30d158'){
    const [x,w,h]=this._ctx(canvas); if(!pts||pts.length<2) return;
    const mn=Math.min(...pts),mx=Math.max(...pts),sp=(mx-mn)||1;
    x.strokeStyle=color;x.lineWidth=2;x.beginPath();
    pts.forEach((v,i)=>{const px=i/(pts.length-1)*w,py=h-(v-mn)/sp*(h-8)-4;i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();
  },
  candles(canvas, ohlc){ /* TODO: candles from db.prices */ this._ctx(canvas); },
  exitLine(canvas, y, label='Risk trailing stop'){
    const [x,w]=this._ctx(canvas); x.setLineDash([6,4]); x.strokeStyle='#ff9f0a';
    x.beginPath(); x.moveTo(0,y); x.lineTo(w,y); x.stroke(); x.setLineDash([]);
    x.fillStyle='#ff9f0a'; x.font='11px -apple-system'; x.fillText(label,4,y-4);
  }
};
window.Chart = Chart;
