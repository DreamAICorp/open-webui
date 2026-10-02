<script lang="ts">
 import { onMount } from 'svelte';
 export let value = '';
 export let disabled = false;
 let agents: {id:string;name:string;role:string;kind:string}[] = [];
 let unavailable = false;
 onMount(async () => {
  try {
   const response = await fetch('/api/v1/hermes/agents', {headers:{Authorization:`Bearer ${localStorage.token}`}});
   if (!response.ok) throw new Error('agents unavailable');
   agents = (await response.json()).agents;
  } catch { unavailable = true; }
 });
</script>
<label class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-[0.8125rem] text-gray-600 dark:text-gray-300" title="Choisir un agent indépendamment du modèle LLM">
 <span class="shrink-0">Agent / sous-agent</span>
 <select aria-label="Agent / sous-agent" bind:value disabled={disabled || unavailable} class="min-w-0 rounded-lg border border-gray-200 bg-transparent px-2 py-1 dark:border-gray-700">
  <option value="">Aucun agent</option>
  <optgroup label="Agents permanents Hermès">
   {#each agents as agent}<option value={agent.id}>{agent.name} — {agent.role}</option>{/each}
  </optgroup>
 </select>
 {#if unavailable}<span class="text-xs">Hermès indisponible</span>{/if}
</label>
