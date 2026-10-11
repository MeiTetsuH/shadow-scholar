/* Local visual fixture only. Excluded from the extension ZIP. No external requests. */
const params = new URLSearchParams(location.search);
const previewLanguage = params.get('lang') || 'zh';
const previewSample = params.get('sample') || 'welcome';
const previewMessages = PREVIEW_LOCALES[previewLanguage];
const event = () => { const listeners=[]; return {addListener:f=>listeners.push(f),emit:(...args)=>listeners.forEach(f=>f(...args))}; };
const changes = event();
const previewData = {language:previewLanguage,apiUrl:'http://localhost:11434/v1',model:'gemma3:4b',apiKey:'',dataConsentEndpoint:'http://localhost:11434/v1/chat/completions',mode:'answer'};
const storage = data => ({async get(keys,callback){const value=Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in data).map(k=>[k,data[k]]));callback?.(value);return value;},async set(next,callback){const diff=Object.fromEntries(Object.entries(next).map(([k,v])=>[k,{newValue:v}]));Object.assign(data,next);changes.emit(diff,'local');callback?.();},async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete data[key];}});
const previewAnswer = previewLanguage === 'zh' ? '## 把阅读变成理解\n\n这段文字的重点是：**阅读的价值，在于建立联系。**\n\n1. **停一下**：读完一段，先用自己的话说一遍。\n2. **问一句**：它和你已经知道的事，有什么联系？\n3. **试一次**：找一个具体例子，让抽象的观点落地。\n\n> 不急着翻到下一页，先给这一页留下一个问题。' : '## From reading to understanding\n\nThe central idea: **understanding grows through connections.**\n\n1. **Pause.** Restate a passage in your own words.\n2. **Ask.** How does it relate to something you already know?\n3. **Try.** Find one concrete example of the idea.\n\n> Before turning the page, leave yourself a question.';
window.chrome = {
  runtime:{id:'visual-fixture',getURL:path=>'/'+path,onMessage:event(),sendMessage(msg,callback){let result={success:true};if(msg.type==='get-ui-settings')result={...previewData,messages:previewMessages};if(msg.type==='get-settings')result={...previewData};if(msg.type==='claim-pending-query')result=null;if(msg.type==='get-page-content')result={content:'Reading helps us connect new ideas with what we already understand.',title:'Reading notes'};callback?.(result);return Promise.resolve(result);},connect(){const p={onMessage:event(),onDisconnect:event(),closed:false,async postMessage(){const res=await fetch('/preview-answer');const reader=res.body.getReader();const decoder=new TextDecoder();while(!p.closed){const {value,done}=await reader.read();if(done)break;p.onMessage.emit({type:'chunk',content:decoder.decode(value)});}if(!p.closed)p.onMessage.emit({type:'done'});else reader.cancel();},disconnect(){if(!p.closed){p.closed=true;p.onDisconnect.emit();}}};return p;}},
  i18n:{getMessage:key=>previewMessages[key]?.message||key},storage:{local:storage(previewData),session:storage({}),onChanged:changes},windows:{getCurrent:async()=>({id:1})},tabs:{query:async()=>[{id:1,windowId:1}],sendMessage:async()=>({content:'Reading helps us connect ideas.',title:'Reading notes',text:'Reading helps us connect ideas.'})}
};
document.documentElement.lang=previewLanguage==='zh'?'zh-CN':'en';
window.addEventListener('load',()=>{
 if(previewSample==='chat'){
   document.getElementById('welcome').classList.add('hidden');
   window.addMessage('user',previewLanguage==='zh'?'这段内容应该怎么理解？':'Help me understand this passage.');
   window.addMessage('ai',previewAnswer);
   requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById('chat-area').scrollTop=0; }));
 }
 if(previewSample==='settings')document.getElementById('btn-settings').click();
});
window.previewAnswer=previewAnswer;
