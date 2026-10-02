const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const src=fs.readFileSync(require('node:path').join(__dirname,'../src/lib/components/chat/Chat.svelte'),'utf8');
const router=fs.readFileSync(require('node:path').join(__dirname,'../backend/open_webui/routers/chats.py'),'utf8');
const model=fs.readFileSync(require('node:path').join(__dirname,'../backend/open_webui/models/chats.py'),'utf8');
test('targeted completion keeps canonical history and refresh snapshot consistent',()=>{
 assert.match(router,/statusHistory: list\[dict\] \| None = None/);
 assert.match(model,/chat\['messages'\]\[index\] = \{\*\*listed_message, \*\*message\}/);
});
test('native message event receives completion without changing legacy content-only semantics',()=>{
 const start=src.indexOf("} else if (type === 'chat:message' || type === 'replace') {");
 const body=src.slice(src.indexOf('{',start)+1,src.indexOf("} else if (type === 'chat:message:files'",start));
 const context={message:{content:'pending',done:false},data:{content:'final',done:true}};
 vm.createContext(context);vm.runInContext(body,context);
 assert.equal(context.message.done,true);assert.equal(context.message.content,'final');
 context.data={content:'edit'};vm.runInContext(body,context);assert.equal(context.message.done,true);
 context.data={content:'pending',done:false};vm.runInContext(body,context);assert.equal(context.message.done,false);
});
function fixture(){
 let resolve,reject,n=0;
 const initial=new Promise((a,b)=>{resolve=a;reject=b;});
 const calls=[],audioEvents=[];
 const context={eventTarget:{dispatchEvent:e=>audioEvents.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchCallOverlayAudio:(m,final)=>audioEvents.push({type:'audio',id:m.id,content:m.content,final}),$settings:{},$showCallOverlay:false,history:{messages:{},currentId:null},$chatId:'A',$temporaryChatEnabled:false,chat:null,uuidv4:()=>String(++n),localStorage:{token:'test'},WEBUI_API_BASE_URL:'/api/v1',hasPendingAssistantLeaf:()=>false,createMessagesList:h=>Object.values(h.messages),updateChatById:async(id,chat,body)=>{calls.push({chat,body});return initial;},fetch:async(url,options)=>{calls.push({url,options});return {ok:true};}};
 vm.createContext(context);
 const part=src.slice(src.indexOf('\tlet harnessTurnActive ='),src.indexOf('\tonMount(() => {',src.indexOf('\tlet harnessTurnActive =')));
 vm.runInContext(ts.transpileModule(part+';this.bridge=harnessChatBridge;',{}).outputText,context);
 return {context,calls,resolve,reject,audioEvents};
}
const request={chatId:'A',prompt:'hello',name:'Codex',model:'test-model'};
test('native state and a recoverable in-progress marker persist before completion',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.resolve({id:'A'});const turn=await p;
 assert.equal(f.context.history.messages['2'].done,false);
 assert.equal(turn.messageId,'2');
 assert.equal(f.calls[0].body.history.messages['2'].done,false);
 assert.equal(f.calls[0].body.history.messages['2'].statusHistory[0].description,'Travail Codex en cours…');
 turn.update('partial');assert.equal(f.context.history.messages['2'].content,'partial');
 await turn.finish('final');assert.equal(f.context.history.messages['2'].done,true);
 assert.equal(f.calls[1].url,'/api/v1/chats/A/messages/2');assert.deepEqual(JSON.parse(f.calls[1].options.body),{content:'final',done:true,statusHistory:[]});
});
test('refresh can attach to the persisted assistant message and finish it',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.resolve({id:'A'});const first=await p;
 await first.finish('initial');
 f.context.history.messages['2']={...f.context.history.messages['2'],content:'checkpoint',done:false};
 const resumed=await f.context.bridge.resume({chatId:'A',messageId:'2'});
 assert.equal(resumed.content,'checkpoint');
 resumed.status('Reprise du travail…');
 await resumed.finish('final after refresh');
 assert.equal(f.context.history.messages['2'].content,'final after refresh');
 assert.equal(f.calls.at(-1).url,'/api/v1/chats/A/messages/2');
});
test('an active goal without local pending metadata can resume the latest assistant message',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.resolve({id:'A'});const first=await p;
 await first.finish('checkpoint');
 const resumed=await f.context.bridge.resumeLatest({chatId:'A'});
 assert.equal(resumed.messageId,'2');assert.equal(resumed.content,'checkpoint');
 resumed.update('checkpoint\n\ncontinued');await resumed.finish('checkpoint\n\ncontinued');
 assert.equal(f.context.history.messages['2'].content,'checkpoint\n\ncontinued');
});
test('navigation during failed initial save never injects A into B',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.context.$chatId='B';f.context.history={messages:{},currentId:null};f.reject(Error('disk'));
 await assert.rejects(p,/disk/);assert.deepEqual(f.context.history,{messages:{},currentId:null});
});
test('navigation during successful save does not replace native chat B',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.context.$chatId='B';f.context.chat={id:'B'};f.context.history={messages:{},currentId:null};f.resolve({id:'A'});const turn=await p;
 assert.equal(f.context.chat.id,'B');turn.update('partial');await turn.finish('done');
 assert.equal(Object.keys(f.context.history.messages).length,0);assert.equal(f.calls[1].url,'/api/v1/chats/A/messages/2');
});
test('overlapping turn and duplicate finish are rejected',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);await assert.rejects(f.context.bridge.begin(request),/déjà/);f.resolve({id:'A'});const turn=await p;await turn.finish('done');await assert.rejects(turn.finish('again'),/terminé/);
});

