import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const cli='.tools/graphify/Scripts/graphify.exe';
const r=spawnSync(cli,['update','.','--no-cluster'],{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status||1);
const file='graphify-out/graph.json',g=JSON.parse(readFileSync(file,'utf8'));
const edgeKey=Array.isArray(g.edges)?'edges':'links';
// Local, deterministic document index: explicit headings and literal code-path references.
g.nodes=g.nodes.filter(n=>n._origin!=='local-document-index');g[edgeKey]=g[edgeKey].filter(e=>e._origin!=='local-document-index');
for(const path of ['README.md','docs/ANALYSIS.md','docs/SETTLEMENT.md','docs/COVERAGE.md']){
 const content=readFileSync(path,'utf8'),id='doc:'+path,label=content.split('\n').find(l=>l.startsWith('# ')).slice(2);
 g.nodes.push({id,label,file_type:'document',source_file:path,source_location:'L1',description:content,_origin:'local-document-index'});
 for(const n of g.nodes.filter(n=>n.file_type==='code'&&n.source_file&&n.source_location==='L1'))if(content.includes(n.source_file))g[edgeKey].push({source:id,target:n.id,relation:'documents',confidence:'EXTRACTED',source_file:path,weight:1,_origin:'local-document-index'});
}
writeFileSync(file,JSON.stringify(g,null,2));
writeFileSync('graphify-out/GRAPH_REPORT.md',`# Grafo local de Cuaderno\n\n${g.nodes.length} nodos y ${g[edgeKey].length} relaciones. Código extraído por Graphify AST; documentación indexada localmente desde títulos y referencias literales, sin inferencias semánticas ni servicios externos.\n\nFlujo: public/app.js → src/server.js → Store (src/store.js) → eventResult (src/provider.js) → settle (src/rules.js). SQLite conserva originales, apuestas, respuestas deportivas, liquidaciones y auditoría.\n\nConsultar graphify query "Liquidación conservadora" y graphify explain "settle". Regenerar con npm run graph después de cambios. No incluye datos del historial, secretos ni backups.\n`);
const html=spawnSync(cli,['export','html'],{stdio:'inherit',windowsHide:true});if(html.status!==0)process.exit(html.status||1);
