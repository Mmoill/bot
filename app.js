// Token arrives once in the #t= fragment, is moved to localStorage, and the fragment is wiped.
(function(){
  const m = location.hash.match(/[#&]t=([^&]+)/);
  if (m) { localStorage.setItem('desk_t', decodeURIComponent(m[1])); history.replaceState(null,'',location.pathname); }
})();
const TOKEN = () => localStorage.getItem('desk_t') || '';
async function api(path, opts={}) {
  const r = await fetch(path, {...opts, headers:{...(opts.headers||{}), 'Authorization':'Bearer '+TOKEN(), 'Content-Type':'application/json'}});
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
const $ = id => document.getElementById(id);
const show = (el, on) => el && el.classList.toggle('hidden', !on);

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x===b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab===b.dataset.go));
  $('title').textContent = b.textContent;
});

async function loadHome() {
  show($('home-loading'), true); show($('home-error'), false); show($('home-body'), false); show($('home-empty'), false);
  try {
    const s = await api('/api/state');
    $('mode').textContent = s.mode; $('mode').className = 'badge ' + (s.mode==='LIVE'?'live':'paper');
    $('balance').textContent = s.balance==null ? '–' : '$'+s.balance.toFixed(2);
    $('profile').href = s.profile_url; $('signup').href = s.signup_url;
    $('positions').textContent = s.open_positions.length ? '' : 'None open';
    $('agents-grid').innerHTML = Object.entries(s.agents).map(([n,a]) =>
      `<div class="card"><div class="label">${n}</div><div>${a.status}</div></div>`).join('');
    show($('home-body'), true);
  } catch(e) { show($('home-error'), true); }
  finally { show($('home-loading'), false); }
}
async function loadActivity() {
  try {
    const a = await api('/api/activity');
    $('activity-list').innerHTML = a.items.map(i => `<li class="${i.kind==='kill'?'kill':''}">${i.title} <span class="label">${i.detail||''}</span></li>`).join('');
    show($('activity-empty'), !a.items.length);
  } catch(e) {}
}
document.querySelectorAll('.retry').forEach(b => b.onclick = loadHome);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
loadHome(); loadActivity();
