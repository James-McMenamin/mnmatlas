/* Marker shapes and the small map drawing bar. */
'use strict';
window.atlasShapeUI=(()=>{
 let active=null;
 const xy=p=>locationOf({x:p[0],y:p[1]}),copy=v=>v?structuredClone(v):null;
 function pane(){const p=map.getPane('marker-shapes')||map.createPane('marker-shapes');p.style.zIndex='430';return 'marker-shapes';}
 function render(m,group,{old=false,solid=false,click=null,state=null}={}){
  if(!m.shape)return null;const s=m.shape,color=m.color||categories[m.category]?.[1]||'#a04438',options={pane:pane(),color,weight:old?1:2,opacity:old?.28:.9,fillColor:color,fillOpacity:old?.04:.18,dashArray:solid?null:'6 4',smoothFactor:0,bubblingMouseEvents:false,interactive:!old};
  const pts=s.points.map(xy),layer=s.kind==='area'?(s.form==='circle'?L.circle(pts[0],{...options,radius:s.r/Math.pow(2,config.coordinateZoom)}):L.polygon(pts,options)):L.polyline(s.loop?[...pts,pts[0]]:pts,options);
  group.addLayer(layer);if(!old){bindMarkerTooltip(layer,m,state);if(click)layer.on('click',click);}
  if(s.kind==='path'&&!old){const ps=s.loop?[...s.points,s.points[0]]:s.points;for(let i=1;i<ps.length;i+=Math.max(1,Math.ceil((ps.length-1)/24))){const a=ps[i-1],b=ps[i],at=[(a[0]+b[0])/2,(a[1]+b[1])/2],face=text('span','›','shape-arrow');face.style.color=color;face.style.transform='rotate('+Math.atan2(b[1]-a[1],b[0]-a[0])+'rad)';group.addLayer(L.marker(xy(at),{pane:pane(),icon:L.divIcon({className:'shape-arrow-anchor',html:face,iconSize:[12,12],iconAnchor:[6,6]}),interactive:false,keyboard:false}));}}
  return layer;
 }
 // Pure drawing transitions are shared with the tests. Clear and Undo never affect the saved marker.
 function drawing(kind,form='outline',initial=null){let value=copy(initial)||{kind,...(kind==='area'?{form}: {loop:false}),points:[]};return {get value(){return copy(value);},clear(){value.points=[];delete value.r;},undo(){value.points.pop();},point(p){if(value.points.length>=100)throw Error('Use at most 100 points. Undo a point or finish this shape.');if(!value.points.some(q=>q[0]===p[0]&&q[1]===p[1]))value.points.push(p.slice());},set(s){value=copy(s);},finish(c){return window.atlasShapes.validate(value,c);}};}
 function edit({kind,shape=null,onDone,onCancel=()=>{},host=null}){
  active?.cancel();const dialog=host?.closest('dialog'),bar=text('section','','shape-draw-bar'),group=L.layerGroup().addTo(map),model=drawing(kind,shape?.form||'rect',shape);let selected=-1,start=null,longTimer=null,skipClick=false,disposed=false;
  const wasDragging=map.dragging.enabled(),wasDouble=map.doubleClickZoom.enabled();map.doubleClickZoom.disable();map.closePopup();map.getContainer().classList.add('drawing-shape');
  let suspended=!!dialog?.open;if(suspended){dialog.atlasShapeClosing=(dialog.atlasShapeClosing||0)+1;dialog.close();dialog.classList.add('shape-suspended');}
  const title=text('strong',kind==='area'?'Draw area':'Draw path'),hint=text('small','','shape-draw-hint'),forms=fillSelect(document.createElement('select'),[['Rectangle','rect'],['Circle','circle'],['Outline','outline']]);forms.setAttribute('aria-label','Area form');forms.value=model.value.form||'rect';forms.hidden=kind!=='area';
  const loop=document.createElement('input');loop.type='checkbox';loop.checked=shape?.loop===true;const loops=text('label','','community-check');loops.append(loop,text('span','Loops back'));loops.hidden=kind!=='path';
  function clean(){if(disposed)return;disposed=true;clearTimeout(longTimer);map.off('click',tap);map.off('dblclick',double);map.off('mousedown',down);map.off('mousemove',move);map.off('mouseup',up);container.removeEventListener('touchstart',touchStart);container.removeEventListener('touchmove',touchMove);container.removeEventListener('touchend',touchEnd);document.removeEventListener('keydown',key,true);container.classList.remove('drawing-shape');group.remove();bar.remove();if(wasDragging)map.dragging.enable();if(wasDouble)map.doubleClickZoom.enable();if(suspended){dialog.classList.remove('shape-suspended');dialog.showModal();}active=null;}
  function cancel(){clean();onCancel();}
  function done(){try{const s=model.finish(config);clean();onDone(s);}catch(e){hint.textContent=e.message;}}
  const remove=button('Remove point',()=>{const s=model.value;if(selected<0||s.form==='circle')return;s.points.splice(selected,1);if(s.form==='rect')s.form='outline';model.set(s);selected=-1;paint();});
  bar.append(title,forms,loops,button('Undo point',()=>{model.undo();selected=-1;paint();}),button('Clear',()=>{model.clear();selected=-1;paint();}),remove,button('Done',done,'primary'),button('Cancel',cancel),hint);$('map-frame').append(bar);
  forms.onchange=()=>{skipClick=false;model.set({kind:'area',form:forms.value,points:[]});selected=-1;paint();};loop.onchange=()=>{const s=model.value;s.loop=loop.checked;model.set(s);paint();};
  function handle(p,i,plus=false){const face=text('span',plus?'+':'','shape-handle'+(i===selected?' selected':''));const pin=L.marker(xy(p),{icon:L.divIcon({className:'shape-handle-anchor',html:face,iconSize:[18,18],iconAnchor:[9,9]}),draggable:!plus,keyboard:true,alt:plus?'Insert shape point':model.value.form==='circle'?(i===0?'Circle centre':'Circle radius'):'Shape point '+(i+1),zIndexOffset:2000}).addTo(group);
   pin.on('click',e=>{L.DomEvent.stopPropagation(e);if(plus){const s=model.value;if(s.points.length>=100){hint.textContent='Use at most 100 points.';return;}const q=p.map(Math.round);if(s.points.some(p=>p[0]===q[0]&&p[1]===q[1])){hint.textContent='This segment is too short to insert a point.';return;}s.points.splice(i+1,0,q);if(s.form==='rect')s.form='outline';model.set(s);selected=i+1;paint();}else if(i===0&&model.value.form!=='circle'&&model.value.points.length>=(kind==='path'?2:3))done();else{selected=i;remove.disabled=model.value.form==='circle';face.classList.add('selected');}});
   const deletion=()=>{selected=i;remove.onclick();};pin.on('contextmenu',e=>{L.DomEvent.preventDefault(e);deletion();});pin.on('add',()=>{const el=pin.getElement();el?.addEventListener('pointerdown',()=>{if(!plus)longTimer=setTimeout(deletion,650);});for(const name of ['pointerup','pointercancel','pointermove'])el?.addEventListener(name,()=>clearTimeout(longTimer));});
   pin.on('dragend',()=>{clearTimeout(longTimer);const s=model.value,q=pixelsOf(pin.getLatLng());if(s.form==='circle'){if(i===0)s.points[0]=q;else s.r=Math.max(1,Math.round(Math.hypot(q[0]-s.points[0][0],q[1]-s.points[0][1])));}else if(s.form==='rect'){const opposite=s.points[(i+2)%4];s.points=rectangle(q,opposite);}else s.points[i]=q;let issue=null;try{window.atlasShapes.validate(s,config);model.set(s);}catch(e){issue=e.message;}paint();if(issue)hint.textContent=issue;});
  }
  function paint(){group.clearLayers();const s=model.value;remove.disabled=selected<0||s.form==='circle';hint.textContent=s.form==='rect'?'Drag two opposite corners.':s.form==='circle'?'Drag from the centre to set the radius.':'Tap points; Done, double-click or the first point finishes.';forms.value=s.form||forms.value;
   if(s.points.length){try{window.atlasShapes.validate(s,config);render({shape:s,category:'Personal',id:'shape-draft',name:'Shape'},group,{solid:true});}catch{if(s.points.length>1)group.addLayer(L.polyline(s.points.map(xy),{pane:pane(),color:'#a04438',dashArray:'4 4',interactive:false}));}
    s.points.forEach((p,i)=>handle(p,i));if(s.form==='circle'&&s.r)handle([s.points[0][0]+s.r,s.points[0][1]],1);else if(s.form!=='circle'){const n=s.points.length,closed=s.kind==='area'||s.loop;for(let i=0;i<n-(closed?0:1);i++){const a=s.points[i],b=s.points[(i+1)%n];if(n>1)handle([(a[0]+b[0])/2,(a[1]+b[1])/2],i,true);}}}
  }
  const rectangle=(a,b)=>[[Math.min(a[0],b[0]),Math.min(a[1],b[1])],[Math.max(a[0],b[0]),Math.min(a[1],b[1])],[Math.max(a[0],b[0]),Math.max(a[1],b[1])],[Math.min(a[0],b[0]),Math.max(a[1],b[1])]];
  const validPoint=p=>bounded(...p,config.minZoom);
  function tap(e){if(skipClick&&Date.now()<skipClick){skipClick=false;return;}skipClick=false;const s=model.value;if(['rect','circle'].includes(s.form))return;const p=pixelsOf(e.latlng);if(!validPoint(p)){hint.textContent='Keep points inside the map.';return;}try{model.point(p);paint();}catch(e){hint.textContent=e.message;}}
  function down(e){if(!['rect','circle'].includes(model.value.form)||e.originalEvent?.target?.closest?.('.shape-handle-anchor,.shape-draw-bar'))return;start=pixelsOf(e.latlng);if(!validPoint(start)){start=null;return;}map.dragging.disable();}
  function move(e){if(!start)return;const p=pixelsOf(e.latlng);if(!validPoint(p))return;const s=model.value;s.points=s.form==='rect'?rectangle(start,p):[start];if(s.form==='circle')s.r=Math.round(Math.hypot(p[0]-start[0],p[1]-start[1]));model.set(s);paint();}
  function up(e){if(!start)return;move(e);start=null;skipClick=Date.now()+300;if(wasDragging)map.dragging.enable();}
  function double(e){L.DomEvent.preventDefault(e);done();}
  function key(e){if(!['Escape','Enter'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();e.key==='Escape'?cancel():done();}
  const container=map.getContainer(),touchEvent=e=>({latlng:map.mouseEventToLatLng(e.touches[0]||e.changedTouches[0]),originalEvent:e});
  function touchStart(e){if(['rect','circle'].includes(model.value.form)&&!e.target.closest('.shape-handle-anchor,.shape-draw-bar')){e.preventDefault();down(touchEvent(e));}}
  function touchMove(e){if(start){e.preventDefault();move(touchEvent(e));}}
  function touchEnd(e){if(start){e.preventDefault();up(touchEvent(e));}}
  container.addEventListener('touchstart',touchStart,{passive:false});container.addEventListener('touchmove',touchMove,{passive:false});container.addEventListener('touchend',touchEnd,{passive:false});
  map.on('click',tap);map.on('dblclick',double);map.on('mousedown',down);map.on('mousemove',move);map.on('mouseup',up);document.addEventListener('keydown',key,true);L.DomEvent.disableClickPropagation(bar);L.DomEvent.disableScrollPropagation(bar);paint();active={cancel};return active;
 }
 return {render,edit,drawing,get active(){return !!active;},cancel:()=>active?.cancel()};
})();
