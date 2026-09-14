import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {settle} from './rules.js';
import {LEAGUES,now,eventResult} from './provider.js';
export function validate(p){
 for(const k of ['id','createdAt','market','selection','period','bookmaker','reasoning']) if(typeof p[k]!=='string'||!p[k].trim())throw Error(`Falta ${k}`);
 if(!p.match||!LEAGUES[p.match.league])throw Error('Falta encuentro o liga soportada');
 for(const k of ['id','providerId','homeId','awayId','home','away','season','kickoff'])if(typeof p.match[k]!=='string'||!p.match[k])throw Error(`Falta match.${k}`);
 if(!/^\d+$/.test(p.match.providerId)||p.match.id!==`espn:${p.match.league}:${p.match.providerId}`||p.match.homeId===p.match.awayId)throw Error('Identidad del encuentro inválida');
 if(!Number.isFinite(Date.parse(p.createdAt))||!Number.isFinite(Date.parse(p.match.kickoff)))throw Error('Fechas inválidas');
 if(!['winner','double_chance','goals','corners','cards'].includes(p.market))throw Error('Mercado no válido');
 if(p.market==='winner'&&!['1','X','2'].includes(p.selection)||p.market==='double_chance'&&!['1X','X2','12'].includes(p.selection)||['goals','corners','cards'].includes(p.market)&&!['over','under'].includes(p.selection))throw Error('Selección inválida');
 if(['goals','corners','cards'].includes(p.market)&&(!Number.isFinite(p.line)||p.line<0))throw Error('Falta línea numérica');
 if(p.odds!=null&&(!Number.isFinite(p.odds)||p.odds<=1))throw Error('Cuota inválida');
 if(typeof p.oddsVerified!=='boolean')throw Error('Falta estado de verificación');
 if(!Array.isArray(p.sources)||!p.sources.length||p.sources.some(s=>!s.url||!/^https?:\/\//.test(s.url)||!Number.isFinite(Date.parse(s.accessedAt))))throw Error('Fuentes requieren URL y accessedAt');
 if(p.oddsVerified&&(!Number.isFinite(p.odds)||p.odds<1.4||!Number.isFinite(Date.parse(p.oddsCheckedAt))||!p.oddsSource))throw Error('Cuota verificada requiere cuota ≥1,40, fecha y fuente');
 if(!p.oddsVerified&&(!Number.isFinite(p.minOdds)||p.minOdds<1.4))throw Error('Candidata requiere minOdds ≥1,40');
 if(p.probability!=null&&(!Number.isFinite(p.probability)||p.probability<=0||p.probability>=1||!p.probabilityMethod))throw Error('Probabilidad requiere método y valor entre 0 y 1');
 if(!p.availableData||typeof p.availableData!=='object')throw Error('Faltan datos disponibles al emitir');
 if(p.bet)throw Error('Confirma las apuestas por la ruta específica');
 return p;
}
export class Store{
 constructor(file=resolve('data/pronosticos.sqlite')){this.file=file;mkdirSync(dirname(file),{recursive:true});this.db=new DatabaseSync(file);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS predictions(id TEXT PRIMARY KEY, original TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settlements(prediction_id TEXT PRIMARY KEY REFERENCES predictions(id),body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS bets(prediction_id TEXT PRIMARY KEY REFERENCES predictions(id),body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL,kind TEXT NOT NULL,entity_id TEXT,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,at TEXT NOT NULL,match_id TEXT,url TEXT,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS criteria(id TEXT PRIMARY KEY,body TEXT NOT NULL);
 PRAGMA user_version=1;`);this.running=false;}
 audit(kind,id,body){this.db.prepare('INSERT INTO audit(at,kind,entity_id,body) VALUES(?,?,?,?)').run(now(),kind,id,JSON.stringify(body));}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 insert(p){validate(p);const existing=this.db.prepare('SELECT original FROM predictions WHERE id=?').get(p.id);if(existing){if(existing.original!==JSON.stringify(p))throw Error(`ID ${p.id} ya existe con otro contenido; usa una corrección`);return false;}
 const m=this.db.prepare('SELECT body FROM matches WHERE id=?').get(p.match.id);if(m){const old=JSON.parse(m.body);if(old.homeId!==p.match.homeId||old.awayId!==p.match.awayId)throw Error('Conflicto de identidad de equipos');}
 this.db.prepare('INSERT INTO predictions VALUES(?,?)').run(p.id,JSON.stringify(p));
 this.db.prepare('INSERT OR IGNORE INTO matches VALUES(?,?)').run(p.match.id,JSON.stringify({...p.match,final90:false,status:'UNVERIFIED',homeScore:null,awayScore:null}));
 this.db.prepare('INSERT INTO settlements VALUES(?,?)').run(p.id,JSON.stringify({status:'pending',reason:'Esperando verificación de resultado'}));this.audit('prediction_created',p.id,p);return true;}
 importPredictions(items){if(!Array.isArray(items)||items.length>2000)throw Error('Se espera array de hasta 2000 pronósticos');return this.transaction(()=>({inserted:items.reduce((n,p)=>n+Number(this.insert(p)),0),received:items.length}));}
 rows(){return this.db.prepare('SELECT p.original,m.body AS match,s.body AS settlement,b.body AS bet FROM predictions p JOIN matches m ON m.id=json_extract(p.original,\'$.match.id\') JOIN settlements s ON s.prediction_id=p.id LEFT JOIN bets b ON b.prediction_id=p.id').all().map(r=>({...JSON.parse(r.original),match:JSON.parse(r.match),originalMatch:JSON.parse(r.original).match,settlement:JSON.parse(r.settlement),bet:r.bet?JSON.parse(r.bet):null})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 history(id){return this.db.prepare('SELECT * FROM audit WHERE entity_id=? ORDER BY id').all(id).map(x=>({...x,body:JSON.parse(x.body)}));}
 confirm(id,b){if(!this.db.prepare('SELECT id FROM predictions WHERE id=?').get(id))throw Error('Pronóstico no encontrado');if(b.confirmed!==true)throw Error('Se requiere confirmación explícita');for(const k of ['stake','odds'])if(b[k]!=null&&(!Number.isFinite(b[k])||b[k]<=(k==='odds'?1:0)))throw Error(`${k} inválido`);if(b.currency&&b.currency!=='EUR')throw Error('Esta versión utiliza EUR');const value={stake:b.stake??null,odds:b.odds??null,currency:'EUR',confirmedAt:now()};return this.transaction(()=>{this.db.prepare('INSERT INTO bets VALUES(?,?) ON CONFLICT(prediction_id) DO UPDATE SET body=excluded.body').run(id,JSON.stringify(value));this.audit('bet_confirmed',id,value);return value;});}
 correction(id,c){if(!c.reason||!c.note||!this.db.prepare('SELECT id FROM predictions WHERE id=?').get(id))throw Error('Se requiere ID existente, motivo y nota');this.audit('correction',id,{...c,at:now()});return {saved:true};}
 criterion(c){if(!c.reason||!c.change||!Array.isArray(c.evidenceIds))throw Error('Falta cambio, justificación o muestra');const v={...c,id:randomUUID(),at:now()};this.db.prepare('INSERT INTO criteria VALUES(?,?)').run(v.id,JSON.stringify(v));return v;}
 metadata(){const r=this.db.prepare("SELECT body FROM meta WHERE key='refresh'").get();return {...(r?JSON.parse(r.body):{}),running:this.running};}
 async refresh(fetcher){if(this.running)return;this.running=true;const report={startedAt:now(),errors:[],updated:0};try{
 // Recheck every recorded event: corrections to final results must remain auditable.
 for(const row of this.db.prepare('SELECT body FROM matches').all()){
 const old=JSON.parse(row.body);try{const result=await eventResult(old,fetcher);this.transaction(()=>{
 this.db.prepare('INSERT INTO snapshots(at,match_id,url,body) VALUES(?,?,?,?)').run(now(),old.id,result.url,JSON.stringify(result.raw));
 this.db.prepare('UPDATE matches SET body=? WHERE id=?').run(JSON.stringify(result.match),old.id);
 for(const p of this.rows().filter(p=>p.match.id===old.id)){const s=settle(p,result.match);if(JSON.stringify(p.settlement)!==JSON.stringify(s)){this.db.prepare('UPDATE settlements SET body=? WHERE prediction_id=?').run(JSON.stringify(s),p.id);this.audit('settlement',p.id,{before:p.settlement,after:s,source:result.url,observedAt:result.match.observedAt});}}
 });report.updated++;}catch(e){report.errors.push({match:old.id,message:e.message});}
 }
 }finally{report.finishedAt=now();this.db.prepare("INSERT INTO meta VALUES('refresh',?) ON CONFLICT(key) DO UPDATE SET body=excluded.body").run(JSON.stringify(report));this.running=false;}return report;}
 export(){return {format:'pronosticos-v1',exportedAt:now(),predictions:this.db.prepare('SELECT original FROM predictions').all().map(r=>JSON.parse(r.original)),tables:Object.fromEntries(['matches','settlements','bets','audit','snapshots','criteria','meta'].map(t=>[t,this.db.prepare(`SELECT * FROM ${t}`).all()]))};}
 restore(bundle){if(bundle.format!=='pronosticos-v1'||!bundle.tables)throw Error('Formato de copia no válido');if(this.rows().length)throw Error('Restaura copias completas en una base vacía para evitar sobrescribir el historial; importa un array para añadir pronósticos');
 return this.transaction(()=>{for(const p of bundle.predictions)this.insert(p);for(const t of ['matches','settlements','bets','audit','snapshots','criteria','meta']){const rows=bundle.tables[t];if(!Array.isArray(rows))throw Error(`Falta tabla ${t}`);this.db.exec(`DELETE FROM ${t}`);for(const r of rows){const allowed={matches:['id','body'],settlements:['prediction_id','body'],bets:['prediction_id','body'],audit:['id','at','kind','entity_id','body'],snapshots:['id','at','match_id','url','body'],criteria:['id','body'],meta:['key','body']}[t];this.db.prepare(`INSERT INTO ${t} (${allowed.join(',')}) VALUES (${allowed.map(()=>'?').join(',')})`).run(...allowed.map(k=>r[k]??null));}}this.audit('restore',null,{exportedAt:bundle.exportedAt});return {restored:bundle.predictions.length};});}
 backup(){const folder=resolve(dirname(this.file),'backups');mkdirSync(folder,{recursive:true});const file=resolve(folder,`pronosticos-${Date.now()}-${randomUUID().slice(0,6)}.sqlite`);this.db.prepare('VACUUM INTO ?').run(file);return file;}
 close(){this.db.close();}
}
