import {readFileSync} from 'node:fs';
const file=process.argv[2];if(!file)throw Error('Uso: npm run save -- archivo.json');
const body=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const base=process.env.APP_URL||'http://127.0.0.1:3210';
const response=await fetch(base+'/api/predictions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const result=await response.json();if(!response.ok)throw Error(result.error);
const rows=await fetch(base+'/api/predictions').then(r=>r.json());
for(const p of Array.isArray(body)?body:[body])if(!rows.some(r=>r.id===p.id))throw Error(`No se pudo verificar ${p.id}`);
console.log(JSON.stringify({...result,verified:true},null,2));
