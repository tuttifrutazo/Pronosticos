export const LEAGUES={'esp.1':'LaLiga','fra.1':'Ligue 1','ger.1':'Bundesliga','ita.1':'Serie A','bel.1':'Pro League','por.1':'Primeira Liga','irl.1':'Premier Division','eng.2':'Championship','uefa.champions':'Champions League'};
export const now=()=>new Date().toISOString();
export function madridDate(value=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
export async function getJSON(url){ const res=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error(`ESPN HTTP ${res.status}`);return res.json(); }
export function normalize(event,league){
 const c=event.competitions?.[0]; if(!c)throw Error('ESPN: encuentro sin competición');
 const h=c.competitors?.find(t=>t.homeAway==='home'),a=c.competitors?.find(t=>t.homeAway==='away');
 if(!h?.id||!a?.id||!event.id||!event.date)throw Error('ESPN: identidad incompleta');
 const status=event.status||c.status;
 const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 const regulationPeriods=status?.period===2||(status?.period==null&&h.linescores?.length===2&&a.linescores?.length===2);
 return {id:`espn:${league}:${event.id}`,providerId:String(event.id),league,season:String(event.season?.slug||event.season?.name||event.season?.year||''),kickoff:event.date,homeId:String(h.id),awayId:String(a.id),home:h.team.displayName,away:a.team.displayName,status:status?.type?.name||'UNKNOWN',final90:status?.type?.completed===true&&status?.type?.name==='STATUS_FULL_TIME'&&regulationPeriods&&!c.wasSuspended,homeScore:numeric(h.score),awayScore:numeric(a.score),statistics:{home:h.statistics||[],away:a.statistics||[]},observedAt:now()};
}
export async function scoreboard(league,date,fetcher=getJSON){
 if(!LEAGUES[league]||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Liga o fecha no válida');
 const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date.replaceAll('-','')}`;
 const raw=await fetcher(url);if(!Array.isArray(raw.events))throw Error('Respuesta ESPN sin eventos');
 return {url,raw,matches:raw.events.map(e=>normalize(e,league))};
}
export async function eventResult(match,fetcher=getJSON){
 const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${match.league}/summary?event=${match.providerId}`;
 const raw=await fetcher(url);const h=raw.header;
 if(!h||String(h.id)!==match.providerId)throw Error('ESPN: ID de encuentro no coincide');
 const c=h.competitions?.[0];
 const result=normalize({id:h.id,date:c?.date,season:h.season,competitions:h.competitions,status:c?.status},match.league);
 if(result.homeId!==match.homeId||result.awayId!==match.awayId)throw Error('ESPN: equipos no coinciden; revisión manual necesaria');
 result.season=match.season;
 result.statistics={home:raw.boxscore?.teams?.find(t=>String(t.team?.id)===match.homeId)?.statistics||[],away:raw.boxscore?.teams?.find(t=>String(t.team?.id)===match.awayId)?.statistics||[]};
 return {url,raw,match:result};
}
