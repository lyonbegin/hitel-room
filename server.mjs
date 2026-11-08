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
const zocboOriginalEventJs=readFileSync('./public/zocbo-original-event.js');
const zocboOriginalEventCss=readFileSync('./public/zocbo-original-event.css');
const zocboInlineRuntimeJs=readFileSync('./public/zocbo-inline-runtime.js');
const zocboInlineRuntimeCss=readFileSync('./public/zocbo-inline-runtime.css');
const zocboLiveBankJs=readFileSync('./public/zocbo-live-bank.js');
const zocboLiveBankCss=readFileSync('./public/zocbo-live-bank.css');

/**
 * Read-only anonymous source-backed metadata adapter.
 * Only the two official exam-list modes are allowed.
 * No user cookies, identity, download tokens, or files leave/enter this adapter.
 */
const zocboCache=new Map();
const zocboHitTimes=new Map();
const zocboModes={M:'000010000200003',H:'000020000200003'};
function zocboFields(url){
 const site=String(url.searchParams.get('site')||'H').toUpperCase();
 const grade=String(url.searchParams.get('grade')||'1');
 const subject=String(url.searchParams.get('subject')||'MT').toUpperCase();
 if(!Object.hasOwn(zocboModes,site)|| !/^[123]$/.test(grade) || (site==='H'&&grade==='3') || !/^[A-Z0-9]{2,5}$/.test(subject))return null;
 return {site,grade,subject,menu:zocboModes[site]};
}
function safeString(v,max=160){return String(v??'').slice(0,max)}
function sourceInfoRow(item,kind){
 if(!item||typeof item!=='object')return null;
 if(kind==='exam')return {
  id:safeString(item.EXPAPR_NO,45),title:safeString(item.EXPAPR_NAME||item.EXPAPR_NM,180),
  sequence:Number(item.SEQ)||0,
  group:safeString(item.EXPAPR_GROUP_CD,24),level:safeString(item.EXPAPR_LEVEL_CD,8),
  rootPart:safeString(item.ROOT_PART_CD,30),subPart:safeString(item.SUB_PART_CD,30),
  detailPart:safeString(item.DETAIL_PART_CD,30),
  rootName:safeString(item.ROOT_PART_NM,120),
  subName:safeString(item.SUB_PART_NM,120),
  detailName:safeString(item.DETAIL_PART_NAME,120),
  episode:safeString(item.EXAM_EPISODE,20),
  textbook:safeString(item.EXPAPR_TX_NAME,100),
  publicGroup:safeString(item.APP_GROUP_TEXT,100),
  examTerm:safeString(item.EXPAPR_ADD_ATTR2,30)
 };
 return {
  root:safeString(item.ROOT_PART_NM||item.ROOT_PART_NAME,120),
  sub:safeString(item.SUB_PART_NM||item.SUB_PART_NAME,120),
  detail:safeString(item.DETAIL_PART_NM||item.DETAIL_PART_NAME,120),
  rootCode:safeString(item.ROOT_PART_CD,30),
  subCode:safeString(item.SUB_PART_CD,30),
  detailCode:safeString(item.DETAIL_PART_CD,30)
 };
}
async function zocboReadPublic(originPath,form,referrer){
 const ctl=new AbortController();
 const t=setTimeout(()=>ctl.abort(),11000);
 try{
  const r=await fetch('https://m.zocbo.com'+originPath,{
   method:'POST',redirect:'error',signal:ctl.signal,
   headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','Accept':'application/json,text/javascript,*/*;q=0.01','X-Requested-With':'XMLHttpRequest','Referer':referrer,'Origin':'https://m.zocbo.com','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'},
   body:new URLSearchParams(form).toString()
  });
  if(!r.ok)throw new Error('ORIGIN_HTTP_'+r.status);
  const raw=await r.text();
  if(raw.length>4_000_000)throw new Error('ORIGIN_RESPONSE_TOO_LARGE');
  let payload;try{payload=JSON.parse(raw)}catch{throw new Error('ORIGIN_NOT_JSON')}
  if(!payload||typeof payload!=='object'||payload.RESULT==='false')throw new Error('ORIGIN_DATA_REJECTED');
  return payload;
 }finally{clearTimeout(t)}
}
async function serveZocboPublicCatalog(url,req,send){
 const q=zocboFields(url);
 if(!q){send(400,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'INVALID_FILTER'}));return}
 const key=[q.site,q.grade,q.subject].join(':');
 const cached=zocboCache.get(key);
 if(cached&&Date.now()-cached.at<120_000){send(200,'application/json; charset=utf-8',cached.json);return}
 const ip=String(req.socket.remoteAddress||'unknown');
 const bucket=(zocboHitTimes.get(ip)||[]).filter(v=>Date.now()-v<60_000);
 if(bucket.length>=25){send(429,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'RATE_LIMIT'}));return}
 bucket.push(Date.now());zocboHitTimes.set(ip,bucket);
 if(zocboHitTimes.size>250)zocboHitTimes.clear();
 const referrer='https://m.zocbo.com/exam/examListWeb.asp?'+new URLSearchParams({menu_cd:q.menu,siteid:q.site,subject_cd:q.subject,grade:q.grade});
 try{
  const filterInfo=await zocboReadPublic('/exam/ajax/getMenuByFilterAjax.asp',{menuCD:q.menu,siteID:q.site},referrer);
  const choices=Array.isArray(filterInfo.MENU_BY_EXAM)?filterInfo.MENU_BY_EXAM:[];
  const opts=choices.filter(x=>String(x.SITE_ID)===q.site&&String(x.GRADE)===q.grade&&String(x.SUBJECT_CD)===q.subject&&x.TX_CD);
  const selected=opts.find(x=>String(x.IS_DEFAULT)==='Y'||String(x.IS_DEFAULT)==='1')||opts[0];
  const tx=selected?.TX_CD||((q.subject==='MT')?q.site+'AMTCHA'+q.grade+'001':'');
  const common={
   menu_cd:q.menu,expapr_coretype_cd:'',expapr_group_cd:q.site==='H'?'C|E':'C',
   siteid:q.site,grade:q.grade,subject_cd:q.subject,subject_detail_cd:'',
   tx_cd:tx,root_part_cd:'',level_cd:'2',
   work_author:'',work_title:'',text_book_nm:'',korean_part_work_list:'',
   year_cd:'',vod_type:''
  };
  const [exams,parts]=await Promise.all([
   zocboReadPublic('/exam/ajax/getMenuByExamSearchAjax.asp',{...common,is_part:'1',expapr_no_array:'',expapr_servicetype:'2'},referrer),
   zocboReadPublic('/exam/ajax/getMenuByExamPartAjax.asp',{...common,is_scroll:'0'},referrer)
  ]);
  const subjects=[...new Map(choices.filter(x=>String(x.SITE_ID)===q.site&&String(x.GRADE)===q.grade&&/^[A-Z0-9]{2,5}$/.test(String(x.SUBJECT_CD||''))).map(x=>[String(x.SUBJECT_CD),{code:safeString(x.SUBJECT_CD,5),name:safeString(x.SUBJECT_NM||x.SUBJECT_CD,40)}])).values()];
  const textbooks=[...new Map(opts.filter(x=>x.TX_CD).map(x=>[String(x.TX_CD),{code:safeString(x.TX_CD,60),name:safeString(x.TX_NM||x.TX_CD,65)}])).values()];
  const list=Array.isArray(exams.MENU_BY_EXAM)?exams.MENU_BY_EXAM:[];
  const result={
   ok:true,source:'anonymous-official-mobile',filter:q,
   officialUrl:referrer,examCount:Number(exams.EXAM_COUNT)||list.length,
   subjects,textbooks,selectedTextbook:safeString(tx,60),
   exams:list.slice(0,3000).map(v=>sourceInfoRow(v,'exam')).filter(v=>v&&v.id&&v.title),
   parts:(Array.isArray(parts.MENU_BY_PART)?parts.MENU_BY_PART:[]).slice(0,2000).map(v=>sourceInfoRow(v,'part')).filter(Boolean)
  };
  const json=JSON.stringify(result);
  zocboCache.set(key,{at:Date.now(),json});
  if(zocboCache.size>40)zocboCache.delete(zocboCache.keys().next().value);
  send(200,'application/json; charset=utf-8',json);
 }catch(e){
  send(502,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'UPSTREAM_UNAVAILABLE',reason:safeString(e.message,80)}));
 }
}


const zocboSchoolCache=new Map();
async function serveZocboPublicSchoolOptions(url,send){
 const region=String(url.searchParams.get('si')||'').trim();
 const district=String(url.searchParams.get('gu')||'').trim();
 const gradeSite=String(url.searchParams.get('site')||'M');
 if(!/^[가-힣\s]{1,12}$/.test(region)||!/^[가-힣\s]{0,16}$/.test(district)||!['M','H'].includes(gradeSite)){
  send(400,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'INVALID_SCHOOL_FILTER'}));return
 }
 const k=[gradeSite,region,district].join('|');
 const c=zocboSchoolCache.get(k);
 if(c&&Date.now()-c.at<600000){send(200,'application/json; charset=utf-8',c.json);return}
 try{
  const ref='https://m.zocbo.com/'+gradeSite+'/expected.asp';
  const form=district?{cmd:'GET_SCHOOL_LIST',site_id:gradeSite,si:region,region:district}:{cmd:'GET_REGION_LIST',si:region};
  const result=await zocboReadPublic('/_api/community.api.asp',form,ref);
  const rows=Array.isArray(result.list)?result.list:[];
  const list=rows.slice(0,350).map(x=>district?
    ({name:safeString(x.Scl_Name||x.Name,90),id:safeString(x.Scl_ID||'',32)}):
    ({name:safeString(x.rg_District||x.Name,60)})).filter(x=>x.name);
  const json=JSON.stringify({ok:true,source:'anonymous-original-school-api',site:gradeSite,si:region,gu:district,kind:district?'school':'district',count:list.length,list});
  zocboSchoolCache.set(k,{at:Date.now(),json});
  if(zocboSchoolCache.size>120)zocboSchoolCache.delete(zocboSchoolCache.keys().next().value);
  send(200,'application/json; charset=utf-8',json);
 }catch(e){send(502,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'ORIGINAL_SCHOOL_OPTIONS_UNAVAILABLE',reason:safeString(e.message,120)}))}
}
const originalMenuSlugs=new Set([
 'concept_complete','concept_calculation','unit_level','unit_master',
 'practice_essay','practice_frequent','practice_wrong','practice_top',
 'practice_performance','practice_textbook','final_main','school_expected','gangnam_list'
]);
const originalRawModes={
 concept:'docs/zocbo-original-input/01-middle-concept.html',
 unit:'docs/zocbo-original-input/02-middle-unit.html',
 practice:'docs/zocbo-original-input/03-middle-practice.html',
 gangnam:'docs/zocbo-original-input/04-middle-gangnam.html'
};
const port=Number(process.env.PORT||3000);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
createServer(async (req,res)=>{
 const url=new URL(req.url,'http://localhost');
 function send(status,type,content){res.writeHead(status,{...headers,'Content-Type':type});res.end(content)}
 if(url.pathname==='/api/zocbo/public-catalog'&&req.method==='GET'){await serveZocboPublicCatalog(url,req,send);return}
 if(url.pathname==='/api/zocbo/public-school-options'&&req.method==='GET'){await serveZocboPublicSchoolOptions(url,send);return}
 if(url.pathname==='/api/zocbo/menu-data'&&req.method==='GET'){
  const slug=String(url.searchParams.get('slug')||'');
  if(!originalMenuSlugs.has(slug)){send(400,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'INVALID_MENU'}));return}
  const fn='./public/zocbo-original-data/'+slug+'.json';
  if(!existsSync(fn)){send(404,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'SNAPSHOT_NOT_CAPTURED'}));return}
  send(200,'application/json; charset=utf-8',readFileSync(fn));return
 }
 if(url.pathname==='/api/zocbo/original-html'&&req.method==='GET'){
  const mode=String(url.searchParams.get('mode')||'');
  if(!Object.hasOwn(originalRawModes,mode)){send(400,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'INVALID_MODE'}));return}
  const fn='./'+originalRawModes[mode];
  if(!existsSync(fn)){send(404,'application/json; charset=utf-8',JSON.stringify({ok:false,error:'ORIGINAL_SOURCE_NOT_PRESENT'}));return}
  // Renderable user-supplied DOM reference, never executed as a same-origin HTML document.
  // The client only fetches it and DOMParses it inertly.
  send(200,'text/plain; charset=utf-8',readFileSync(fn));return
 }
 if(url.pathname==='/zocbo-all-menus.js'){send(200,'application/javascript; charset=utf-8',readFileSync('./public/zocbo-all-menus.js'));return}
 if(url.pathname==='/zocbo-all-menus.css'){send(200,'text/css; charset=utf-8',readFileSync('./public/zocbo-all-menus.css'));return}
 if(url.pathname==='/health'){send(200,'application/json; charset=utf-8',JSON.stringify({ok:true,app:'YPT',mock:true,source:'original-XAPK-reverse-analysis',confirmedScreens:3,derivedScreens:65,officialZocboPublicDocuments:35,zocboLiveLinks:true,zocboOriginalInline:true,zocboIframeCount:0,originalSourceCount:35,assetsDir:'ypt-assets'}));return}
 if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/ypt-rebuild.html'){send(200,'text/html; charset=utf-8',yptVisualHtml);return}
 if(url.pathname==='/ypt-mock'){send(200,'text/html; charset=utf-8',yptMockHtml);return}
 if(url.pathname==='/ypt-rebuild.js'){send(200,'application/javascript; charset=utf-8',yptVisualJs);return}
 if(url.pathname==='/ypt-rebuild.css'){send(200,'text/css; charset=utf-8',yptVisualCss);return}
 if(url.pathname==='/ypt-graph.js'){send(200,'application/javascript; charset=utf-8',yptVisualGraph);return}
 if(url.pathname==='/zocbo-integration.js'){send(200,'application/javascript; charset=utf-8',zocboIntegrationJs);return}
 if(url.pathname==='/zocbo-integration.css'){send(200,'text/css; charset=utf-8',zocboIntegrationCss);return}
 if(url.pathname==='/zocbo-catalog.js'){send(200,'application/javascript; charset=utf-8',zocboCatalogJs);return}
 if(url.pathname==='/zocbo-original-event.js'){send(200,'application/javascript; charset=utf-8',zocboOriginalEventJs);return}
 if(url.pathname==='/zocbo-original-event.css'){send(200,'text/css; charset=utf-8',zocboOriginalEventCss);return}
 if(url.pathname==='/zocbo-live-bank.js'){send(200,'application/javascript; charset=utf-8',zocboLiveBankJs);return}
 if(url.pathname==='/zocbo-live-bank.css'){send(200,'text/css; charset=utf-8',zocboLiveBankCss);return}
 if(url.pathname==='/zocbo-inline-runtime.js'){send(200,'application/javascript; charset=utf-8',zocboInlineRuntimeJs);return}
 if(url.pathname==='/zocbo-inline-runtime.css'){send(200,'text/css; charset=utf-8',zocboInlineRuntimeCss);return}
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