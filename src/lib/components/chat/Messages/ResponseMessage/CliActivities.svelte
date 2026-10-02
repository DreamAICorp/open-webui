<script lang="ts">
 export let activities: any[] = [];
</script>
{#if activities.length}
 <div class="my-2 flex flex-col gap-2" aria-label="Activités CLI">
  {#each activities as activity (activity.id)}
   <details class="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
    <summary class="cursor-pointer text-sm">{activity.title || activity.type || 'Outil'} · {activity.status === 'completed' ? 'Terminé' : activity.status === 'failed' ? 'Échec' : activity.status === 'interrupted' ? 'Interrompu' : 'En cours'}{activity.exitCode != null ? ` · code ${activity.exitCode}` : ''}</summary>
    {#if activity.command}<pre class="mt-2 whitespace-pre-wrap break-words text-xs">{activity.command}</pre>{/if}
    {#if activity.input}<pre class="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(activity.input,null,2)}</pre>{/if}
    {#if activity.output}<pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{activity.output}</pre>{/if}
   </details>
  {/each}
 </div>
{/if}
