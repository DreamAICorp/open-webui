import { toast } from 'svelte-sonner';
import { isHermesCockpitFrame } from './hermes-embed';

type Controls = {
 selected(chat: string): string;
 selection(chat: string): {harness:string;model:string;source?:string};
 promoteDraft(chat: string): void;
 submit(chat: string, prompt: string, accepted: () => void, files?: any[]): Promise<void>;
 interrupt(chat: string): Promise<unknown>;
 dispose(): void;
};
export type NativeHarness = {
 frame: { readonly src: string; contentDocument: Document; contentWindow: Window };
 notify(message: string): void;
 controls?: Controls;
 disposeCommands?: () => void;
 ready: Promise<void>;
 disposed?: boolean;
 loader?: HTMLScriptElement;
};

export function mountNativeHarness(chat: () => string): NativeHarness | null {
 if (window.top !== window) {
  const trustedCockpit = isHermesCockpitFrame();
  if (!trustedCockpit) {
   try { if (!(new URL(location.href).searchParams.has('cockpit') || (window.frameElement as HTMLElement | null)?.dataset.hermesCockpitChat === '1') || window.parent.location.origin !== location.origin) return null; }
   catch { return null; }
  }
 }
 const runtime: NativeHarness = {
  frame: { get src() { return new URL('/c/' + encodeURIComponent(chat()), location.origin).href; }, contentDocument: document, contentWindow: window },
  notify: message => toast(message),
  ready: Promise.resolve()
 };
 (window as any).owvNativeHarness = runtime;
 runtime.ready = new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = '/harness/harness-ui.js?v=native-20261002-workspace-lifecycle';
  (script as any).__owvNativeRuntime = runtime;
  runtime.loader = script;
  script.onload = () => { script.remove(); resolve(); };
  script.onerror = () => { script.remove(); reject(new Error('Impossible de charger les commandes CLI.')); };
  document.head.append(script);
 });
 runtime.ready.catch(error => toast.error(error.message));
 return runtime;
}

export function unmountNativeHarness(runtime: NativeHarness | null) {
 if (!runtime) return;
 runtime.disposed = true;
 runtime.loader?.remove();
 runtime.controls?.dispose();
 runtime.disposeCommands?.();
 if ((window as any).owvNativeHarness === runtime) delete (window as any).owvNativeHarness;
}
