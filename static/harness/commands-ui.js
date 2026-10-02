(() => {
  const runtime=document.currentScript?.__owvNativeRuntime || window.owvNativeHarness;
  if(runtime?.disposed)return;
  const mounts=new WeakMap();
  function mount(f) {
    const d=f.contentDocument, chat=new URL(f.src,location.origin).pathname.match(/^\/c\/([^/?#]+)/)?.[1];
    const previous=d&&mounts.get(d);
    if(previous&&previous.chat!==chat){previous.dispose();mounts.delete(d);}
    if(!d||!chat||d.documentElement.dataset.commandsBridge)return;
    const lifecycle=new AbortController(),options={capture:true,signal:lifecycle.signal};
    d.documentElement.dataset.commandsBridge='2';
    const menu=d.createElement('div');
    menu.setAttribute('role','listbox'); menu.setAttribute('aria-label','Commandes du CLI');
    menu.className='rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:text-white';
    menu.style.cssText='display:none;position:fixed;z-index:9999;max-height:260px;overflow:auto;width:360px;max-width:calc(100vw - 16px)';
    d.body.append(menu);
    let serial=0, field, items=[], selected=0;
    const hide=()=>{serial++;menu.style.display='none';delete menu.dataset.cliCommandsOpen;};
    const place=()=>{if(!menu.isConnected)d.body.append(menu);const r=field.getBoundingClientRect(),w=d.defaultView;menu.style.display='block';menu.dataset.cliCommandsOpen='1';menu.style.left=Math.max(8,Math.min(r.left,w.innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,r.top-menu.offsetHeight-8)+'px';};
    const choose=i=>{if(!items[i])return;field.focus();d.execCommand('selectAll',false);d.execCommand('insertText',false,'/'+items[i].name+' ');hide();};
    const highlight=()=>Array.from(menu.children).forEach((b,i)=>{b.setAttribute('aria-selected',String(i===selected));b.style.background=i===selected?'rgba(128,128,128,.18)':'';});
    d.addEventListener('input',async e=>{
      field=e.target.closest?.('#chat-input');const query=(field?.innerText||'').trim();
      if(!field||!/^\/[^\s]*$/.test(query)){hide();return;}
      const bridge=window.owvHarnessSession,h=bridge?.harness(chat);
      if(!bridge||h==='owv'){hide();return;}
      const request=++serial;items=[];menu.textContent='Chargement des commandes…';place();
      try {
        const sid=await bridge.ensure(chat,h);
        const response=await fetch('/cockpit-sessions/v1/sessions/'+encodeURIComponent(sid)+'/commands',{credentials:'include',headers:localStorage.token?{authorization:'Bearer '+localStorage.token}:{}});
        if(!response.ok)throw Error('Commandes indisponibles');
        const data=await response.json();if(request!==serial)return;
        items=(data.commands||[]).filter(x=>x.name.toLowerCase().includes(query.slice(1).toLowerCase()));selected=0;
        menu.replaceChildren(...items.map((x,i)=>{const b=d.createElement('button');b.type='button';b.setAttribute('role','option');b.className='flex w-full rounded-lg px-3 py-2 text-left text-sm';b.textContent='/'+x.name+(x.description?' — '+x.description:'');b.onmousedown=e=>e.preventDefault();b.onclick=()=>choose(i);return b;}));
        if(!items.length)menu.textContent='Aucune commande annoncée par cette session.';
        highlight();place();
      }catch(e){if(request===serial){menu.textContent='Impossible de charger les commandes. Réessaie /.';place();}}
    },options);
    d.addEventListener('keydown',e=>{if(!menu.dataset.cliCommandsOpen||e.target.closest?.('#chat-input')!==field)return;
      if(['Escape','ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();
        if(e.key==='Escape')hide();else if(e.key==='Enter'||e.key==='Tab')choose(selected);else if(items.length){selected=(selected+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;highlight();}}
    },options);
    d.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!e.target.closest?.('#chat-input'))hide();},options);
    mounts.set(d,{chat,dispose(){serial++;lifecycle.abort();menu.remove();delete d.documentElement.dataset.commandsBridge;}});
  }
  const tick=()=>(runtime?[runtime.frame]:document.querySelectorAll('#panes iframe')).forEach(f=>{try{mount(f)}catch{}});
  const timer=setInterval(tick,500);
  tick();
  if(runtime)runtime.disposeCommands=()=>{clearInterval(timer);mounts.get(document)?.dispose();};
})();
