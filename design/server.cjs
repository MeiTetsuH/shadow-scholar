/* Static, localhost-only design workbench. Does not ship in release archives. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const allowed=new Set(['sidepanel.html','sidepanel.css','sidepanel.js','popup.html','popup.css','popup.js','i18n.js','prompts.js','settings.js','ui-icons.js','lib/marked.min.js','markdown.js','content.js','extractors.js',...Object.values(manifest.icons),'icons/icon1024.png','icons/logo.svg','_locales/en/messages.json','_locales/zh_CN/messages.json']);
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let name=url.pathname.slice(1)||'design/showcase.html';
 if(name==='preview-answer'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});const chunks=['## A reading note\n\n','**Understanding grows through connections.**\n\n','Pause, restate the idea, and connect it to one example.'];let i=0;const timer=setInterval(()=>{if(i<chunks.length)res.write(chunks[i++]);else{clearInterval(timer);res.end();}},80);req.on('close',()=>clearInterval(timer));return;}
 if(!allowed.has(name)&&!/^design\/(inline\.html|showcase\.html|showcase\.css|showcase\.js|preview-shim\.js)$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.join(root,name);if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 let body=fs.readFileSync(file);
 if(name==='design/preview-shim.js'){const locales={zh:JSON.parse(fs.readFileSync(path.join(root,'_locales/zh_CN/messages.json'))),en:JSON.parse(fs.readFileSync(path.join(root,'_locales/en/messages.json')))};body=Buffer.from(body.toString().replace('PREVIEW_LOCALES',JSON.stringify(locales)));}
 if(name==='sidepanel.html')body=Buffer.from(body.toString().replace('<script src="i18n.js">','<script src="/design/preview-shim.js"></script><script src="i18n.js">'));
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'Content-Type':(mime[path.extname(file)]||'text/plain')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
});
server.listen(11438,'127.0.0.1',()=>console.log('Design preview: http://localhost:11438'));
