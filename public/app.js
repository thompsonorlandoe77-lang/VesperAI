const chat = document.getElementById('chat'), q = document.getElementById('q'), f = document.getElementById('f');
const hero = document.getElementById('hero'), newChat = document.getElementById('newchat'), send = f.querySelector('.send');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };
const cites = t => esc(t).replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');

document.querySelectorAll('.sug button').forEach(b => b.onclick = () => { q.value = b.textContent; f.requestSubmit(); });
document.getElementById('att').onclick = () => alert('Image analysis is not supported yet. Describe the image in text or paste a link.');
newChat.onclick = () => { chat.innerHTML = ''; hero.hidden = false; newChat.hidden = true; scrollTo(0, 0); };

const STEPS = ['Searching the live web', 'Reading five sources', 'Cross-checking claims'];

f.onsubmit = async e => {
  e.preventDefault();
  const text = q.value.trim(); if (!text) return;
  q.value = ''; send.disabled = true; hero.hidden = true; newChat.hidden = false;
  chat.insertAdjacentHTML('beforeend', `<div class="turn user"><span>${esc(text)}</span></div>`);
  const turn = document.createElement('div'); turn.className = 'turn bot';
  turn.innerHTML = '<span class="orb"></span><div class="body"><div class="steps"><span class="dots"><span></span><span></span><span></span></span><span class="st"></span></div></div>';
  chat.append(turn); turn.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const st = turn.querySelector('.st'); let i = 0; st.textContent = STEPS[0];
  const timer = setInterval(() => { st.textContent = STEPS[Math.min(++i, STEPS.length - 1)]; }, 2500);
  const body = turn.querySelector('.body');
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text }) });
    const r = await res.json(); if (r.error) throw new Error(r.error);
    body.innerHTML = `<div class="badge ${r.verified ? '' : 'no'}">${r.verified ? '✓ Verified · ' + esc(r.confidence) : '! Unverified'}</div>
      <div class="answer">${cites(r.answer)}</div>
      <div class="srcs">${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}"><i>${s.n}</i><span>${esc(host(s.url))}</span></a>`).join('')}</div>`;
  } catch (err) {
    body.innerHTML = `<div class="badge no">! Error</div><div class="answer">Something went wrong: ${esc(err.message)}. Please try again.</div>`;
  } finally { clearInterval(timer); send.disabled = false; q.focus(); }
};
