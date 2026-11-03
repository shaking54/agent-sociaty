const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = process.env.SOCIETY_DATA_FILE || path.join(__dirname, 'data', 'world.json');
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
let world = null;
try { world = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
function json(res, status, value) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
function save(value) {
  fs.mkdirSync(path.dirname(DATA_FILE), {recursive:true});
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value));
  fs.renameSync(temp, DATA_FILE);
}
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res,200,{ok:true,mode:'local-single-player',timestamp:new Date().toISOString()});
  if (url.pathname === '/api/world') {
    if (req.method === 'GET') return json(res,200,world || {revision:0, snapshot:null, history:[]});
    if (req.method !== 'PUT') return json(res,405,{error:'Method not allowed'});
    // The service is loopback-only and accepts same-origin browser writes only.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(res,403,{error:'Origin not allowed'});
    let body = ''; let tooLarge = false;
    req.on('data', chunk => { body += chunk; if (body.length > 1024*1024) { tooLarge = true; req.destroy(); } });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        const input = JSON.parse(body);
        if (!Number.isSafeInteger(input.revision) || !input.snapshot || !input.snapshot.society || !Array.isArray(input.snapshot.society.lineages) || !Array.isArray(input.snapshot.buildings) || !Array.isArray(input.events) || input.events.length > 500 || input.events.some(e => typeof e.message !== 'string' || e.message.length > 500 || !Number.isFinite(e.turn))) return json(res,400,{error:'Invalid world payload'});
        const revision = world?.revision || 0;
        if (input.revision !== revision) return json(res,409,{error:'World changed in another session',revision});
        const history = [...(world?.history || []), ...input.events.map(e => ({turn:e.turn, message:e.message, timestamp:new Date().toISOString()}))].slice(-500);
        const next = {revision:revision+1, snapshot:input.snapshot, history};
        save(next); world = next;
        return json(res,200,{revision:next.revision,history});
      } catch (error) { return json(res, error instanceof SyntaxError ? 400 : 500,{error:error instanceof SyntaxError ? 'Invalid JSON' : 'Unable to save world'}); }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Method not allowed'});
  let pathname;
  try { pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); } catch { return json(res,400,{error:'Invalid path'}); }
  const file = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return json(res,403,{error:'Forbidden'});
  fs.readFile(file,(err,content) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); return res.end('Not Found'); }
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});
server.listen(PORT,'127.0.0.1',() => console.log(`Agent Society running at http://127.0.0.1:${PORT}`));
