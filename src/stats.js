export function summarize(rows){
 const profit=(status,odds,stake)=>status==='won'?stake*(odds-1):status==='lost'?-stake:0;
 function group(items){
  const settled=items.filter(x=>x.settlement.status!=='pending'),decided=settled.filter(x=>x.settlement.status!=='void');
  const real=settled.filter(x=>x.bet&&Number.isFinite(x.bet.stake)&&Number.isFinite(x.bet.odds));
  const sim=settled.filter(x=>x.oddsVerified&&Number.isFinite(x.odds));
  const stake=real.reduce((s,x)=>s+x.bet.stake,0),net=real.reduce((s,x)=>s+profit(x.settlement.status,x.bet.odds,x.bet.stake),0);
  return {n:items.length,settled:settled.length,won:decided.filter(x=>x.settlement.status==='won').length,decided:decided.length,realN:real.length,stake,profit:net,roi:stake?net/stake:null,simulationN:sim.length,simulationProfit:sim.reduce((s,x)=>s+profit(x.settlement.status,x.odds,1),0),warning:decided.length<30?'Muestra pequeña: no concluir cambios de estrategia':'Revisar sesgos y correlaciones antes de concluir'};
 }
 const by=key=>Object.entries(Object.groupBy(rows,key)).map(([label,items])=>({label,...group(items)}));
 return {total:group(rows),market:by(x=>x.market),league:by(x=>x.match.league),odds:by(x=>!x.oddsVerified?'No verificada':x.odds<1.4?'<1,40':x.odds<1.8?'1,40–1,79':x.odds<2.2?'1,80–2,19':'≥2,20'),period:by(x=>x.period),month:by(x=>x.createdAt.slice(0,7))};
}
