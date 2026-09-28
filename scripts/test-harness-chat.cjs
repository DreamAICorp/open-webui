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
 const calls=[];
 const context={history:{messages:{},currentId:null},$chatId:'A',$temporaryChatEnabled:false,chat:null,uuidv4:()=>String(++n),localStorage:{token:'test'},WEBUI_API_BASE_URL:'/api/v1',hasPendingAssistantLeaf:()=>false,createMessagesList:h=>Object.values(h.messages),updateChatById:async(id,chat,body)=>{calls.push({chat,body});return initial;},fetch:async(url,options)=>{calls.push({url,options});return {ok:true};}};
 vm.createContext(context);
 const part=src.slice(src.indexOf('\tlet harnessTurnActive ='),src.indexOf('\tonMount(() => {',src.indexOf('\tlet harnessTurnActive =')));
 vm.runInContext(ts.transpileModule(part+';this.bridge=harnessChatBridge;',{}).outputText,context);
 return {context,calls,resolve,reject};
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
