<script lang="ts">
 import { onMount } from 'svelte';
 import { consentKey, mcpRequest } from '$lib/apis/ai-connections';
 let status='Vérification du consentement…';
 onMount(()=>{void (async()=>{
  const url=new URL(location.href),state=url.searchParams.get('state'),code=url.searchParams.get('code'),denied=url.searchParams.has('error');
  history.replaceState(null,'',url.pathname);
  const raw=sessionStorage.getItem(consentKey);sessionStorage.removeItem(consentKey);
  try {
   const saved=JSON.parse(raw||'null');
   if(!saved||saved.state!==state||saved.expires<=Date.now())throw new Error('Demande expirée ou autre onglet. Relancez la connexion dans les réglages.');
   if(denied)throw new Error('Consentement annulé chez le fournisseur.');
   if(!code||code.length>=8192)throw new Error('Retour de consentement invalide.');
   const context=await mcpRequest('/context');
   if(context.context_key!==saved.contextKey)throw new Error('Le compte a changé. Relancez la connexion dans les réglages.');
   await mcpRequest('/oauth/complete','POST',{state,code});status='Connexion enregistrée. Vous pouvez revenir au cockpit.';
  }catch(e){status=e instanceof Error?e.message:'Connexion non enregistrée.';}
 })();});
</script>
<svelte:head><meta name="referrer" content="no-referrer" /><title>Connexion MCP</title></svelte:head>
<div class="mx-auto max-w-lg space-y-4 p-8"><h1 class="text-lg font-semibold">AI Connections</h1><p role="status" class="text-sm text-gray-500">{status}</p><a class="text-sm underline" href="/cockpit/">Retour au cockpit</a></div>
