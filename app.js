// Token (#t=) and Plan B data path (#d=) arrive once in the fragment, move to localStorage,
// and are wiped from the URL. #tab=<name> and #coin=<mint> are kept for deep links.
(function(){
  const h = location.hash, t = h.match(/[#&]t=([^&]+)/), d = h.match(/[#&]d=([^&]+)/);
  if (t) localStorage.setItem('desk_t', decodeURIComponent(t[1]));
  if (d) localStorage.setItem('desk_d', decodeURIComponent(d[1]));
  if (t || d) {
    const keep = h.replace(/^#/, '').split('&').filter(p => !/^(t|d)=/.test(p)).join('&');
    history.replaceState(null, '', location.pathname + location.search + (keep ? '#' + keep : ''));
  }
})();
const TOKEN = () => localStorage.getItem('desk_t') || '';
const DATA = () => localStorage.getItem('desk_d') || '';
// Plan B (static host): /api/x -> d/{DATA}/x.json, /api/coin/M -> d/{DATA}/coin/M.json (read-only)
const PLAN_B = {'/api/state':'state.json','/api/activity':'activity.json','/api/chart':'chart.json',
                '/api/positions':'positions.json','/api/agents':'agents.json','/api/audits':'audits.json',
                '/api/settings':'settings.json'};
async function api(path, opts={}) {
  if (DATA() && (!opts.method || opts.method==='GET')) {
    const f = PLAN_B[path] || (path.startsWith('/api/coin/') ? 'coin/'+path.slice(10)+'.json' : null);
    if (f) { const r = await fetch('d/'+DATA()+'/'+f+'?_='+Date.now(), {cache:'no-store'});
             if (!r.ok) throw new Error(r.status); return r.json(); }
  }
  const r = await fetch(path, {...opts, headers:{...(opts.headers||{}), 'Authorization':'Bearer '+TOKEN(), 'Content-Type':'application/json'}});
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const $ = id => document.getElementById(id);
const show = (el, on) => el && el.classList.toggle('hidden', !on);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v==null ? '–' : (v<0?'-':'')+'$'+Math.abs(v).toFixed(2);
const sgn = v => v==null ? '' : (v>=0?'pos':'neg');
const ago = ts => { if(!ts) return ''; const s=(Date.now()-Date.parse(ts))/1000;
  return s<60?Math.round(s)+'s ago':s<3600?Math.round(s/60)+'m ago':Math.round(s/3600)+'h ago'; };
const short = m => m ? m.slice(0,4)+'…'+m.slice(-4) : '';
const coinLink = (m, label) => `<a href="#coin=${encodeURIComponent(m)}" data-coin="${esc(m)}">${esc(label||short(m))}</a>`;
let STATE = null, CURRENT_COIN = localStorage.getItem('desk_coin') || '';

async function guarded(name, fn) {
  show($(name+'-loading'), true); show($(name+'-error'), false); show($(name+'-empty'), false);
  try { await fn(); } catch(e) { show($(name+'-error'), true); ['body','grid','list'].forEach(k=>show($(name+'-'+k),false)); }
  finally { show($(name+'-loading'), false); }
}
async function getState(){ STATE = await api('/api/state'); $('mode').textContent = STATE.mode;
  $('mode').className = 'badge ' + (STATE.mode==='LIVE'?'live':'paper'); return STATE; }

const loadHome = () => guarded('home', async () => {
  const [s, ch, ps] = await Promise.all([getState(), api('/api/chart'), api('/api/positions')]);
  $('balance').textContent = money(s.balance); $('bal-mode').textContent = '· '+s.mode;
  const pts = (ch.points||[]).filter(p => p.balance!=null);
  const start = pts.length ? pts[0].balance : null, d = (start!=null && s.balance!=null) ? s.balance-start : null;
  $('bal-delta').innerHTML = pts.length>1 ? `<span class="${sgn(d)}">${d>=0?'+':''}${money(d)}</span> since start · ${pts.length-1} trade${pts.length>2?'s':''}` : '';
  show($('home-body'), true);
  show($('chart-empty'), pts.length<2); show($('pnl-chart'), pts.length>=2);
  if (pts.length>=2) Chart.line($('pnl-chart'), pts.map(p=>p.balance), d>=0?'#30d158':'#ff453a');
  $('positions').innerHTML = s.open_positions.length ? s.open_positions.map(p => {
      const pct = p.last_price&&p.entry_price ? 100*(p.last_price/p.entry_price-1) : null;
      return `<li class="row"><span>${coinLink(p.mint,p.name)} <span class="tag">${esc(p.mode)}</span></span>
        <span>${money(p.size_usd)} <span class="${sgn(pct)}">${pct==null?'':(pct>=0?'+':'')+pct.toFixed(1)+'%'}</span></span></li>`;}).join('')
    : '<li class="label">None open</li>';
  const c = s.counts||{};
  $('counts').innerHTML = [['pools','Pools'],['passed_scanner','Passed scan'],['audited','Audited'],['rejected','Rejected'],['scored','Scored'],['trades','Trades']]
    .map(([k,l]) => `<div>${c[k]??0}<span>${l}</span></div>`).join('');
  const cl = (ps.closed||[]).slice(0,5);
  $('closed').innerHTML = cl.length ? cl.map(p => `<li class="row"><span>${coinLink(p.mint,p.name)} <span class="tag">${esc(p.exit_reason||'')}</span></span>
      <span class="${sgn(p.pnl_usd)}">${money(p.pnl_usd)} (${p.pct>=0?'+':''}${(p.pct??0).toFixed(1)}%)</span></li>`).join('')
    : '<li class="label">No closed trades yet</li>';
});

const loadAgents = () => guarded('agents', async () => {
  const [s, a] = await Promise.all([getState(), api('/api/activity')]);
  const ag = s.agents||{}, any = Object.values(ag).some(x => x.ts);
  show($('agents-empty'), !any);
  $('agents-grid').innerHTML = any ? '<div class="grid">' + Object.entries(ag).map(([n,x]) =>
    `<div class="card agent"><div class="label">${esc(n)}</div><div class="st ${x.paused?'neg':''}">${esc(x.paused?'paused':x.status)}</div>
     <div class="label">${ago(x.ts)}</div></div>`).join('') + '</div>' : '';
  const items = (a.items||[]).slice(0,25);
  show($('activity-card'), items.length>0);
  $('activity-list').innerHTML = items.map(i => `<li class="${i.kind==='kill'?'kill':''}"><div class="row"><span>${i.mint?coinLink(i.mint,i.title):esc(i.title)}</span><span class="tag">${esc(i.agent)}</span></div>
     <span class="label">${esc(i.detail||'')} ${esc(i.value||'')} · ${ago(i.ts)}</span></li>`).join('');
});

const loadAuditor = () => guarded('auditor', async () => {
  const r = await api('/api/audits'), au = r.audits||[];
  show($('auditor-empty'), !au.length); show($('auditor-list'), true);
  $('auditor-list').innerHTML = au.map(a => `<div class="card"><div class="row"><b>${coinLink(a.mint, a.name||short(a.mint))}</b>
      <span class="${a.passed?'pos':'neg'}">${a.passed?'PASS':'RED'} · ${a.layers_checked}/8</span></div>
      <div class="label">${esc(a.reason||'')} · ${ago(a.ts)}</div>
      ${(a.layers||[]).map(l => `<div class="layer"><span><span class="dot ${l.pass==null?'':l.pass?'ok':'bad'}"></span>${l.n}. ${esc(l.name)}</span><span class="label">${esc(l.value??'')}</span></div>`).join('')}
    </div>`).join('');
});

const loadCoin = () => guarded('coin', async () => {
  if (!CURRENT_COIN) { show($('coin-empty'), true); show($('coin-body'), false); return; }
  const c = await api('/api/coin/'+encodeURIComponent(CURRENT_COIN));
  const info = c.coin||{}, sc = (c.scan||[])[0], an = (c.analysis||[])[0], pr = (c.prices||[]).filter(p=>p.price_usd);
  const last = pr.length ? pr[pr.length-1].price_usd : null, first = pr.length ? pr[0].price_usd : null;
  const ch = last&&first ? 100*(last/first-1) : null;
  $('coin-body').innerHTML = `<div class="card"><div class="row"><b>${esc(info.name||short(CURRENT_COIN))} ${info.symbol?'<span class="tag">$'+esc(info.symbol)+'</span>':''}</b>
      <span class="tag">${esc(info.state||'')}</span></div><div class="mono">${esc(CURRENT_COIN)}</div>
      <div class="big">${last==null?'–':'$'+Number(last).toPrecision(4)}</div>
      <div class="label"><span class="${sgn(ch)}">${ch==null?'':(ch>=0?'+':'')+ch.toFixed(1)+'%'}</span> · ${pr.length} price points</div>
      <canvas id="coin-chart" height="140"></canvas>${pr.length<2?'<div class="state empty">Not enough price points yet</div>':''}</div>
    <a class="btn" href="${esc(c.link)}" target="_blank" rel="noopener">Open on FOMO</a>
    ${sc?`<div class="card"><div class="label">Scanner</div><div class="row"><span>${esc(sc.verdict)}</span><span class="label">${esc(sc.reason||'')}</span></div></div>`:''}
    ${(c.audit||[]).length?`<div class="card"><div class="label">Auditor</div>${c.audit.slice(-8).map(l=>`<div class="layer"><span><span class="dot ${l.pass==null?'':l.pass?'ok':'bad'}"></span>${l.n}. ${esc(l.name)}</span><span class="label">${esc(l.value??'')}</span></div>`).join('')}</div>`:''}
    ${an?`<div class="card"><div class="label">Analyst · ${esc(an.model||'')}</div><div class="stats">
      <div>${an.score??'–'}<span>score</span></div><div>${an.alive_6h??'–'}<span>alive 6h</span></div><div>${an.organic??'–'}<span>organic</span></div>
      <div>${an.flush??'–'}<span>flush</span></div><div>${an.chase??'–'}<span>chase</span></div></div></div>`:''}
    ${(c.positions||[]).map(p=>`<div class="card"><div class="label">Position · ${esc(p.mode)} · ${esc(p.status)}</div><div class="row">
      <span>${money(p.size_usd)} @ ${Number(p.entry_price).toPrecision(4)}</span><span class="${sgn(p.pnl_usd)}">${p.pnl_usd==null?'':money(p.pnl_usd)} ${esc(p.exit_reason||'')}</span></div></div>`).join('')}`;
  show($('coin-body'), true);
  if (pr.length>=2) Chart.line($('coin-chart'), pr.map(p=>p.price_usd), ch>=0?'#30d158':'#ff453a');
});

const loadAccount = () => guarded('account', async () => {
  const [s, st] = await Promise.all([getState(), api('/api/settings').catch(() => ({settings:{}}))]);
  $('profile').href = s.profile_url; $('signup').href = s.signup_url;
  $('acct-desk').innerHTML = `<div class="row"><span>Mode</span><span>${esc(s.mode)}</span></div>
    <div class="row"><span>Analyst</span><span>${esc(s.analyst_mode)}</span></div>
    <div class="row"><span>Stop / trail</span><span>${s.risk.stop_pct}% / ${s.risk.trail_pct}%</span></div>
    <div class="row"><span>Updated</span><span class="label">${ago(s.updated)}</span></div>`;
  const e = Object.entries(st.settings||{});
  $('settings-ro').textContent = DATA() ? '· read-only (change with Telegram “set …”)' : '';
  show($('settings-empty'), !e.length);
  $('settings-list').innerHTML = e.map(([k,v]) => `<li class="row"><span class="label">${esc(k)}</span><span>${esc(v.value)}</span></li>`).join('');
  show($('account-body'), true);
});

const LOADERS = {home: loadHome, agents: loadAgents, auditor: loadAuditor, coin: loadCoin, account: loadAccount};
let TAB = 'home';
function go(tab) {
  TAB = LOADERS[tab] ? tab : 'home';
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.go===TAB));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab===TAB));
  $('title').textContent = TAB[0].toUpperCase()+TAB.slice(1);
  show($('back'), TAB==='coin' && history.length>1);
  LOADERS[TAB]();
}
function route() {
  const h = location.hash, cm = h.match(/[#&]coin=([^&]+)/), tm = h.match(/[#&]tab=([^&]+)/);
  if (cm) { CURRENT_COIN = decodeURIComponent(cm[1]); localStorage.setItem('desk_coin', CURRENT_COIN); return go('coin'); }
  go(tm ? tm[1] : TAB);
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { location.hash = 'tab='+b.dataset.go; });
document.querySelectorAll('.retry').forEach(b => b.onclick = () => LOADERS[TAB]());
$('back').onclick = () => history.back();
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
route();
setInterval(() => { if (TAB!=='account') LOADERS[TAB](); }, 15000);
