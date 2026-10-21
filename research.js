// VesperAI research engine: search the live web, read 5 sources, keep only cross-verified claims.
const UA = 'Mozilla/5.0 (compatible; VesperAI/1.0)';
const SOURCES_NEEDED = 5;
const STOP = new Set('a an the of and or to in on for is are was were be been it its this that with as at by from what who how when where why does do did which about latest most recent i you your can'.split(' '));

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
const words = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !STOP.has(w) && w.length > 1);

async function get(url, ms = 8000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// Search multiple engines (DuckDuckGo, Bing); no API key needed.
async function search(q) {
  const out = [];
  const add = (url, title) => {
    try {
      const u = new URL(url);
      if (/^https?:$/.test(u.protocol) && !/duckduckgo\.com|bing\.com|microsoft\.com/.test(u.host))
        out.push({ url: u.href, title: decode(title.replace(/<[^>]+>/g, '')).trim() });
    } catch {}
  };
  await Promise.allSettled([
    get('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q)).then(h => {
      for (const m of h.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const href = decode(m[1]); const t = href.match(/uddg=([^&]+)/);
        add(t ? decodeURIComponent(t[1]) : href, m[2]);
      }
    }),
    get('https://www.bing.com/search?q=' + encodeURIComponent(q)).then(h => {
      for (const m of h.matchAll(/<li class="b_algo"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) add(decode(m[1]), m[2]);
    }),
  ]);
  const seen = new Set();
  return out.filter(r => { const h = new URL(r.url).host.replace(/^www\./, ''); if (seen.has(h)) return false; seen.add(h); return true; });
}

function sentencesOf(html) {
  const text = decode(html.replace(/<(script|style|nav|header|footer|aside|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|h\d|div|br)>/gi, '. ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  return (text.match(/[A-Z0-9][^.!?]{30,300}[.!?]/g) || []).map(s => s.trim());
}

const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };

async function research(question) {
  const urlIn = question.match(/https?:\/\/\S+/);
  const q = question.replace(/https?:\/\/\S+/g, '').trim() || question;
  let results = await search(q);
  if (urlIn) results.unshift({ url: urlIn[0], title: urlIn[0] });
  results = results.slice(0, SOURCES_NEEDED + 3);
  const pages = (await Promise.allSettled(results.map(async r => ({ ...r, sentences: sentencesOf(await get(r.url)) }))))
    .filter(p => p.status === 'fulfilled' && p.value.sentences.length > 3).map(p => p.value).slice(0, SOURCES_NEEDED);

  const qw = words(q);
  const cands = [];
  pages.forEach((p, si) => p.sentences.forEach(s => {
    const w = words(s); if (w.length < 5) return;
    const rel = qw.length ? qw.filter(x => w.includes(x)).length / qw.length : 0;
    if (rel >= 0.5) cands.push({ s, w, si, rel });
  }));
  // A claim counts as verified only when similar sentences appear on 2+ distinct sources.
  for (const c of cands) {
    const sup = new Set([c.si]);
    for (const d of cands) if (d.si !== c.si && jaccard(c.w, d.w) >= 0.3) sup.add(d.si);
    c.support = [...sup];
  }
  const verified = cands.filter(c => c.support.length >= 2).sort((a, b) => b.support.length - a.support.length || b.rel - a.rel);
  const picked = [];
  for (const c of verified) if (picked.length < 3 && !picked.some(p => jaccard(p.w, c.w) > 0.5)) picked.push(c);

  const sources = pages.map((p, i) => ({ n: i + 1, title: p.title, url: p.url }));
  if (!picked.length) {
    return { verified: false, sources, answer: pages.length
      ? `I checked ${pages.length} sources but couldn't find a claim that at least two of them agree on, so I'd rather not guess. Try rephrasing or being more specific.`
      : "I couldn't reach enough web sources right now, so I can't give you a trustworthy answer. Please try again shortly." };
  }
  const cite = c => c.s + ' ' + c.support.sort().map(i => `[${i + 1}]`).join('');
  return { verified: true, answer: picked.map(cite).join(' '), sources,
    confidence: `${new Set(picked.flatMap(p => p.support)).size} of ${pages.length} sources agree` };
}

module.exports = { research };
