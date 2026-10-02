<script lang="ts">
 import { isHermesCockpitFrame } from '$lib/integrations/hermes-embed';
 import { onMount } from 'svelte';
 let embedded = false;
 onMount(()=>{embedded=isHermesCockpitFrame();});
 import ModelSelector from './ModelSelector.svelte';
 import HermesAgentSelector from './HermesAgentSelector.svelte';
 export let selectedModels: string[] = [];
 export let hermesAgent = '';
 export let disabled = false;
 export let showSetDefault = false;
 let modelSelector: ModelSelector | undefined;
 export const open = () => modelSelector?.open();
</script>
<div data-chat-selector-bar class="flex w-full min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Agent, CLI, host et modèle">
 {#if !embedded}<HermesAgentSelector bind:value={hermesAgent} {disabled} />{/if}
 <ModelSelector bind:this={modelSelector} bind:selectedModels {showSetDefault} placement="auto" align="end" triggerClassName="items-center gap-1.5 rounded-lg px-2 py-1 text-sm" />
 <a href="https://agency.dev.4u-corp.com/" target="_top" class="rounded-lg px-2 py-1 text-sm" aria-label="Cockpit entreprise">Cockpit</a>
</div>
