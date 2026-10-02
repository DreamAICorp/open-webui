(() => {
  const NATIVE_RUNTIME = document.currentScript?.__owvNativeRuntime || window.owvNativeHarness;
  if (NATIVE_RUNTIME?.disposed) return;
  const STANDALONE = !!NATIVE_RUNTIME;
  const REQUESTED_PROFILE = new URLSearchParams(location.search).get("cockpitHost") || (STANDALONE ? (["owv-next.dev.4u-corp.com", "hermes.dev.4u-corp.com", "agency.dev.4u-corp.com"].includes(location.hostname) ? "dev" : {"3002":"will-vps","3003":"prod","3004":"dev"}[location.port] || "legacy") : "will-vps");
  const PROFILE = ["will-vps","prod","dev","legacy"].includes(REQUESTED_PROFILE) ? REQUESTED_PROFILE : "will-vps";
  if (PROFILE === "will-vps") {
    const legacyKeys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>["owv:harness:dev:","owv:connection:dev:","owv:session:routing-v4:dev:","owv:model:dev:","owv:model-source:dev:"].some(prefix=>key?.startsWith(prefix)));
    for (const oldKey of legacyKeys) {
      const nextKey=oldKey.replace(":dev:",":will-vps:");
      if (localStorage.getItem(nextKey)===null) localStorage.setItem(nextKey,localStorage.getItem(oldKey));
      localStorage.removeItem(oldKey);
    }
  }
  const selectedExecution = chat => localStorage.getItem("owv:execution:"+PROFILE+":"+chat) || localStorage.getItem("owv:execution:"+PROFILE+":last") || "host";
  const selectedAgent = () => {
    const doc = NATIVE_RUNTIME?.frame?.contentDocument || document;
    const value = doc.querySelector('select[aria-label="Agent / sous-agent"]')?.value || "";
    return /^[a-z][a-z0-9-]{0,60}$/.test(value) ? value : "";
  };
  const AUTH = () =>
    localStorage.token ? { authorization: "Bearer " + localStorage.token } : {};
  const H = [["owv", "Open WebUI"], ["codex", "Codex"], ["claude", "Claude"], [
    "opencode",
    "OpenCode",
  ]];
  const idOf = (f) => {
    try {
      return new URL(f.src, location.origin).pathname.match(/^\/c\/([^/?#]+)/)
        ?.[1] || "";
    } catch {
      return "";
    }
  };
  const harness = (id) => localStorage.getItem("owv:harness:" + PROFILE + ":" + id) || localStorage.getItem("owv:harness:" + PROFILE + ":last") || "owv",
    setHarness = (id, h) => { localStorage.setItem("owv:harness:" + PROFILE + ":" + id, h); localStorage.setItem("owv:harness:" + PROFILE + ":last", h); if(STANDALONE)window.dispatchEvent(new CustomEvent("owv:cli-selection")); },
    connectionKey = (id, h) => "owv:connection:" + PROFILE + ":" + id + ":" + h,
    selectedConnection = (id, h) => localStorage.getItem(connectionKey(id, h)) || localStorage.getItem("owv:connection:" + PROFILE + ":last:" + h) || "",
    setConnection = (id, h, value) => { localStorage.setItem(connectionKey(id, h), value); localStorage.setItem("owv:connection:" + PROFILE + ":last:" + h, value); },
    key = (id, h) => "owv:session:routing-v4:" + PROFILE + ":" + id + ":" + h + ":" + selectedConnection(id, h) + (["codex","claude","opencode"].includes(h)&&selectedExecution(id)==="computer"?":computer":"") + (selectedAgent()?":agent:"+selectedAgent():""),
    modelKey = (id, h) => "owv:model:" + PROFILE + ":" + id + ":" + h,
    sourceKey = (id, h) => "owv:model-source:" + PROFILE + ":" + id + ":" + h,
    selectedSource = (id, h) => localStorage.getItem(sourceKey(id, h)) || localStorage.getItem("owv:model-source:" + PROFILE + ":last:" + h) || undefined,
    setSource = (id, h, source) => { localStorage.setItem(sourceKey(id, h), source); localStorage.setItem("owv:model-source:" + PROFILE + ":last:" + h, source); },
    selectedModel = (id, h) => localStorage.getItem(modelKey(id, h)) || localStorage.getItem("owv:model:" + PROFILE + ":last:" + h) || "",
    setModel = (id, h, model) => { localStorage.setItem(modelKey(id, h), model || ""); localStorage.setItem("owv:model:" + PROFILE + ":last:" + h, model || ""); };
  const toast = (m) => {
    let x = document.querySelector("#toast");
    // Agency embeds WebUI from a different origin; parent DOM access is optional.
    if (!x) { try { x = parent.document.querySelector("#toast"); } catch {} }
    if (!x) { window.owvNativeHarness?.notify?.(m); return; }
    x.textContent = m;
    x.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => x.classList.remove("show"), 4000);
  };
  function message(f, role, name, text) {
    const d = f.contentDocument;
    let list = d?.getElementById("owv-session-messages") || d?.querySelector("#messages-container section");
    if (!list && d) {
      const form = d.getElementById("message-input-container")?.closest("form");
      if (form?.parentElement) {
        list = d.createElement("section");
        list.id = "owv-session-messages";
        list.setAttribute("aria-live", "polite");
        list.className = "w-full max-h-[55vh] overflow-y-auto px-2";
        form.parentElement.insertBefore(list, form);
      }
    }
    if (!list) return null;
    const row = d.createElement("div"), body = d.createElement("div");
    row.dataset.owvSession = "1";
    row.className = role === "user"
      ? "my-4 flex w-full justify-end"
      : "my-5 w-full";
    body.className = role === "user"
      ? "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100"
      : "whitespace-pre-wrap pl-7 text-sm leading-6 text-gray-700 dark:text-gray-100";
    body.textContent = text;
    if (role === "assistant") {
      const head = d.createElement("div");
      head.className =
        "mb-2 flex items-center gap-2 pl-1 text-sm font-medium text-gray-700 dark:text-gray-200";
      head.textContent = name;
      row.append(head);
    }
    row.append(body);
    list.append(row);
    const sc = d.getElementById("messages-container");
    if (sc) sc.scrollTop = sc.scrollHeight;
    return body;
  }
  async function json(url, o = {}) {
    const r = await fetch(url, {
        credentials: "include",
        ...o,
        headers: { ...AUTH(), ...(o.headers || {}) },
      }),
      x = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(x.detail || "Action refusée");
    return x;
  }
  const sessionRequests = new Map();
  async function ensure(chat, h, selection = {model:selectedModel(chat,h),source:selectedSource(chat,h),sessionId:selectedConnection(chat,h)}) {
    if(["codex","claude"].includes(h)&&selection.source!=="free"&&!selection.sessionId){
      const available=await json("/cockpit-sessions/v1/connections?harness="+encodeURIComponent(h)),first=available.items?.[0];
      if(!first)throw Error("Aucune session CLI disponible dans AI Connections.");
      setConnection(chat,h,first.id);selection={...selection,sessionId:first.id};
    }
    const k = key(chat, h);
    if (sessionRequests.has(k)) return sessionRequests.get(k);
    const request = createOrGetSession(chat, h, selection).finally(() => sessionRequests.delete(k));
    sessionRequests.set(k, request);
    return request;
  }
  async function createOrGetSession(chat, h, selection) {
    let sid = localStorage.getItem(key(chat, h));
    if (sid) {
      try {
        await json("/cockpit-sessions/v1/sessions/" + encodeURIComponent(sid));
        return sid;
      } catch {
        localStorage.removeItem(key(chat, h));
      }
    }
    const s = await json("/cockpit-sessions/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ harness: h, agentId: selection.agentId || selectedAgent() || undefined, model: selection.model || undefined, source: selection.source, sessionId: selection.sessionId || undefined, cockpitHost: PROFILE, executionTarget: ["codex","claude","opencode"].includes(h)?selectedExecution(chat):"host" }),
    });
    localStorage.setItem(key(chat, h), s.id);
    return s.id;
  }
  function activityLabel(e) {
    const method = e?.method || "";
    if(method === 'adapter/provider-status') return e.params?.reason === 'rate_limit' ? 'Fournisseur saturé ou limité. Le CLI réessaie…' : e.params?.reason === 'authentication' ? 'Le fournisseur refuse la connexion. Le CLI réessaie…' : 'Erreur du fournisseur. Le CLI réessaie…';
    const item = e?.params?.item || e?.item || e?.params?.update || {};
    const type = item.type || item.sessionUpdate || e?.event?.content_block?.type || "";
    if (method === "adapter/ready") return "Connexion établie. Démarrage…";
    if (method === "turn/started") return "Analyse de la demande…";
    if (method.includes("reasoning") || type === "reasoning") return "Réflexion en cours…";
    if (type === "commandExecution" || method.includes("commandExecution")) {
      const command = item.command || item.commandLine || item.aggregatedOutput || "";
      return command ? "Commande en cours : " + String(command).replace(/\s+/g, " ").slice(0, 90) : "Commande en cours…";
    }
    if (type === "fileChange" || method.includes("fileChange")) {
      const path = item.path || item.filePath || item.changes?.[0]?.path || "";
      return path ? "Modification du fichier : " + path : "Modification de fichiers…";
    }
    if (type === "mcpToolCall" || method.includes("mcpToolCall") || type === "tool_use" || type === "tool_call" || type === "tool_call_update") {
      const tool = item.tool || item.name || item.server || "";
      return tool ? "Outil en cours : " + tool : "Utilisation d’un outil…";
    }
    if (type === "webSearch" || method.includes("webSearch")) return "Recherche en cours…";
    if (type === "plan" || type === "todo") return "Mise à jour du plan…";
    if (type === "agentMessage" || method.includes("agentMessage")) return "Rédaction de la réponse…";
    if (method === "item/started") return "Nouvelle action en cours…";
    if (method === "item/completed") return "Action terminée. Poursuite…";
    if (e?.type === "system") return "Initialisation de la session…";
    if (e?.type === "assistant") return "Rédaction de la réponse…";
    return "";
  }
  async function showRequest(f,sid,request,chat) {
    const d=f.contentDocument;
    if(!d||idOf(f)!==chat||d.getElementById("owv-request-"+request.requestId))return;
    const active=await json("/cockpit-sessions/v1/sessions/"+encodeURIComponent(sid)+"/requests");
    if(idOf(f)!==chat||!active.items?.some(item=>item.requestId===request.requestId))return;
    const panel=d.createElement("section");panel.id="owv-request-"+request.requestId;panel.dataset.owvRequestChat=chat;
    panel.className="my-3 rounded-xl border border-violet-300 bg-white p-3 text-sm dark:border-violet-700 dark:bg-gray-900 dark:text-white";
    panel.setAttribute("role","region");panel.setAttribute("aria-label","Demande du CLI");
    const title=d.createElement("div");title.className="mb-2 font-medium";
    const inputRequest=request.method==="item/tool/requestUserInput";
    title.textContent=inputRequest?"Le CLI attend ta réponse":"Autorisation demandée par le CLI";panel.append(title);
    const fields=[];
    if(inputRequest)for(const question of request.params.questions||[]) {
      const label=d.createElement("label");label.className="mb-2 block";label.textContent=question.question;
      const input=d.createElement("input");input.type=question.isSecret?"password":"text";input.className="mt-1 w-full rounded-lg border bg-transparent px-2 py-1";
      label.append(input);panel.append(label);const selected=new Set();fields.push([question.id,input,selected]);
      for(const option of question.options||[]){const choice=d.createElement("button");choice.type="button";choice.className="mb-2 mr-2 rounded-lg border px-2 py-1";choice.textContent=option.label;choice.title=option.description||"";choice.onclick=()=>{if(question.multiSelect){if(selected.has(option.label))selected.delete(option.label);else selected.add(option.label);choice.setAttribute("aria-pressed",String(selected.has(option.label)));}else input.value=option.label;};panel.append(choice);}
    }else{
      const detail=d.createElement("pre");detail.className="mb-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs";
      detail.textContent=[request.params.reason,request.params.command,request.params.cwd].filter(Boolean).map(value=>typeof value==="string"?value:JSON.stringify(value)).join("\n");panel.append(detail);
    }
    const error=d.createElement("p");error.setAttribute("role","alert");
    const submit=async body=>{const buttons=panel.querySelectorAll("button");buttons.forEach(b=>b.disabled=true);try{await json("/cockpit-sessions/v1/sessions/"+encodeURIComponent(sid)+"/requests/"+encodeURIComponent(request.requestId),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});panel.remove();}catch(e){error.textContent=e.message;buttons.forEach(b=>b.disabled=false);}};
    const choices=inputRequest?[["Répondre",null]]:[["Autoriser","accept"],["Autoriser pour cette session","acceptForSession"],["Refuser","decline"],["Annuler le tour","cancel"]];
    for(const [label,decision] of choices.filter(([,value])=>inputRequest||!request.params.availableDecisions||request.params.availableDecisions.includes(value))){const button=d.createElement("button");button.type="button";button.className="mr-2 mt-2 rounded-lg border px-3 py-1.5";button.textContent=label;button.onclick=()=>submit(inputRequest?{answers:Object.fromEntries(fields.map(([id,field,selected])=>[id,{answers:[...selected,...(field.value.trim()?[field.value]:[])]}]))}:{decision});panel.append(button);}
    panel.append(error);
    const input=d.getElementById("message-input-container");
    if(input?.parentElement)input.parentElement.insertBefore(panel,input);else d.body.append(panel);
  }
  async function events(f, sid, pending, turn, onReady = () => {}, replay = false, initialText = "") {
    const eventChat=f?idOf(f):null;
    const r = await fetch(
      "/cockpit-sessions/v1/sessions/" + encodeURIComponent(sid) + "/events?tail=" + (replay ? "0" : "1"),
      { credentials: "include", headers: AUTH() },
    );
    if (!r.ok) throw Error("Flux de session indisponible");
    onReady();
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "", draft = "", activeMessageId = null, lastActivity = Date.now(), done = false, providerStatus = "";
    const completedMessages = initialText ? [initialText] : [];
    const activityStates = new Map();
    const emitActivity = value => {
      if (!pending.activity || !value.id) return;
      if (value.status) activityStates.set(value.id, value.status);
      pending.activity(value);
    };
    const finishActivities = status => {
      for (const [id, state] of activityStates) {
        if (['running', 'in_progress', 'pending'].includes(state)) emitActivity({id, status});
      }
    };
    const renderTranscript = () => {
      const parts = [...completedMessages, draft].map(value => String(value || "").trim()).filter(Boolean);
      text = parts.join("\n\n");
      if (text) { pending.textContent = text; pending.scrollIntoView({ block: "end" }); }
    };
    const commitMessage = value => {
      const normalized = String(value || "").trim();
      if (normalized && completedMessages[completedMessages.length - 1] !== normalized) completedMessages.push(normalized);
      draft = "";
      activeMessageId = null;
      renderTranscript();
    };
    const startedAt = Date.now();
    const status = (label) => {
      lastActivity = Date.now();
      if (!text && pending && label) {
        if (pending.setStatus) pending.setStatus(label);
        else pending.textContent = label;
        pending.scrollIntoView({ block: "end" });
      }
    };
    status("Session prête. Envoi de la demande…");
    const heartbeat = setInterval(() => {
      if (done || text || !pending) return;
      const elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
      const idle = Math.floor((Date.now() - lastActivity) / 1000);
      const label = providerStatus || (idle >= 30
        ? "En attente du moteur… " + elapsed + " s"
        : "Travail en cours… " + elapsed + " s");
      if (pending.setStatus) pending.setStatus(label);
      else pending.textContent = label;
      pending.scrollIntoView({ block: "end" });
    }, 5000);
    try {
      for (;;) {
        const x = await reader.read();
        if (x.done) break;
        buf += dec.decode(x.value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const e = JSON.parse(line.slice(6));
              lastActivity = Date.now();
              if(e.method==="adapter/request"&&f){void showRequest(f,sid,e.params,eventChat).catch(error=>toast(error.message));status("Le CLI attend une autorisation ou une réponse.");continue;}
              if(e.method==="adapter/request-resolved"&&f){f.contentDocument?.getElementById("owv-request-"+e.params.requestId)?.remove();continue;}
              const eventTurnId = e.params?.turn?.id || e.params?.turnId || e.turn_id || null;
              if (e.method === "adapter/goal-continuing" && e.params?.turnId) {
                turn.id = e.params.turnId;
                status("Objectif toujours actif. Poursuite automatique…");
                continue;
              }
              const terminal = e.method === "turn/completed" || e.method === "error";
              if (terminal && !turn.id && eventTurnId) continue;
              if (turn.id && eventTurnId && eventTurnId !== turn.id) continue;
              if (e.method === "error" && !e.params?.willRetry) {
                finishActivities("failed");
                pending.textContent = "Erreur : " + (e.params?.error?.message || "Le moteur a refusé la demande.");
                await reader.cancel();
                return;
              }
              if (e.method === "adapter/closed") {
                finishActivities("interrupted");
                pending.textContent = "Erreur : la session du moteur a été interrompue.";
                await reader.cancel();
                return;
              }
              if (pending.activity) {
                const acp=e.method==='session/update'?e.params?.update:null;
                if(acp?.toolCallId&&['tool_call','tool_call_update'].includes(acp.sessionUpdate)){
                  const activity={id:acp.toolCallId};
                  if(acp.title!=null)activity.title=acp.title;
                  if(acp.status!=null)activity.status=acp.status;
                  if(acp.rawInput!=null)activity.input=acp.rawInput;
                  if(acp.rawOutput!=null)activity.output=typeof acp.rawOutput==='string'?acp.rawOutput:JSON.stringify(acp.rawOutput);
                  else if(acp.content)activity.output=acp.content.map(block=>block.content?.text|| (block.type==='diff'?block.path+'\n'+block.newText:'')).filter(Boolean).join('\n');
                  emitActivity(activity);
                }
                const item = e.params?.item;
                if (item?.id && item.type !== 'agentMessage' && ['item/started','item/completed'].includes(e.method)) emitActivity({id:item.id,type:item.type,title:item.type === 'commandExecution' ? 'Commande' : item.type,command:item.command,status:e.method === 'item/completed' ? (item.exitCode != null && item.exitCode !== 0 ? 'failed' : 'completed') : 'running',...(item.aggregatedOutput !== undefined ? {output:item.aggregatedOutput} : e.method === 'item/started' ? {output:''} : {}),...(item.exitCode !== undefined ? {exitCode:item.exitCode} : {})});
                if (e.method === 'item/commandExecution/outputDelta') emitActivity({id:e.params.itemId,outputDelta:e.params.delta});
                for (const block of e.message?.content || []) {
                  if (block.type === 'tool_use') emitActivity({id:block.id,title:block.name,input:block.input,status:'running'});
                  if (block.type === 'tool_result') emitActivity({id:block.tool_use_id,output:typeof block.content === 'string' ? block.content : JSON.stringify(block.content),status:block.is_error ? 'failed' : 'completed'});
                }
              }
              if(e.method === 'adapter/provider-status') {
                providerStatus = activityLabel(e);
                emitActivity({id:'provider-status:'+(turn.id||sid),title:providerStatus,status:'pending'});
              }
              status(activityLabel(e));
              const claudeDelta = e.type === "stream_event" &&
                e.event?.type === "content_block_delta" &&
                e.event?.delta?.type === "text_delta"
                ? e.event.delta.text
                : "";
              if (e.method === "item/started" && e.params?.item?.type === "agentMessage") {
                if (draft) commitMessage(draft);
                activeMessageId = e.params.item.id || null;
              }
              if (e.method === "item/agentMessage/delta" || claudeDelta) {
                const messageId = e.params?.itemId || e.params?.id || null;
                if (draft && activeMessageId && messageId && activeMessageId !== messageId) commitMessage(draft);
                activeMessageId = messageId || activeMessageId;
                draft += e.method === "item/agentMessage/delta" ? e.params.delta : claudeDelta;
                renderTranscript();
              }
              if (e.method === "item/completed" && e.params?.item?.type === "agentMessage") {
                commitMessage(e.params.item.text || draft);
              }
              if (e.method === "turn/completed") {
                finishActivities(e.params?.turn?.status === "interrupted" ? "interrupted" : e.params?.turn?.status === "failed" || e.params?.turn?.error ? "failed" : "completed");
                if(e.params?.turn?.status==="interrupted"){if(draft)commitMessage(draft);commitMessage("Tour interrompu.");await reader.cancel();return;}
                if (e.params?.turn?.status === "failed" || e.params?.turn?.error) {
                  pending.textContent = "Erreur : " + (e.params?.turn?.error?.message || "Le moteur n’a pas pu terminer la demande.");
                  await reader.cancel();
                  return;
                }
                const finalMessages = (e.params?.turn?.items || []).filter(item => item?.type === "agentMessage").map(item => item.text || "").filter(Boolean);
                if (draft) commitMessage(draft);
                for (const finalMessage of finalMessages) commitMessage(finalMessage);
                if (text) { pending.textContent = text; pending.scrollIntoView({ block: "end" }); }
                else if (!text) pending.textContent = "Travail terminé.";
                await reader.cancel();
                return;
              }
              if (e.type === "assistant") {
                const value = (e.message?.content || []).filter(block => block.type === "text").map(block => block.text || "").join("");
                if (value) commitMessage(value);
              }
              if (e.type === "result") {
                finishActivities(e.is_error ? "failed" : "completed");
                if (e.is_error) pending.textContent = "Erreur : " + (e.result || (e.errors || []).join("\n") || "Claude a interrompu la demande.");
                else if (e.result && !text) commitMessage(e.result);
                else if (!text) pending.textContent = "Travail terminé.";
                await reader.cancel();
                return;
              }
              const update = e.method === "session/update" ? e.params?.update : null;
              if (update?.sessionUpdate === "agent_message_chunk") {
                draft += update.content?.text || "";
                renderTranscript();
              }
              if (update?.sessionUpdate === "agent_message_done") {
                if (draft) commitMessage(draft);
                if (!text) pending.textContent = "Travail terminé.";
              }
            } catch {}
          }
        }
      }
      if (!text && pending) pending.textContent = "Flux interrompu avant la réponse finale.";
    } finally {
      done = true;
      clearInterval(heartbeat);
      await reader.cancel().catch(() => {});
    }
  }
  window.owvHarnessSession = { ensure, harness };
  const runningChats = new Set();
  const pendingTurnKey = chat => "owv:pending-turn:" + chat;
  async function resumePending(f, chat) {
    if (runningChats.has(chat)) return;
    let saved, recoveredTurn;
    try { saved = JSON.parse(localStorage.getItem(pendingTurnKey(chat)) || "null"); } catch { return; }
    const bridge = f.contentWindow?.owvHarnessChat;
    if (bridge?.version !== 1 || typeof bridge.resume !== "function") return;
    if (!saved?.sid) {
      const sid = localStorage.getItem(key(chat, "codex"));
      if (!sid || typeof bridge.resumeLatest !== "function") return;
      try {
        const state = await json("/cockpit-sessions/v1/sessions/" + encodeURIComponent(sid));
        if (!state.autonomousGoal || !state.activeTurnId) return;
        const latest = await bridge.resumeLatest({chatId:chat});
        recoveredTurn = latest;
        saved = {sid,turnId:state.activeTurnId,messageId:latest.messageId,initialContent:latest.content || ""};
        localStorage.setItem(pendingTurnKey(chat),JSON.stringify(saved));
      } catch (error) { toast("Reprise du goal : " + error.message); return; }
    }
    if (!saved.messageId) return;
    runningChats.add(chat);
    let nativeTurn, pending;
    try {
      const state = await json("/cockpit-sessions/v1/sessions/" + encodeURIComponent(saved.sid));
      // A persistent goal can advance to a new Codex turn while the page is
      // closed. Always follow the server's active turn instead of filtering its
      // events with a stale turn id saved by the previous page instance.
      const turnId = state.autonomousGoal && state.activeTurnId
        ? state.activeTurnId
        : saved.turnId || state.activeTurnId || state.lastTurnId;
      if (!turnId) throw Error("Le tour Codex à reprendre est introuvable.");
      nativeTurn = recoveredTurn || await bridge.resume({chatId:chat,messageId:saved.messageId});
      saved.turnId = turnId;
      localStorage.setItem(pendingTurnKey(chat),JSON.stringify(saved));
      const initialContent = saved.initialContent || nativeTurn.content || "";
      let text = initialContent || "Travail Codex en cours…";
      pending = {get textContent(){return text;},set textContent(value){text=String(value);nativeTurn.update(text);},setStatus(value){text=String(value);(nativeTurn.status||nativeTurn.update)(text);},activity(value){nativeTurn.activity?.(value);},scrollIntoView(){}};
      await events(f, saved.sid, pending, {id:turnId}, () => {}, true, initialContent);
      await nativeTurn.finish(pending.textContent || "Aucune réponse reçue du moteur.");
      localStorage.removeItem(pendingTurnKey(chat));
    } catch (error) {
      toast("Reprise Codex : " + error.message);
    } finally {
      runningChats.delete(chat);
    }
  }
  async function run(f, input) {
    const chat = idOf(f),
      h = harness(chat),
      selection = {model:selectedModel(chat,h),source:selectedSource(chat,h),sessionId:selectedConnection(chat,h),agentId:f.contentDocument?.querySelector('select[aria-label="Agent / sous-agent"]')?.value || selectedAgent() || undefined};
    const attachments = input.files || [];
    let prompt = (input.innerText || input.textContent || "").trim();
    if (!chat || (!prompt && !attachments.length)) return;
    if (runningChats.has(chat)) { toast("Une réponse est déjà en cours dans cette conversation."); return; }
    const bridge = f.contentWindow?.owvHarnessChat;
    if (bridge?.version !== 1) {
      toast("L’interface OWV doit être rechargée avant cet envoi. Votre message est conservé dans le champ.");
      return;
    }
    runningChats.add(chat);
    const name = (H.find((x) => x[0] === h) || H[0])[1];
    let pending, nativeTurn;
    const controls = ['owv-harness-picker','owv-connection-picker','owv-execution-picker','model-selector-model-button'].map(id=>f.contentDocument?.getElementById(id)).filter(Boolean);
    const disabled = controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);
    try {
      const sid = await ensure(chat, h, selection);
      const staged = attachments.length ? await json('/cockpit-sessions/v1/sessions/'+encodeURIComponent(sid)+'/attachments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({files:attachments.map(file=>({id:file.id,name:file.name}))})}) : {items:[]};
      if (bridge?.version === 1) {
        nativeTurn = await bridge.begin({chatId:chat,prompt,model:selection.model||'auto',name,agentId:selection.agentId,files:attachments});
    input.innerText = "";
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: null,
      }),
    );

        let text = 'Réflexion…';
        pending = {get textContent(){return text;},set textContent(value){text=String(value);nativeTurn.update(text);},setStatus(value){text=String(value);(nativeTurn.status||nativeTurn.update)(text);},activity(value){nativeTurn.activity?.(value);},scrollIntoView(){}};
        pending.setStatus("Préparation de la session…");
      }
      let autonomous = false;
      if (h === "codex" && /^\/goal(?:\s|$)/.test(prompt)) {
        const objective = prompt.slice(5).trim();
        const result = await json("/cockpit-sessions/v1/sessions/" + encodeURIComponent(sid) + "/goal", objective ? {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({objective})} : {});
        const goal = result.goal;
        const label = goal ? "Objectif (" + goal.status + ") : " + goal.objective : "Aucun objectif actif dans cette session.";
        if (pending) pending.textContent = label;
        toast(label);
        if (!objective) return;
        autonomous = true;
        prompt = "Travaille maintenant sur l’objectif actif « " + objective + " ». Poursuis-le de manière autonome jusqu’à ce qu’il soit terminé et vérifié.";
        if (pending) pending.setStatus ? pending.setStatus("Objectif configuré. Démarrage du travail…") : pending.textContent = "Objectif configuré. Démarrage du travail…";
      }
      let ready, failed;
      const turn = { id: null };
      const subscribed = new Promise((resolve, reject) => { ready = resolve; failed = reject; });
      const stream = events(f, sid, pending, turn, ready);
      stream.catch(failed);
      await subscribed;
      const started = await json(
        "/cockpit-sessions/v1/sessions/" + encodeURIComponent(sid) + "/turn",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: prompt || "Please inspect the attached files.", model: selection.model || undefined, autonomous,attachments:staged.items.map(file=>file.attachmentId) }),
        },
      );
      turn.id = started.turnId;
      if (nativeTurn?.messageId) localStorage.setItem(pendingTurnKey(chat), JSON.stringify({sid,turnId:turn.id,messageId:nativeTurn.messageId}));
      toast(name + " travaille dans sa session persistante.");
      await stream;
      if (pending && (!pending.textContent.trim() || pending.textContent === "Réflexion…")) {
        pending.textContent = "Aucune réponse reçue du moteur. La demande n’a pas été confirmée comme réussie.";
      }
    } catch (e) {
      if (pending) pending.textContent = "Erreur : " + e.message;
      toast(e.message);
    } finally {
      if(nativeTurn)try {await nativeTurn.finish(pending?.textContent||'Réponse interrompue.');localStorage.removeItem(pendingTurnKey(chat));}
      catch(error){toast('Échec de sauvegarde OWV : '+error.message);}
      controls.forEach((control,i)=>control.disabled=disabled[i]);
      runningChats.delete(chat);
    }
  }
  const mounts = new WeakMap();
  const disposeMount = d => { mounts.get(d)?.dispose(); mounts.delete(d); };
  function mount(f) {
    const d = f.contentDocument,
      chat = idOf(f),
      native = d?.querySelector("#model-selector-model-button");
    const previous = d && mounts.get(d);
    if (previous && (previous.chat !== chat || previous.native !== native)) disposeMount(d);
    if (!d || !chat || !native || d.getElementById("owv-harness-picker")) {
      return;
    }
    const lifecycle = new AbortController();
    const options = {capture:true,signal:lifecycle.signal};
    // Clone the actual Open WebUI control, including its label wrapper and
    // chevron. Keeping the full DOM shape avoids a near-lookalike control.
    const b = native.cloneNode(true);
    b.id = "owv-harness-picker";
    b.type = "button";
    b.removeAttribute("aria-expanded");
    const execution = native.cloneNode(true);
    execution.id="owv-execution-picker";execution.type="button";
    execution.removeAttribute("aria-expanded");
    const connection = native.cloneNode(true);
    connection.id = "owv-connection-picker";
    connection.type = "button";
    connection.removeAttribute("aria-expanded");
    connection.dataset.label = "";
    const originalModelLabel = (native.querySelector('span.min-w-0') || native.querySelector('.inline-flex'))?.textContent || 'Auto';
    const label = () => {
      const x = H.find((x) => x[0] === harness(chat)) || H[0];
      const value = b.querySelector("span.min-w-0") || b.querySelector(".inline-flex");
      if (value) value.textContent = x[1];
      b.setAttribute("aria-label", "Selected harness: " + x[1]);
      b.title=x[1];
      connection.hidden = !["codex","claude"].includes(x[0]);
      execution.hidden = !["codex","claude","opencode"].includes(x[0]);
      const targetValue=execution.querySelector("span.min-w-0")||execution.querySelector(".inline-flex");
      if(targetValue)targetValue.textContent=selectedExecution(chat)==="computer"?"Computer":"Host";
      execution.setAttribute("aria-label","Execution target: "+selectedExecution(chat));
      const connectionValue = connection.querySelector("span.min-w-0") || connection.querySelector(".inline-flex");
      const connectionName = connection.dataset.label || selectedConnection(chat, x[0]) || "Session";
      if(connectionValue) connectionValue.textContent = connectionName;
      connection.setAttribute("aria-label", "Selected session: " + connectionName);
      connection.title=connectionName;
      const model = x[0] === 'owv' ? originalModelLabel : (selectedModel(chat,x[0]) || 'Auto');
      const modelValue = native.querySelector('span.min-w-0') || native.querySelector('.inline-flex');
      if(modelValue) modelValue.textContent = model;
      native.setAttribute('aria-label','Selected model: '+model);
      native.title=model;
    };
    label();
    const menu = d.createElement("div");
    menu.className =
      "z-50 w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 dark:text-white";
    menu.style.cssText = "display:none;position:fixed;z-index:9999";
    H.forEach(([v, n]) => {
      const o = d.createElement("button");
      o.type = "button";
      o.className =
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800";
      o.textContent = n;
      o.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setHarness(chat, v);
        label();
        menu.style.display = "none";
      }, true);
      menu.append(o);
    });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const show = menu.style.display !== "block";
      if (!show) {
        menu.style.display = "none";
        return;
      }
      menu.style.visibility = "hidden";
      menu.style.display = "block";
      const r = b.getBoundingClientRect();
      const viewport = d.defaultView;
      menu.style.left = Math.min(Math.max(8, r.left), viewport.innerWidth - menu.offsetWidth - 8) + "px";
      menu.style.top = (r.bottom + menu.offsetHeight + 8 <= viewport.innerHeight ? r.bottom + 8 : Math.max(8, r.top - menu.offsetHeight - 8)) + "px";
      menu.style.visibility = "visible";
    }, true);
    const connectionMenu = d.createElement("div");
    connectionMenu.className = menu.className;
    connectionMenu.style.cssText = "display:none;position:fixed;z-index:10000";
    let closeAccountDialog = () => {};
    const connectCompanyAccount = () => {
      closeAccountDialog();
      const overlay=d.createElement("div"),panel=d.createElement("section");
      overlay.style.cssText="position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:1rem";
      panel.className="w-full max-w-lg rounded-2xl border bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-900 dark:text-white";
      panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Connecter Codex à cette agence");
      const title=d.createElement("h2"),help=d.createElement("p"),status=d.createElement("p"),code=d.createElement("code"),link=d.createElement("a"),start=d.createElement("button"),close=d.createElement("button");
      title.textContent="Compte Codex de cette agence";title.className="mb-3 text-lg font-semibold";
      help.textContent="Connectez le compte ChatGPT autorisé pour cette agence. La connexion reste dans son runtime dédié.";help.className="mb-4 text-sm";
      status.setAttribute("role","status");status.className="my-3 text-sm";
      code.className="my-3 block text-xl font-semibold";link.textContent="Ouvrir la connexion ChatGPT";link.className="my-3 block underline";link.target="_blank";link.rel="noopener noreferrer";link.hidden=true;
      start.type="button";start.textContent="Se connecter avec ChatGPT";start.className="mr-3 rounded-xl border px-3 py-2 text-sm";
      close.type="button";close.textContent="Fermer";close.className="rounded-xl border px-3 py-2 text-sm";
      let closed=false,connected=false,loginId=null,timer=null;
      const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);overlay.remove();if(loginId&&!connected)void json("/cockpit-sessions/v1/account/codex/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({loginId})}).catch(()=>{});};
      closeAccountDialog=stop;close.onclick=stop;overlay.addEventListener("keydown",event=>{if(event.key==="Escape")stop();});
      const poll=async()=>{
        if(closed)return;
        try{const account=await json("/cockpit-sessions/v1/account/codex/status");
          if(closed)return;
          if(account.connected){connected=true;status.textContent="Compte connecté. Vous pouvez sélectionner un modèle payant.";setConnection(chat,"codex","company-codex");connection.dataset.label="Codex · "+(account.email||"Compte de l’agence");label();return;}
          timer=setTimeout(poll,3000);
        }catch{if(!closed)status.textContent="La vérification est indisponible. Fermez puis réessayez.";}
      };
      start.onclick=async()=>{
        start.disabled=true;status.textContent="Préparation de la connexion…";
        try{const result=await json("/cockpit-sessions/v1/account/codex/login",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
          if(result.verificationUrl!=="https://auth.openai.com/codex/device"||typeof result.loginId!=="string"||!result.loginId||!/^[A-Z0-9-]{4,20}$/.test(result.userCode||""))throw Error("Réponse de connexion invalide");
          loginId=result.loginId;
          if(closed){void json("/cockpit-sessions/v1/account/codex/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({loginId})}).catch(()=>{});return;}
          code.textContent=result.userCode;link.href=result.verificationUrl;link.hidden=false;status.textContent="Ouvrez ChatGPT et saisissez ce code pour autoriser la connexion.";void poll();
        }catch(error){if(!closed){status.textContent=error.message;start.disabled=false;}}
      };
      panel.append(title,help,status,code,link,start,close);overlay.append(panel);d.body.append(overlay);start.focus();
    };
    const showConnections = async (event) => {
      event.preventDefault();event.stopPropagation();if(!["codex","claude"].includes(harness(chat)))return;
      if(connectionMenu.style.display==="block"){connectionMenu.style.display="none";return;}
      connectionMenu.textContent="Chargement\u2026";connectionMenu.style.visibility="hidden";connectionMenu.style.display="block";
      const position=()=>{const rect=connection.getBoundingClientRect(),viewport=d.defaultView;connectionMenu.style.left=Math.min(Math.max(8,rect.left),viewport.innerWidth-connectionMenu.offsetWidth-8)+"px";connectionMenu.style.top=(rect.bottom+connectionMenu.offsetHeight+8<=viewport.innerHeight?rect.bottom+8:Math.max(8,rect.top-connectionMenu.offsetHeight-8))+"px";connectionMenu.style.visibility="visible";};position();
      try{const response=await json("/cockpit-sessions/v1/connections?harness="+encodeURIComponent(harness(chat))),items=response.items||[];connectionMenu.replaceChildren(...items.map(item=>{const option=d.createElement("button");option.type="button";option.className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800";const title=d.createElement("span");title.className="min-w-0 flex-1 truncate";title.textContent=item.label;option.append(title);if(item.id===selectedConnection(chat,harness(chat))){const check=d.createElement("span");check.textContent="\u2713";check.className="text-violet-500";option.append(check);}option.onclick=e=>{e.preventDefault();e.stopPropagation();setConnection(chat,harness(chat),item.id);connection.dataset.label=item.label;label();connectionMenu.style.display="none";toast("Session s\u00e9lectionn\u00e9e : la prochaine r\u00e9ponse utilisera "+item.label+".");};return option;}));if(!items.length)connectionMenu.textContent="Aucune session disponible";if(response.canConnect&&harness(chat)==="codex"){const connect=d.createElement("button");connect.type="button";connect.className="flex w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800";connect.textContent="Connecter le compte Codex de cette agence";connect.onclick=()=>{connectionMenu.style.display="none";connectCompanyAccount();};connectionMenu.append(connect);}position();}catch(error){connectionMenu.textContent=error.message;position();}
    };
    connection.addEventListener("click",showConnections,true);connection.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" ")void showConnections(event);},true);
    execution.addEventListener("click",async event=>{
      event.preventDefault();event.stopPropagation();
      try {
        const {items=[]}=await json("/cockpit-sessions/v1/execution-targets");
        const next=selectedExecution(chat)==="host"?"computer":"host";
        if(!items.some(item=>item.id===next))throw Error("Computer n’est pas disponible sur cette instance.");
        localStorage.setItem("owv:execution:"+PROFILE+":"+chat,next);
        localStorage.setItem("owv:execution:"+PROFILE+":last",next);label();
      }catch(error){toast(error.message);}
    },true);
    const host = native.closest("[data-chat-selector-bar]") || native.parentElement;
    let modelAnchor=native;while(modelAnchor.parentElement!==host)modelAnchor=modelAnchor.parentElement;
    const hostStyle = host.getAttribute("style"), nativeStyle = native.getAttribute("style"), nativeLabel = native.getAttribute("aria-label"), nativeTitle = native.getAttribute("title");
    const nativeText=native.querySelector('span.min-w-0'),nativeTextStyle=nativeText?.getAttribute('style');
    // The selector bar stays in its Svelte-owned location across Workspace navigation.
    // Moving it out of the composer breaks the native component lifecycle.
    host.dataset.owvComposerControls = "1";
    host.insertBefore(b, modelAnchor);
    host.insertBefore(connection, modelAnchor);
    host.insertBefore(execution,modelAnchor);
    host.style.display = "flex";
    host.style.width = "100%";
    host.style.flex = "1 1 auto";
    host.style.alignItems = "center";
    host.style.gap = "0.25rem";
    host.style.flexWrap = "wrap";
    execution.style.cssText="flex:1 1 9rem;width:auto;max-width:100%;min-width:0";
    b.style.cssText = "flex:1 1 9rem;width:auto;max-width:100%;min-width:0";
    connection.style.cssText = "flex:1 1 9rem;width:auto;max-width:100%;min-width:0";
    native.style.cssText = "flex:1 1 12rem;width:auto;max-width:100%;min-width:0";
    for(const control of [b,connection,execution,native]){
      const text=control.querySelector('span.min-w-0');if(text)text.style.cssText='min-width:0;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere';
    }
    d.body.append(menu,connectionMenu);
    if(["codex","claude"].includes(harness(chat)))void json("/cockpit-sessions/v1/connections?harness="+encodeURIComponent(harness(chat))).then(response=>{const item=response.items?.find(x=>x.id===selectedConnection(chat,harness(chat)))||response.items?.[0];if(item){if(!selectedConnection(chat,harness(chat)))setConnection(chat,harness(chat),item.id);connection.dataset.label=item.label;label();}}).catch(()=>{});
    // Keep the Open WebUI model button and its visual language, but route its
    // catalogue through the selected harness. The two compact chips mirror the
    // native category filter rather than adding a second settings surface.
    const modelMenu = d.createElement("div");
    modelMenu.className = "z-50 w-[32rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 dark:text-white";
    modelMenu.style.cssText = "display:none;position:fixed;z-index:10000";
    const closeModels = () => modelMenu.style.display = "none";
    const showModels = async (event) => {
      const activeHarness = harness(chat);
      if (activeHarness === "owv") return;
      event.preventDefault();
      event.stopPropagation();
      const wasOpen = modelMenu.style.display === "block";
      if (wasOpen) return closeModels();
      modelMenu.replaceChildren();
      const head = d.createElement("div");
      head.className = "flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800";
      const search = d.createElement("input");
      search.placeholder = "Search a model";
      search.className = "h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-gray-400";
      const free = d.createElement("button"), plans = d.createElement("button");
      for (const [node, text] of [[free, "Gratuits"], [plans, "Payants"]]) { node.type = "button"; node.textContent = text; node.className = "rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"; }
      head.append(search, free, plans);
      const list = d.createElement("div");
      list.className = "max-h-[26rem] overflow-y-auto p-1";
      list.style.maxHeight = "min(26rem, calc(100vh - 10rem))";
      list.style.overflowY = "auto";
      modelMenu.append(head, list);
      let mode = "plans", models = [], requestId = 0;
      const render = () => {
        const query = search.value.trim().toLowerCase();
        const chosen = selectedModel(chat, activeHarness);
        const rows = models.filter(model => !query || (model.label + " " + model.id).toLowerCase().includes(query));
        list.replaceChildren(...rows.map(model => {
          const option = d.createElement("button"); option.type = "button";
          option.className = "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800";
          const body = d.createElement("span"); body.className = "min-w-0 flex-1";
          const title = d.createElement("span"); title.className = "block truncate text-sm font-medium"; title.textContent = model.label || model.id;
          const detail = d.createElement("span"); detail.className = "block truncate text-xs text-gray-500"; detail.textContent = model.description || model.id;
          body.append(title, detail); option.append(body);
          if (model.id === chosen) { const check = d.createElement("span"); check.textContent = "✓"; check.className = "text-sm text-violet-500"; option.append(check); }
          option.addEventListener("click", () => setSource(chat, activeHarness, model.source), true);
          option.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setModel(chat, activeHarness, model.id); localStorage.removeItem(key(chat, activeHarness)); const value=native.querySelector("span.min-w-0") || native.querySelector(".inline-flex"); if(value)value.textContent=model.label || model.id; native.setAttribute('aria-label','Selected model: '+(model.label || model.id)); toast("Modèle sélectionné : la prochaine réponse ouvrira sa session dédiée."); closeModels(); }, true);
          return option;
        }));
      };
      const load = async () => {
        const current=++requestId, source=mode==='plans'?'plan':'free';
        list.textContent = "Chargement…";
        const response=await json(source==='plan'?"/cockpit-sessions/v1/models?harness="+encodeURIComponent(activeHarness):"/cockpit-sessions/v1/catalog");
        if(current!==requestId)return;
        models=(response.models||[]).map(model=>({...model,source}));
        render();
        position();
      };
      free.onclick = e => { e.preventDefault(); mode = "free"; void load(); };
      plans.onclick = e => { e.preventDefault(); mode = "plans"; void load(); };
      search.oninput = render;
      modelMenu.style.visibility = "hidden"; modelMenu.style.display = "block";
      const position = () => { const rect = native.getBoundingClientRect(), viewport=d.defaultView; modelMenu.style.left = Math.min(Math.max(8, rect.right - modelMenu.offsetWidth), viewport.innerWidth - modelMenu.offsetWidth - 8) + "px"; modelMenu.style.top = (rect.bottom + modelMenu.offsetHeight + 8 <= viewport.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - modelMenu.offsetHeight - 8)) + "px"; modelMenu.style.visibility = "visible"; };
      try { await load(); } catch (error) { list.textContent = "Catalogue indisponible"; }
      search.focus();
    };
    native.addEventListener("click", showModels, options);
    native.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") void showModels(event); }, options);
    d.body.append(modelMenu);
    if (!STANDALONE) d.addEventListener("keydown", (e) => {
      const input = e.target.closest?.("#chat-input");
      if (
        e.key === "Enter" && !e.shiftKey && !d.querySelector("[data-cli-commands-open]") && input && ["codex", "claude"].includes(harness(chat))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        run(f, input);
      }
    }, options);
    mounts.set(d,{chat,native,dispose(){closeAccountDialog();lifecycle.abort();d.querySelectorAll("[data-owv-request-chat]").forEach(panel=>{if(panel.dataset.owvRequestChat===chat)panel.remove();});b.remove();connection.remove();execution.remove();menu.remove();connectionMenu.remove();modelMenu.remove();
      delete host.dataset.owvComposerControls;
      if(nativeText){if(nativeTextStyle===null)nativeText.removeAttribute('style');else if(nativeTextStyle!==undefined)nativeText.setAttribute('style',nativeTextStyle);}
      if(nativeTitle===null)native.removeAttribute('title');else native.setAttribute('title',nativeTitle);
      if(hostStyle===null)host.removeAttribute("style");else host.setAttribute("style",hostStyle);
      if(nativeStyle===null)native.removeAttribute("style");else native.setAttribute("style",nativeStyle);
      if(nativeLabel===null)native.removeAttribute("aria-label");else native.setAttribute("aria-label",nativeLabel);
      const value=native.querySelector('span.min-w-0')||native.querySelector('.inline-flex');if(value)value.textContent=originalModelLabel;
    }});
    void resumePending(f, chat);
  }
  function tick() {
    const frames = STANDALONE ? [NATIVE_RUNTIME.frame] : document.querySelectorAll("#panes iframe");
    frames.forEach((f) => {
      try {
        mount(f);
      } catch {}
    });
  }
  const observer = new MutationObserver(tick);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  const timer = setInterval(tick, 600);
  if (STANDALONE) NATIVE_RUNTIME.controls = {
    selected: chat => harness(chat),
    selection: chat => {const h=harness(chat);return {harness:h,model:selectedModel(chat,h),source:selectedSource(chat,h)};},
    promoteDraft(chat) {
      const prefixes=["owv:harness:","owv:connection:","owv:session:","owv:model:","owv:model-source:","owv:execution:"];
      const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i));
      for(const old of keys)if(prefixes.some(prefix=>old?.startsWith(prefix))&&old.includes(":"+PROFILE+":new")) {
        const next=old.replace(new RegExp(":new(?=:|$)"),":"+chat);
        if(next!==old){localStorage.setItem(next,localStorage.getItem(old));localStorage.removeItem(old);}
      }
    },
    submit: (chat,prompt,accepted,files=[]) => run(NATIVE_RUNTIME.frame,{innerText:prompt,files,dispatchEvent(){accepted?.();}}),
    async interrupt(chat) {
      const pending = JSON.parse(localStorage.getItem(pendingTurnKey(chat)) || "null");
      if (!pending?.sid || !pending?.turnId) throw Error("Aucun tour CLI actif à interrompre.");
      return json("/cockpit-sessions/v1/sessions/"+encodeURIComponent(pending.sid)+"/interrupt",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({turnId:pending.turnId})});
    },
    dispose(){clearInterval(timer);observer.disconnect();disposeMount(document);}
  };
  tick();
const __oc = document.createElement("script");
__oc.src = window.owvNativeHarness ? "/harness/opencode-ui.js" : "/cockpit/opencode-ui.js?v=acp-20260927-2";
if (!window.owvNativeHarness) document.head.append(__oc);
(()=>{const runtime=document.currentScript?.__owvNativeRuntime || window.owvNativeHarness;if(runtime?.disposed)return;const script=document.createElement("script");script.__owvNativeRuntime=runtime;script.src=runtime?"/harness/commands-ui.js":"/cockpit/commands-ui.js?v=commands-20260927-4";script.onload=()=>script.remove();document.head.append(script);})();

})();
