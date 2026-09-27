<script lang="ts">
 import { onMount, getContext } from 'svelte';
 import Spinner from '$lib/components/common/Spinner.svelte';
 import UserSettingSection from '../UserSettingSection.svelte';
 import UserSettingRow from '../UserSettingRow.svelte';
 const i18n = getContext('i18n');
 type Target = { target: string; agents: string[] };
 let targets: Target[] = [];
 let loading = true;
 let pending = '';
 let error = '';
 let status = '';
 let active = true;
 const controller = new AbortController();
 const names: Record<string,string> = { codex:'Codex', claude:'Claude Code', grok:'Grok' };
 async function request(action:string, body?:unknown) {
  const response = await fetch('/cockpit-sessions/v1/cli-sessions/' + action, {
   method: body ? 'POST' : 'GET', credentials:'same-origin', signal:controller.signal,
   headers: { 'Content-Type':'application/json', ...(localStorage.token ? {Authorization:'Bearer '+localStorage.token} : {}) },
   ...(body ? {body:JSON.stringify(body)} : {})
  });
  const result = await response.json();
  if(!response.ok) throw new Error(result.detail || $i18n.t('Connection unavailable'));
  return result;
 }
 async function load() {
  loading=true;error='';
  try { const result=await request('targets'); if(active)targets=result.items||[]; }
  catch(e) { if(active)error=e instanceof Error?e.message:$i18n.t('Connection unavailable'); }
  finally { if(active)loading=false; }
 }
 async function push(agent:string,target:string) {
  if(pending)return;
  pending=target+':'+agent;error='';status='';
  try {
   const result=await request('push',{agent,target});
   if(!result.ok)throw new Error($i18n.t('Session transfer failed'));
   if(active)status=$i18n.t('Session transferred. Send a message to verify access to your plan.');
  } catch(e) { if(active)error=e instanceof Error?e.message:$i18n.t('Session transfer failed'); }
  finally { if(active)pending=''; }
 }
 onMount(()=>{void load();return()=>{active=false;controller.abort();};});
</script>

<UserSettingSection title="AI Connections · Sessions CLI" first className="mb-6">
 <p class="text-[0.6875rem] leading-relaxed text-gray-400 dark:text-gray-500">
  {$i18n.t('Use your local CLI session on the server through AI Connections. Your Mac must be online. Credentials never pass through this page.')}
 </p>
 {#if loading}
  <div role="status" class="flex items-center gap-2 text-xs text-gray-500"><Spinner className="size-4" />{$i18n.t('Loading...')}</div>
 {:else}
  {#each targets as target (target.target)}
   {#each target.agents as agent (agent)}
    <UserSettingRow label={names[agent] || agent} description={target.target}>
     <button type="button" disabled={!!pending} on:click={()=>push(agent,target.target)}
      class="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-900 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-100">
      {#if pending===target.target+':'+agent}<Spinner className="size-3" />{/if}
      {$i18n.t('Copy local session to server')}
     </button>
    </UserSettingRow>
   {/each}
  {/each}
  {#if !targets.length && !error}<p class="text-xs text-gray-500">{$i18n.t('No authorized session destination is configured for your account.')}</p>{/if}
 {/if}
 {#if error}<p role="alert" class="text-xs text-red-600 dark:text-red-400">{error}</p>{/if}
 {#if status}<p role="status" class="text-xs text-gray-600 dark:text-gray-300">{status}</p>{/if}
 <div><button type="button" disabled={loading||!!pending} on:click={load}
  class="rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{$i18n.t('Refresh')}</button></div>
</UserSettingSection>
