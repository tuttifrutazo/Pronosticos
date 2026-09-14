import http from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Store} from './store.js';
import {summarize} from './stats.js';
import {scoreboard,LEAGUES} from './provider.js';
const store=new Store(process.env.DB_PATH||resolve('data/pronosticos.sqlite'));
const port=Number(process.env.PORT||3210);
const origin=`http://127.0.0.1:${port}`;
async function body(req){let s='';for await(const part of req){s+=part;if(Buffer.byteLength(s)>20_000_000)throw Error('Archivo demasiado grande (máximo 20 MB)');}return JSON.parse(s||'{}');}
const server=http.createServer(async(req,res)=>{
 const send=(data,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
 try{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send({error:'Host no permitido'},403);
 if(req.headers.origin&&![origin,`http://localhost:${port}`].includes(req.headers.origin))return send({error:'Origen no permitido'},403);
 const u=new URL(req.url,origin),path=u.pathname;
 if(req.method==='GET'){
 if(path==='/api/health')return send({ok:true,database:store.file});
 if(path==='/api/predictions')return send(store.rows());
 if(path==='/api/stats')return send(summarize(store.rows()));
 if(path==='/api/status')return send(store.metadata());
 if(path==='/api/leagues')return send(LEAGUES);
 if(path==='/api/criteria')return send(store.db.prepare('SELECT body FROM criteria').all().map(r=>JSON.parse(r.body)));
 if(path==='/api/history')return send(store.history(u.searchParams.get('id')));
 if(path==='/api/fixtures')return send(await scoreboard(u.searchParams.get('league'),u.searchParams.get('date')));
 if(path==='/api/export'){res.setHeader('Content-Disposition','attachment; filename="pronosticos.json"');return send(store.export());}
 if(path==='/api/export.csv'){
 const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows=store.rows();res.setHeader('Content-Disposition','attachment; filename="pronosticos.csv"');
 return send('\uFEFF'+[['id','encuentro','mercado','seleccion','linea','cuota','estado','apuesta_confirmada','importe_eur','cuota_real','original_json'],...rows.map(p=>[p.id,`${p.match.home} - ${p.match.away}`,p.market,p.selection,p.line,p.odds,p.settlement.status,!!p.bet,p.bet?.stake,p.bet?.odds,store.db.prepare('SELECT original FROM predictions WHERE id=?').get(p.id).original])].map(r=>r.map(cell).join(',')).join('\r\n'),200,'text/csv');}
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
 if(files[path])return send(readFileSync(resolve('public',files[path])),200,path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
 }
 if(req.method==='POST'){
 if(!req.headers['content-type']?.startsWith('application/json'))return send({error:'Usa application/json'},415);
 if(path==='/api/refresh'){void store.refresh().catch(e=>console.error(e));return send({started:true},202);}
 const b=await body(req);
 if(path==='/api/predictions')return send(store.importPredictions(Array.isArray(b)?b:[b]),201);
 if(path==='/api/import')return send(Array.isArray(b)?store.importPredictions(b):store.restore(b));
 if(path==='/api/backup')return send({file:store.backup()});
 if(path==='/api/bets')return send(store.confirm(b.predictionId,b));
 if(path==='/api/corrections')return send(store.correction(b.predictionId,b));
 if(path==='/api/criteria')return send(store.criterion(b));
 }
 return send({error:'Ruta no encontrada'},404);
 }catch(e){send({error:e.message},400);}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Cuaderno de pronósticos: ${origin}\nSQLite: ${store.file}`);void store.refresh();});
process.on('SIGINT',()=>server.close(()=>{store.close();process.exit();}));
