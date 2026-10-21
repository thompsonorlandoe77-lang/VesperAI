const http = require('http');
const fs = require('fs');
const path = require('path');
const { research } = require('./research');

const PORT = process.env.PORT || 3000;
const KB_FILE = path.join(__dirname, 'knowledge.json');
const TTL = 6 * 3600e3;
const PUB = path.join(__dirname, 'public');

let kb = {};
try { kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf8')); } catch {}
const saveKb = () => fs.writeFile(KB_FILE, JSON.stringify(kb, null, 1), () => {});

async function ask(question) {
  const key = question.toLowerCase().trim();
  const hit = kb[key];
  if (hit && Date.now() - hit.at < TTL) return { ...hit.result, cached: true };
  const result = await research(question);
  if (result.verified) { kb[key] = { at: Date.now(), result }; saveKb(); }
  return result;
}

// Background learning: re-research stale topics so stored knowledge stays verified and fresh.
setInterval(async () => {
  const stale = Object.keys(kb).filter(k => Date.now() - kb[k].at > TTL).slice(0, 3);
  for (const k of stale) { try { const r = await research(k); if (r.verified) kb[k] = { at: Date.now(), result: r }; } catch {} }
  if (stale.length) saveKb();
}, 30 * 60e3).unref();

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/ask') {
    let body = ''; for await (const c of req) body += c;
    try {
      const { question } = JSON.parse(body);
      if (!question || question.length > 1000) throw new Error('Invalid question');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(await ask(question)));
    } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  const rel = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0];
  const f = path.join(PUB, path.normalize(rel));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('VesperAI running on http://localhost:' + PORT));
