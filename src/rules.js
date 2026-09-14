// Rule documentation: docs/SETTLEMENT.md. Analysis workflow: docs/ANALYSIS.md.
export const RULES = {
 'bet365-90-v1': {markets:['winner','double_chance'], source:'https://help.bet365.com/s/en/sportsrules/soccer/result-event-half-time', checked:'2026-09-14', scope:'90 minutes plus stoppage, no extra time'},
 'bet365-goals-v1': {markets:['goals'], source:'https://help.bet365.com/s/en-ca/sportsrules/soccer/goal-line', checked:'2026-09-14', scope:'Integer or half goal lines; integer push'}
};
export function settle(p, match) {
 const pending = reason => ({status:'pending',reason});
 const rule=RULES[p.ruleId];
 if(!rule || !rule.markets.includes(p.market)) return pending('Reglas del mercado pendientes de verificación');
 if(p.period!=='90m') return pending('Periodo no soportado automáticamente');
 if(p.bookmaker?.toLowerCase()!=='bet365') return pending('Reglas de esta casa pendientes de verificación');
 if(!match?.final90) return pending('Falta resultado definitivo de 90 minutos; aplazados, suspendidos y prórroga requieren verificación');
 if(!Number.isInteger(match.homeScore)||!Number.isInteger(match.awayScore)) return pending('Falta marcador válido');
 const outcome=match.homeScore>match.awayScore?'1':match.homeScore<match.awayScore?'2':'X';
 let win;
 if(p.market==='winner') win=p.selection===outcome;
 else if(p.market==='double_chance') win=p.selection.includes(outcome);
 else {
  if(!Number.isFinite(p.line)||p.line<0||!Number.isInteger(p.line*2)) return pending('Línea fraccionada no soportada');
  const total=match.homeScore+match.awayScore;
  if(total===p.line) return {status:'void',reason:'Total igual a línea entera: devolución',ruleId:p.ruleId};
  win=p.selection==='over'?total>p.line:total<p.line;
 }
 return {status:win?'won':'lost',reason:`90 minutos: ${match.homeScore}–${match.awayScore}`,ruleId:p.ruleId};
}
