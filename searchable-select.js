/* Search long lists while the original select keeps its value and events. */
'use strict';
window.atlasSelect=(()=>{
 const controls=new WeakMap(),scopes=new WeakSet();let serial=0,opened=null;
 const fold=v=>String(v).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\p{P}\p{S}]/gu,'');
 const make=(tag,cls,value='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=value;return n;};
 function build(select){
  const uid='select-picker-'+(++serial),host=make('div','map-combo searchable-select'),button=make('button','map-select'),value=make('span','map-select-value'),menu=make('div','map-menu searchable-menu'),box=make('div','search-box'),input=document.createElement('input'),list=make('div','map-menu-list'),empty=make('p','map-menu-empty','No match');
  const labels=[...(select.labels||[])],label=labels[0]||select.closest('label'),title=select.getAttribute('aria-label')||[...(label?.childNodes||[])].filter(n=>!n.contains?.(select)).map(n=>n.textContent).join(' ').trim()||'Options';
  const originalHidden=select.hidden,labelTargets=labels.map(l=>[l,l.htmlFor]),restores=[];
  let rows=[],groups=[],shown=[],active=null,enabled=false;
  button.type='button';button.id=uid;button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',uid+'-list');button.append(value);
  button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg>');
  menu.id=uid+'-menu';menu.hidden=true;menu.setAttribute('popover','manual');
  input.type='search';input.placeholder='Search…';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','Search '+title);input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',uid+'-list');
  list.id=uid+'-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',title);empty.setAttribute('role','status');
  const glass=make('span','','⌕');glass.setAttribute('aria-hidden','true');box.append(glass,input);menu.append(box,list,empty);host.append(button,menu);select.after(host);
  function setActive(row,scroll=true){active?.el.classList.remove('active');active=row;for(const el of [button,input])if(row)el.setAttribute('aria-activedescendant',row.el.id);else el.removeAttribute('aria-activedescendant');if(row){row.el.classList.add('active');if(scroll)row.el.scrollIntoView({block:'nearest'});}}
  function filter(){const words=fold(input.value).split(/\s+/).filter(Boolean);shown=[];
   for(const r of rows){const hit=!r.option.hidden&&words.every(w=>r.key.includes(w));r.el.hidden=!hit;if(hit&&!r.disabled)shown.push(r);}
   for(const g of groups)g.el.hidden=!rows.some(r=>r.group===g&&!r.el.hidden);
   empty.hidden=rows.some(r=>!r.el.hidden);setActive((!words.length&&shown.find(r=>r.option.selected))||shown[0]||null,false);
  }
  function position(){if(menu.hidden)return;const rect=button.getBoundingClientRect(),viewport=window.visualViewport,leftEdge=viewport?.offsetLeft||0,topEdge=viewport?.offsetTop||0,width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight,pad=8;
   const roomBelow=topEdge+height-pad-rect.bottom-6,roomAbove=rect.top-topEdge-pad-6,above=roomBelow<180&&roomAbove>roomBelow,room=Math.max(0,Math.min(height-pad*2,above?roomAbove:roomBelow)),w=Math.min(Math.max(rect.width,250),width-pad*2);
   menu.style.width=w+'px';menu.style.left=Math.max(leftEdge+pad,Math.min(rect.left,leftEdge+width-pad-w))+'px';menu.style.maxHeight=room+'px';
   list.style.maxHeight=Math.max(0,Math.min(340,room-64))+'px';const menuHeight=menu.getBoundingClientRect().height;menu.style.top=Math.max(topEdge+pad,Math.min(above?rect.top-6-menuHeight:rect.bottom+6,topEdge+height-pad-menuHeight))+'px';
  }
  function outside(e){if(!host.contains(e.target))close(false);}
  function scrolled(e){if(!menu.contains(e.target))position();}
  function close(refocus=false){if(menu.hidden)return;dialogWatch?.disconnect();if(menu.hidePopover&&menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;host.classList.remove('open');button.setAttribute('aria-expanded','false');input.setAttribute('aria-expanded','false');setActive(null,false);document.removeEventListener('pointerdown',outside);document.removeEventListener('scroll',scrolled,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);if(opened===api)opened=null;if(refocus)button.focus({preventScroll:true});}
  function open(){refresh();if(!enabled||select.disabled||!menu.hidden)return;opened?.close();opened=api;menu.hidden=false;host.classList.add('open');button.setAttribute('aria-expanded','true');input.setAttribute('aria-expanded','true');input.value='';filter();menu.showPopover?.();position();setActive(active);input.focus({preventScroll:true});if(dialog)dialogWatch.observe(dialog,{attributes:true,attributeFilter:['open']});document.addEventListener('pointerdown',outside);document.addEventListener('scroll',scrolled,true);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);}
  function choose(row){if(!row||row.disabled)return;select.value=row.option.value;close(true);select.dispatchEvent(new Event('change',{bubbles:true}));select.dispatchEvent(new Event('input',{bubbles:true}));}
  function move(step){if(!shown.length)return;const i=shown.indexOf(active);setActive(shown[(i+step+shown.length)%shown.length]);}
  function keys(e){const k=e.key;if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();e.stopPropagation();if(menu.hidden)open();else move(k==='ArrowDown'?1:-1);}else if(k==='Enter'&&!menu.hidden){e.preventDefault();e.stopPropagation();choose(active);}else if(k==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();close(true);}else if(k==='Tab')close();else if(e.target===button&&k.length===1&&k!==' '&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();open();input.value=k;filter();}}
  button.onclick=()=>menu.hidden?open():close();button.onkeydown=keys;input.onkeydown=keys;input.oninput=()=>{filter();position();};
  host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))close();});
  // A menu inside a field label must not activate its button again after a choice.
  menu.addEventListener('click',e=>{if(e.target!==input)e.preventDefault();});
  const dialog=select.closest('dialog'),form=select.form,dialogWatch=dialog?new MutationObserver(()=>{if(!dialog.open)close();}):null;
  const reset=()=>setTimeout(refresh,0),dialogClose=()=>close(),invalid=e=>{if(enabled){e.preventDefault();button.focus();}};
  select.addEventListener('change',refresh);select.addEventListener('input',refresh);select.addEventListener('invalid',invalid);dialog?.addEventListener('close',dialogClose);form?.addEventListener('reset',reset);
  function refresh(){
   const options=[...select.querySelectorAll('option')];enabled=options.length>10&&!select.multiple&&!select.classList.contains('choice-select');host.hidden=!enabled;select.hidden=enabled||originalHidden;
   for(const [label,target] of labelTargets)label.htmlFor=enabled?button.id:target;
   button.disabled=select.disabled;button.setAttribute('aria-required',String(select.required));value.textContent=options.find(o=>o.selected)?.label||options.find(o=>o.value===select.value)?.label||options.find(o=>o.value===select.value)?.textContent||'';button.setAttribute('aria-label',title+': '+value.textContent);
   if(!enabled||select.disabled)close();
   rows=[];groups=[];list.replaceChildren();
   function option(o,parent,group=null){const el=make('div','map-option',o.label||o.textContent),disabled=o.disabled||group?.source.disabled||false,row={el,option:o,group,disabled,key:fold(o.label||o.textContent)};el.id=uid+'-option-'+rows.length;el.setAttribute('role','option');el.setAttribute('aria-selected',String(o.selected));el.setAttribute('aria-disabled',String(disabled));el.onmousedown=e=>e.preventDefault();el.onclick=()=>choose(row);el.onpointermove=()=>{if(!disabled)setActive(row,false);};rows.push(row);parent.append(el);}
   for(const child of select.children){if(child.tagName.toLowerCase()==='optgroup'){const el=make('div',''),heading=make('div','map-menu-group',child.label),group={el,source:child};heading.id=uid+'-group-'+groups.length;el.setAttribute('role','group');el.setAttribute('aria-labelledby',heading.id);el.append(heading);groups.push(group);for(const o of child.children)option(o,el,group);list.append(el);}else if(child.tagName.toLowerCase()==='option')option(child,list);}
   if(!menu.hidden){filter();position();}
  }
  // Native value setters do not emit events. Wrap only this select, preserving that behaviour.
  for(const key of ['value','selectedIndex']){const own=Object.getOwnPropertyDescriptor(select,key);let proto=select,descriptor;while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,key);proto=Object.getPrototypeOf(proto);}if(!descriptor?.set||own&&!own.configurable)continue;Object.defineProperty(select,key,{configurable:true,get(){return descriptor.get.call(this);},set(v){descriptor.set.call(this,v);refresh();}});restores.push(()=>{if(own)Object.defineProperty(select,key,own);else delete select[key];});}
  const focus=select.focus;select.focus=(...args)=>enabled?button.focus(...args):focus.apply(select,args);restores.push(()=>{select.focus=focus;});
  const api={host,button,input,list,menu,refresh,close,dispose(){close();select.removeEventListener('change',refresh);select.removeEventListener('input',refresh);select.removeEventListener('invalid',invalid);dialog?.removeEventListener('close',dialogClose);form?.removeEventListener('reset',reset);for(const restore of restores)restore();for(const [label,target] of labelTargets)label.htmlFor=target;select.hidden=originalHidden;host.remove();controls.delete(select);}};
  refresh();return api;
 }
 function enhance(root){
  const tracked=new Map();scopes.add(root);
  function scan(){for(const select of root.querySelectorAll('select')){let parent=select.parentElement;while(parent&&parent!==root&&!scopes.has(parent))parent=parent.parentElement;if(parent!==root||controls.has(select))continue;if(select.querySelectorAll('option').length>10&&!select.multiple&&!select.classList.contains('choice-select')){const control=build(select);controls.set(select,control);tracked.set(select,control);}}}
  scan();
  const observer=new MutationObserver(mutations=>{const changed=new Set();let added=false;for(const m of mutations){const select=(m.target.nodeType===1?m.target:m.target.parentElement)?.closest('select');if(select)changed.add(select);if(m.type==='childList'&&[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches('select')||n.querySelector('select'))))added=true;}if(added||changed.size)scan();for(const select of changed)tracked.get(select)?.refresh();for(const [select,control] of tracked)if(!root.contains(select)){control.dispose();tracked.delete(select);}});
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','multiple','required','label','value','selected']});
  return {refresh(){scan();for(const control of tracked.values())control.refresh();},dispose(){observer.disconnect();for(const control of tracked.values())control.dispose();tracked.clear();scopes.delete(root);}};
 }
 return {enhance};
})();
