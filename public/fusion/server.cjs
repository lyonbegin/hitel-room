const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/health'){res.writeHead(200);return res.end('ok')}
let relative=decodeURIComponent(u.pathname);if(relative==='/'||relative==='/fusion/'||relative==='/fusion')relative='/index.html';if(relative.startsWith('/fusion/'))relative=relative.slice(7);
const filename=path.resolve(root,'.'+relative);if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
if(!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);return res.end('Not Found')}
res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(filename).pipe(res)}catch(err){res.writeHead(500);res.end('Server Error')}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('HITEL 4 Source Fusion listening',process.env.PORT||3000));
