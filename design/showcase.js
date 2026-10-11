/* Deterministic store artboards using the real extension interface. */
const query=new URLSearchParams(location.search), en=query.get('lang')==='en', slide=query.get('slide')||'1';
const copy={
 '1':en?['01 / A READING COMPANION','Stay curious.\nStay on the page.','Understand a passage without losing your place. A quiet AI companion for the way you read.',['Explain selected text','Follow an idea in the side panel','Read the visible page with vision AI'],'Connect your chosen AI service. Cloud requests send content to that service.']:['01 / 阅读，从容一点','把好奇心，\n留在这一页。','选中一段文字，读懂一个观点。\n让 AI 留在手边，让注意力回到阅读。',['划词解读，即选即问','侧栏对话，顺着思路继续','截图阅读，看懂可见页面'],'连接你选择的 AI 服务。使用远程模型时，内容会发送给该服务商。'],
 '2':en?['02 / ROOM TO UNDERSTAND','A passage.\nA conversation.','Turn an unfamiliar idea into something you can explain. Ask, connect, and keep thinking.',['Clear, readable streaming answers','Explanations or guided hints','Copy an answer and carry it forward'],'Interface shown with an illustrative response. Answers depend on your chosen model.']:['02 / 给理解，多一点空间','从一段文字，\n到一次理解。','看清重点，接着追问。\n用自己的节奏，把新知识变成自己的语言。',['流式回答，清晰易读','完整解读，或只给思路','复制答案，继续你的笔记'],'画面使用示例内容。实际回答由你选择的模型生成。'],
 '3':en?['03 / YOUR MODEL, YOUR CHOICE','Local model.\nLocal content.','Connect Ollama on your computer to keep your reading on your own desk.',['Local: localhost:11434/v1','Cloud: your chosen compatible API','Clear saved answers in Settings'],'Content stays local only when the model runs on this computer and the server does not forward requests to the cloud. Cloud models receive the content you send.']:['03 / 模型与数据，由你选择','本地模型，\n内容留在本机。','连接本机 Ollama 等本地模型，\n为阅读保留一个属于自己的空间。',['本地：localhost:11434/v1','远程：自选 OpenAI 兼容服务','设置中随时清除本地问答'],'仅当服务在本机运行，且不把请求转发到云端时成立。使用远程模型时，内容会发送给你配置的服务商。']
}[slide];
document.documentElement.lang=en?'en':'zh-CN';document.body.className=(en?'en ':'')+(slide==='3'?'local':'');
['eyebrow','headline','description'].forEach((id,i)=>document.getElementById(id).textContent=copy[i]);
const list=document.getElementById('feature-list');copy[3].forEach((text,i)=>{const row=document.createElement('div'),num=document.createElement('b'),label=document.createElement('span');num.textContent='0'+(i+1);label.textContent=text;row.append(num,label);list.append(row);});
document.getElementById('footnote').textContent=copy[4];
document.getElementById('preview-panel').src='/sidepanel.html?lang='+(en?'en':'zh')+'&sample='+(slide==='1'?'welcome':slide==='2'?'chat':'settings');
document.getElementById('browser-caption').textContent=slide==='3'?'Shadow Scholar / Settings':'Reading notes / Shadow Scholar';
document.getElementById('article-title').textContent=en?'Read slowly.\nThink clearly.':'慢慢读，\n才能读进去。';
document.getElementById('article-lead').textContent=en?'A short note on reading with attention, asking better questions, and making space for ideas.':'阅读不只是接收信息，也是把新的观点，和已经知道的事物重新连接。';
document.getElementById('article-subtitle').textContent=en?'Leave a question in the margin.':'在页边，留下一个问题。';
document.getElementById('article-body').textContent=en?'Pause after a passage. Restate it in your own words. Find a connection to an everyday example.':'读完一段，不必急着继续。试着用自己的话复述，再找一个身边的例子，让理解真正发生。';
document.getElementById('footer-note').textContent=en?'YOUR CHOSEN AI · NO DEVELOPER BACKEND':'自选 AI 服务 · 开发者不接收对话内容';document.getElementById('page-number').textContent='0'+slide+' / 03';
