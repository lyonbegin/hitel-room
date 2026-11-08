import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
const oldParts=Array.from({length:18},(_,i)=>readFileSync('./public/parts/'+String(i).padStart(2,'0')+'.txt','utf8'));
const legacyHtml=brotliDecompressSync(Buffer.from(oldParts.join(''),'base64'));
const educationHtml=readFileSync('./public/education.html');
const educationJs=readFileSync('./public/education.js');
const yptMockHtml=readFileSync('./public/ypt-original-mock.html');
const yptVisualHtml=readFileSync('./public/ypt-rebuild.html');
const yptVisualJs=readFileSync('./public/ypt-rebuild.js');
const yptVisualCss=readFileSync('./public/ypt-rebuild.css');
const yptVisualGraph=readFileSync('./public/ypt-graph.js');
const zocboIntegrationJs=readFileSync('./public/zocbo-integration.js');
const zocboIntegrationCss=readFileSync('./public/zocbo-integration.css');
const zocboCatalogJs=readFileSync('./public/zocbo-catalog.js');
const port=Number(process.env.PORT||3000);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 function send(status,type,content){res.writeHead(status,{...headers,'Content-Type':type});res.end(content)}
 if(url.pathname==='/health'){send(200,'application/json; charset=utf-8',JSON.stringify({ok:true,app:'YPT',mock:true,source:'original-XAPK-reverse-analysis',confirmedScreens:3,derivedScreens:65,officialZocboPublicDocuments:35,zocboLiveLinks:true,assetsDir:'ypt-assets'}));return}
 if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/ypt-rebuild.html'){send(200,'text/html; charset=utf-8',yptVisualHtml);return}
 if(url.pathname==='/ypt-mock'){send(200,'text/html; charset=utf-8',yptMockHtml);return}
 if(url.pathname==='/ypt-rebuild.js'){send(200,'application/javascript; charset=utf-8',yptVisualJs);return}
 if(url.pathname==='/ypt-rebuild.css'){send(200,'text/css; charset=utf-8',yptVisualCss);return}
 if(url.pathname==='/ypt-graph.js'){send(200,'application/javascript; charset=utf-8',yptVisualGraph);return}
 if(url.pathname==='/zocbo-integration.js'){send(200,'application/javascript; charset=utf-8',zocboIntegrationJs);return}
 if(url.pathname==='/zocbo-integration.css'){send(200,'text/css; charset=utf-8',zocboIntegrationCss);return}
 if(url.pathname==='/zocbo-catalog.js'){send(200,'application/javascript; charset=utf-8',zocboCatalogJs);return}
 if(url.pathname==='/zocbo-assets/app-icon.png'){const p='./public/zocbo-assets/app-icon.png';if(existsSync(p)){send(200,'image/png',readFileSync(p));return}}
 if(url.pathname.startsWith('/ypt-assets/')){
   const relative=url.pathname.slice('/ypt-assets/'.length);
   if(!relative || !/^[a-zA-Z0-9._\/-]+$/.test(relative) || relative.split('/').includes('..')){send(400,'text/plain','invalid path');return}
   const file='./public/ypt-assets/'+relative;
   if(existsSync(file)){const ext=relative.split('.').pop().toLowerCase();const ct=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',json:'application/json',avif:'image/avif'})[ext]||'application/octet-stream';send(200,ct,readFileSync(file));return}
 }
 if(url.pathname==='/8-apps'||url.pathname==='/preview'){send(200,'text/html; charset=utf-8',educationHtml);return}
 if(/^\/assets\/00[0-2]\.png$/.test(url.pathname)) {const path='./public'+url.pathname;if(existsSync(path)){send(200,'image/png',readFileSync(path));return}}
 if(url.pathname==='/education.js'){send(200,'application/javascript; charset=utf-8',educationJs);return}
 if(url.pathname==='/original'){send(200,'text/html; charset=utf-8',legacyHtml);return}
 send(404,'text/plain; charset=utf-8','Not found');
}).listen(port,'0.0.0.0',()=>console.log('HITEL education eight app preview started',port,educationHtml.length,educationJs.length));