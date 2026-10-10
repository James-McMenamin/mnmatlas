/* Queue and notice rules stay independent of the map and account service. */
'use strict';
window.atlasReview=(()=>{
 const target=r=>r.kind==='new-marker'?'community-'+r.id:r.target_id;
 const targetKind=r=>r.kind.endsWith('label')||['label','exit'].includes(r.payload?.noteType)?'label':'marker';
 const point=r=>r.kind.startsWith('move-')?r.payload?.to:[r.payload?.x??r.payload?.from?.x,r.payload?.y??r.payload?.from?.y];
 function group(rows,{locate=point,mapName=id=>id,floorOrder=()=>0,spot=true}={}){
  const buckets=new Map();
  for(const r of rows){const level=r.payload?.level||r.level||'',key=r.map+'\0'+level;if(!buckets.has(key))buckets.set(key,{map:r.map,level,rows:[]});buckets.get(key).rows.push(r);}
  const groups=[];
  for(const b of [...buckets.values()].sort((a,b)=>mapName(a.map).localeCompare(mapName(b.map))||a.map.localeCompare(b.map)||floorOrder(a.map,a.level)-floorOrder(b.map,b.level)||a.level.localeCompare(b.level))){
   const sorted=b.rows.sort((a,b)=>Number(a.id)-Number(b.id)),parents=sorted.map((_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
   // Connected neighbours make one place cluster, even when a third row bridges two spots.
   if(spot)for(let i=0;i<sorted.length;i++)for(let j=0;j<i;j++){const a=locate(sorted[i]),c=locate(sorted[j]);if(target(sorted[i])&&targetKind(sorted[i])===targetKind(sorted[j])&&target(sorted[i])===target(sorted[j])||a?.every(Number.isFinite)&&c?.every(Number.isFinite)&&Math.hypot(a[0]-c[0],a[1]-c[1])<=15)parents[find(i)]=find(j);}
   const clusters=new Map();for(let i=0;i<sorted.length;i++){const key=spot?find(i):0;if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(sorted[i]);}
   for(const cluster of clusters.values())groups.push({...b,rows:cluster});
  }
  return groups;
 }
 function keyAction(e){if(e.defaultPrevented||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/^(input|textarea|select)$/i.test(e.target?.tagName)||e.target?.isContentEditable||e.target?.closest?.('[contenteditable=true],.wiki-results'))return null;return {a:'approve',s:'save',r:'reject',j:'next',k:'previous',ArrowRight:'next',ArrowLeft:'previous',Escape:'close'}[e.key.length===1?e.key.toLowerCase():e.key]||null;}
 const stamp=r=>r.updated_at||r.reviewed_at||r.created_at||'';
 const ownRows=(rows,uid)=>rows.filter(r=>uid&&r.user_id===uid).slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||Number(b.id)-Number(a.id));
 const unread=(rows,seen,key=r=>String(r.id),version=stamp)=>rows.filter(r=>seen[key(r)]!==version(r));
 const state=r=>({published:'On the map',approved:'Approved · next edition',pending:'Waiting for review',rejected:'Set aside',resolved:'Fixed'}[r.status]||'Waiting for review');
 return {group,target,targetKind,point,keyAction,stamp,ownRows,unread,state};
})();
