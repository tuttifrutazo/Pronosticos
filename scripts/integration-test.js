import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const folder=mkdtempSync(join(tmpdir(),'pronosticos-api-test-')),port=13210,base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),DB_PATH:join(folder,'test.sqlite'),APP_URL:base};
let server;
async function start(){server=spawn(process.execPath,['src/server.js'],{env,stdio:'pipe',windowsHide:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Servidor salió '+code)));});}
async function stop(){if(!server||server.exitCode!==null)return;await new Promise(r=>{server.once('exit',r);server.kill();});}
try{
 await start();const p=JSON.parse(readFileSync('docs/prediction.example.json','utf8'));const file=join(folder,'input.json');writeFileSync(file,JSON.stringify(p));
 const save=spawnSync(process.execPath,['scripts/save.js',file],{env,encoding:'utf8',windowsHide:true});assert.equal(save.status,0,save.stderr);assert.match(save.stdout,/"verified": true/);
 let rows=await fetch(base+'/api/predictions').then(r=>r.json());assert.equal(rows.length,1);assert.equal(rows[0].bet,null);
 const again=spawnSync(process.execPath,['scripts/save.js',file],{env,encoding:'utf8',windowsHide:true});assert.equal(again.status,0);assert.match(again.stdout,/"inserted": 0/);
 const backup=await fetch(base+'/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json());assert.ok(readFileSync(backup.file).length>0);
 const malicious=await fetch(base+'/api/bets',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'});assert.equal(malicious.status,403);
 await stop();await start();rows=await fetch(base+'/api/predictions').then(r=>r.json());assert.equal(rows.length,1);assert.equal(rows[0].id,p.id);
 const exp=await fetch(base+'/api/export').then(r=>r.json());assert.equal(exp.predictions.length,1);assert.equal((await fetch(base+'/')).status,200);
 console.log('API: guardado automático verificado, reenvío sin duplicados, reinicio persistente, backup, exportación y protección de origen: OK. Base temporal: '+folder);
}finally{await stop();}
