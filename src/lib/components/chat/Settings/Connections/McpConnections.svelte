<script lang="ts">
 import { onMount } from 'svelte';
 import Spinner from '$lib/components/common/Spinner.svelte';
 import UserSettingSection from '../UserSettingSection.svelte';
 import UserSettingRow from '../UserSettingRow.svelte';
 import { mcpRequest, startMcpConsent } from '$lib/apis/ai-connections';
 let providers: any[] = [], connections: any[] = [];
 let context: any = null, loading = true, pending = false, error = '', active = true;
 let selected: any = null, tools: any[] = [], chosenTools: string[] = [], chosenApps: string[] = [], catalogFingerprint = '';
 const states: Record<string,string> = { connected:'Autorisée · appels non vérifiés', authorization_required:'Consentement requis', revoked:'Révoquée', disabled:'Désactivée' };
 const buttonClass = 'rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-100';
 async function load() {
  loading=true;error='';
  try { const c=await mcpRequest('/context');const [p,r]=await Promise.all([mcpRequest('/providers'),mcpRequest('/connections')]);if(active){if(context?.context_key!==c.context_key)selected=null;context=c;providers=p.items;connections=r.items;} }
  catch(e){if(active)error=e instanceof Error?e.message:'Connexion indisponible.';}
  finally {if(active)loading=false;}
 }
 async function action(fn:()=>Promise<void>){
  if(pending)return;pending=true;error='';
  try {const c=await mcpRequest('/context');if(c.context_key!==context?.context_key)throw new Error('Le compte a changé. Actualisez les connexions.');await fn();if(active)await load();}
  catch(e){if(active)error=e instanceof Error?e.message:'Action refusée.';}finally{if(active)pending=false;}
 }
 async function connect(provider:any){await action(async()=>{
  let c=connections.find(c=>c.provider===provider.id);
  if(!c)c=await mcpRequest('/connections','POST',{provider:provider.id,label:provider.label,apps:['owv']});
  else if(c.state==='revoked')c=await mcpRequest('/connections/'+c.id+'/reconnect','POST',{});
  else if(c.state==='disabled')c=await mcpRequest('/connections/'+c.id,'PATCH',{enabled:true});
  await startMcpConsent(c.id,context.context_key);
 });}
 async function permissions(c:any){await action(async()=>{
  const [catalog,grants]=await Promise.all([mcpRequest('/connections/'+c.id+'/tools'),mcpRequest('/connections/'+c.id+'/permissions')]);
  if(active){selected=c;tools=catalog.tools;catalogFingerprint=catalog.catalog_fingerprint;chosenTools=[...grants.tools];chosenApps=[...c.apps];}
 });}
 async function savePermissions(){await action(async()=>{
  await mcpRequest('/connections/'+selected.id+'/permissions','PUT',{tools:chosenTools,apps:chosenApps,catalog_fingerprint:catalogFingerprint});
  selected=null;
 });}
 onMount(()=>{void load();return()=>{active=false;};});
</script>
<UserSettingSection title="AI Connections · Outils MCP" className="mb-6">
 <p class="text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-500">Connectez vos outils une fois. AI Connections conserve les identifiants et contrôle leur accès dans les applications autorisées.</p>
 {#if loading}<div role="status" class="flex items-center gap-2 text-xs"><Spinner className="size-4" />Chargement…</div>
 {:else}
  {#each providers as provider (provider.id)}
   {@const c=connections.find(c=>c.provider===provider.id)}
   <UserSettingRow label={provider.label} description={c ? states[c.state] || c.state : 'Non connecté'}>
    <div class="flex flex-wrap gap-2">
     <button type="button" class={buttonClass} disabled={pending||context?.identity.org_role==='viewer'} on:click={()=>connect(provider)}>{c?.state==='connected'?'Reconnecter':'Connecter'}</button>
     {#if c && c.state!=='revoked'}<button type="button" class="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5" disabled={pending||context?.identity.org_role==='viewer'} on:click={()=>{if(confirm('Révoquer cet accès pour toutes vos applications ?'))void action(async()=>{await mcpRequest('/connections/'+c.id,'DELETE',{});});}}>Révoquer</button>{/if}
    </div>
   </UserSettingRow>
   {#if c?.state==='connected'}<button type="button" class="self-start rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5" disabled={pending||context?.identity.org_role==='viewer'} on:click={()=>permissions(c)}>Applications et outils autorisés</button>{/if}
  {/each}
 {/if}
 {#if selected}
  <section class="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800" aria-label="Autorisations MCP">
   <h3 class="text-xs font-medium">Autorisations · {selected.label}</h3>
   <fieldset class="space-y-2"><legend class="mb-2 text-xs text-gray-500">Applications de votre compte</legend>
    {#each context.clients as app (app.id)}<label class="flex items-center gap-2 text-xs"><input type="checkbox" bind:group={chosenApps} value={app.id} disabled={pending||app.id==='owv'||(!app.identity_ready&&!chosenApps.includes(app.id))} />{app.id}{!app.identity_ready?' · identité non reliée':''}</label>{/each}
   </fieldset>
   <p class="text-[0.6875rem] text-gray-500">Les outils sélectionnés pourront être utilisés par ces applications. Certaines actions modifient des données, envoient des contenus ou consomment des crédits fournisseur.</p>
   <fieldset class="max-h-64 space-y-2 overflow-y-auto"><legend class="mb-2 text-xs text-gray-500">Outils annoncés par le fournisseur</legend>
    {#each tools as tool (tool.name)}<label class="flex items-start gap-2 text-xs"><input class="mt-1" type="checkbox" bind:group={chosenTools} value={tool.name} disabled={pending} /><span class="min-w-0 break-words"><span class="font-medium">{tool.name}</span><span class="block text-gray-500">{tool.description||'Description indisponible'}</span></span></label>{/each}
    {#if !tools.length}<p class="text-xs text-gray-500">Aucun outil annoncé.</p>{/if}
   </fieldset>
   <div class="flex gap-2"><button type="button" class={buttonClass} disabled={pending} on:click={savePermissions}>Autoriser la sélection</button><button type="button" class="rounded-lg px-2 py-1 text-xs" disabled={pending} on:click={()=>selected=null}>Annuler</button></div>
  </section>
 {/if}
 {#if error}<p role="alert" class="text-xs text-red-600 dark:text-red-400">{error}</p>{/if}
 <button type="button" disabled={loading||pending} class="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-black/5 dark:hover:bg-white/5" on:click={load}>Actualiser</button>
</UserSettingSection>
