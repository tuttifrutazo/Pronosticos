import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {settle} from '../src/rules.js';
import {normalize} from '../src/provider.js';
import {summarize} from '../src/stats.js';
const match={id:'espn:esp.1:100',providerId:'100',homeId:'1',awayId:'2',home:'Equipo prueba A',away:'Equipo prueba B',league:'esp.1',season:'2026-27',kickoff:'2026-09-13T12:00:00Z'};
const prediction=(extra={})=>({id:'test-only-1',createdAt:'2026-09-12T12:00:00Z',match,market:'goals',selection:'over',line:2,period:'90m',bookmaker:'Bet365',ruleId:'bet365-goals-v1',odds:null,oddsVerified:false,minOdds:1.4,reasoning:'SOLO PRUEBA: no es recomendación',sources:[{url:'https://example.com/test',accessedAt:'2026-09-12T12:00:00Z'}],availableData:{test:true},...extra});
const result={final90:true,homeScore:2,awayScore:1};
const fixture=(score='2',status='STATUS_FULL_TIME')=>({header:{id:'100',season:{year:2026},competitions:[{date:match.kickoff,status:{type:{name:status,completed:status==='STATUS_FULL_TIME'}},competitors:[{id:'1',homeAway:'home',team:{displayName:match.home},score,linescores:[{},{}]},{id:'2',homeAway:'away',team:{displayName:match.away},score:'1',linescores:[{},{}]}]}]},boxscore:{teams:[]}});
const tempStore=()=>new Store(join(mkdtempSync(join(tmpdir(),'pronosticos-test-')),'test.sqlite'));
test('goles, devoluciones, ganador y doble oportunidad',()=>{
 assert.equal(settle(prediction(),result).status,'won');
 assert.equal(settle(prediction({selection:'under'}),result).status,'lost');
 assert.equal(settle(prediction({line:3}),result).status,'void');
 assert.equal(settle(prediction({line:3.5,selection:'under'}),result).status,'won');
 for(const selection of ['1','X','2'])assert.equal(settle(prediction({market:'winner',selection,ruleId:'bet365-90-v1'}),result).status,selection==='1'?'won':'lost');
 for(const selection of ['1X','X2','12'])assert.equal(settle(prediction({market:'double_chance',selection,ruleId:'bet365-90-v1'}),result).status,selection==='X2'?'lost':'won');
});
test('datos ausentes, tarjetas, córners, reglas y periodos desconocidos no liquidan',()=>{
 for(const p of [{market:'cards'},{market:'corners'},{period:'1h'},{ruleId:'unknown'},{line:2.25},{bookmaker:'Otra'}])assert.equal(settle(prediction(p),result).status,'pending');
 assert.equal(settle(prediction(),{...result,final90:false}).status,'pending');
 assert.equal(settle(prediction(),{...result,homeScore:null}).status,'pending');
});
test('persistencia, idempotencia, correcciones y restauración íntegra',async()=>{
 let s=tempStore();const file=s.file;const p=prediction();assert.equal(s.importPredictions([p]).inserted,1);assert.equal(s.importPredictions([p]).inserted,0);s.close();s=new Store(file);assert.equal(s.rows().length,1);
 await s.refresh(async()=>fixture());assert.equal(s.rows()[0].settlement.status,'won');const count=s.history(p.id).length;
 await s.refresh(async()=>fixture());assert.equal(s.rows().length,1);assert.equal(s.history(p.id).length,count);
 await s.refresh(async()=>fixture('0'));assert.equal(s.rows()[0].settlement.status,'lost');assert.equal(s.history(p.id).length,count+1);
 assert.equal(JSON.parse(s.db.prepare('SELECT original FROM predictions').get().original).reasoning,p.reasoning);
 s.confirm(p.id,{confirmed:true,stake:10,odds:1.7});s.correction(p.id,{reason:'Prueba',note:'Nota sin alterar'});
 const b=s.backup(),copy=new Store(b);assert.equal(copy.rows().length,1);copy.close();
 const restored=tempStore();restored.restore(s.export());assert.deepEqual(restored.rows(),s.rows());assert.ok(restored.history(p.id).some(x=>x.kind==='correction'));restored.close();s.close();
});
test('fallo de conexión o identidad conserva resultados anteriores',async()=>{
 const s=tempStore();s.importPredictions([prediction()]);await s.refresh(async()=>fixture());const before=s.rows();
 await s.refresh(async()=>{throw Error('Sin conexión');});assert.deepEqual(s.rows(),before);assert.match(s.metadata().errors[0].message,/Sin conexión/);
 await s.refresh(async()=>({...fixture(),header:{...fixture().header,id:'999'}}));assert.deepEqual(s.rows(),before);s.close();
});
test('importación atómica, confirmación explícita y cuotas no inventadas',()=>{
 const s=tempStore();assert.throws(()=>s.importPredictions([prediction(),prediction({id:'bad',oddsVerified:true,odds:1.8})]));assert.equal(s.rows().length,0);
 s.importPredictions([prediction()]);assert.throws(()=>s.confirm('test-only-1',{stake:10,odds:1.8}));assert.throws(()=>s.importPredictions([prediction({reasoning:'cambiado'})]));s.close();
});
test('rentabilidad solo en apuestas con importe y cuota conocidos',()=>{
 const rows=[{...prediction(),settlement:{status:'won'},bet:null},{...prediction(),settlement:{status:'lost'},bet:{stake:10,odds:2}},{...prediction(),settlement:{status:'won'},bet:{stake:null,odds:2}}];
 const t=summarize(rows).total;assert.equal(t.realN,1);assert.equal(t.profit,-10);assert.equal(t.roi,-1);assert.equal(t.simulationN,0);
});
test('aplazados y prórroga no son final90',()=>{
 const f=fixture();for(const status of ['STATUS_POSTPONED','STATUS_SUSPENDED','STATUS_FINAL_AET']){const c=f.header.competitions[0];assert.equal(normalize({id:'100',date:match.kickoff,competitions:[c],status:{period:3,type:{name:status,completed:true}}},'esp.1').final90,false);}
});
