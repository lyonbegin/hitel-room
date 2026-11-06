import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
const oldParts=Array.from({length:18},(_,i)=>readFileSync('./public/parts/'+String(i).padStart(2,'0')+'.txt','utf8'));
const legacyHtml=brotliDecompressSync(Buffer.from(oldParts.join(''),'base64'));
const educationHtml=readFileSync('./public/education.html');
const educationJs=readFileSync('./public/education.js');
const port=Number(process.env.PORT||3000);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 function send(status,type,content){res.writeHead(status,{...headers,'Content-Type':type});res.end(content)}
 if(url.pathname==='/health'){send(200,'application/json; charset=utf-8',JSON.stringify({ok:true,apps:8,interactiveUi:true,revision:'8-app-mobile-interactive-20261106',htmlBytes:educationHtml.length,jsBytes:educationJs.length}));return}
 if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/preview'){send(200,'text/html; charset=utf-8',educationHtml);return}
 if(url.pathname==='/education.js'){send(200,'application/javascript; charset=utf-8',educationJs);return}
 if(url.pathname==='/original'){send(200,'text/html; charset=utf-8',legacyHtml);return}
 send(404,'text/plain; charset=utf-8','Not found');
}).listen(port,'0.0.0.0',()=>console.log('HITEL education eight app preview started',port,educationHtml.length,educationJs.length));