test('CLI activities preserve deltas and complete output through save and resume',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.resolve({id:'A'});const turn=await p;
 turn.activity({id:'cmd',title:'Commande',command:'printf proof',status:'running',output:''});
 turn.activity({id:'cmd',outputDelta:'partial'});
 assert.equal(f.context.history.messages['2'].cliActivities[0].output,'partial');
 turn.activity({id:'cmd',output:'complete proof',status:'completed',exitCode:0});
 await turn.finish('done');
 const saved=JSON.parse(f.calls.at(-1).options.body).cliActivities;
 assert.equal(saved.length,1);assert.equal(saved[0].output,'complete proof');assert.equal(saved[0].command,'printf proof');
 const resumed=await f.context.bridge.resume({chatId:'A',messageId:'2'});
 resumed.activity({id:'cmd',status:'completed'});await resumed.finish('done');
 assert.equal(JSON.parse(f.calls.at(-1).options.body).cliActivities.length,1);
});
test('attachment-only turn preserves the original empty user prompt and uploaded file',async()=>{
 const f=fixture(),files=[{id:'uploaded-file',name:'image.png',type:'image'}];
 const p=f.context.bridge.begin({...request,prompt:'',files});f.resolve({id:'A'});const turn=await p;
 assert.equal(f.context.history.messages['1'].content,'');
 assert.equal(f.context.history.messages['1'].files[0].id,'uploaded-file');
 assert.equal(f.calls[0].body.history.messages['1'].files[0].id,'uploaded-file');
 await turn.finish('Image inspected');
 const empty=fixture();await assert.rejects(empty.context.bridge.begin({...request,prompt:'',files:[]}),/Tour CLI invalide/);
});

test('CLI response emits native voice lifecycle and streams audio only in its originating chat',async()=>{
 const f=fixture(),p=f.context.bridge.begin(request);f.resolve({id:'A'});const turn=await p;
 assert.equal(f.audioEvents[0].type,'chat:start');assert.equal(f.audioEvents[0].detail.id,turn.messageId);
 turn.update('First sentence.');assert.equal(f.audioEvents.at(-1).type,'audio');assert.equal(f.audioEvents.at(-1).final,false);
 await turn.finish('Final sentence.');assert.equal(f.audioEvents.at(-2).final,true);assert.equal(f.audioEvents.at(-1).type,'chat:finish');
 const g=fixture(),pending=g.context.bridge.begin(request);g.resolve({id:'A'});const other=await pending;g.context.$chatId='B';g.audioEvents.length=0;
 other.update('Foreign content');await other.finish('Foreign final');assert.equal(g.audioEvents.length,0);
});
