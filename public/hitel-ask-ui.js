/* HITEL universal learning question UI. Text, camera/photo, voice and persistent chat history. */
(function(){
'use strict';
if(!window.HITEL_WORKPLACE_BRIDGE)return;
const bridge=window.HITEL_WORKPLACE_BRIDGE,model=bridge.getModel(),oldTop=topBar,oldRender=renderPhone;
const key='hitel.education.ask.history.v1',esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=()=>{try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x.filter(t=>t&&Array.isArray(t.messages)).slice(0,12):[]}catch{return[]}};
const ui={open:false,hist:false,threads:load(),threadId:'',draft:'',photo:'',thumb:'',photoName:'',notice:'',busy:false,speech:null};
ui.threadId=ui.threads[0]?.id||'';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function save(){try{localStorage.setItem(key,JSON.stringify(ui.threads.slice(0,12).map(t=>({...t,messages:t.messages.slice(-35).map(m=>({...m,thumb:m.thumb?.length<150000?m.thumb:''}))}))))}catch{ui.notice='저장 공간이 부족합니다. 이 기기에서 일부 대화 기록을 저장하지 못했습니다.'}}
function active(){return ui.threads.find(t=>t.id===ui.threadId)||fresh()}
function fresh(){const t={id:uid(),title:'새 질문',date:Date.now(),messages:[]};ui.threads.unshift(t);ui.threadId=t.id;ui.draft='';ui.photo='';ui.thumb='';ui.photoName='';ui.hist=false;save();return t}
function group(){return(model.groups||[]).find(g=>g.id===model.activeGroupId)||null}
function teacher(question=''){
 const g=group();
 const rules=[['수학',/수학|방정식|미분|적분|함수|인수분해|계산|x²|x\^2/i],['영어',/영어|영문|영단어|english|grammar/i],
 ['국어',/국어|문학|비문학|국어문법/i],['과학',/과학|물리|화학|전류/i],['한국사',/한국사|한국역사/i]];
 const sub=rules.find(([_,re])=>re.test(question))?.[0]||String(g?.subject||'').split(/[,·/]/)[0].trim()||'미분류';
 let name='',trainerId='';
 if(g?.coachName&&sub===String(g.subject||'').split(/[,·/]/)[0].trim()){name=g.coachName;trainerId=g.trainerId||g.coachId||'';}
 if(!name){try{const a=JSON.parse(localStorage.getItem('hitel.education.trainers-v1')||'[]');
 const x=Array.isArray(a)?a.find(t=>t.subject===sub):null;if(x){name=x.name;trainerId=x.id;}}catch{}}
 return{subject:sub,teacher:name||'',teacherId:trainerId,group:g?.name||'',screen:state.screen};
}
topBar=function(route){
 if(['welcome','signin','signup'].includes(route)||route.startsWith('external_'))return oldTop(route);
 const source=oldTop(route);const match=source.match(/<h2>([\s\S]*?)<\/h2>/);const title=match?match[1]:'HITEL 교육';
 const root=['groups','groupLearning','groupAITutor','bankSearch','bankExamExplore','settings'].includes(route);
 return '<header class="appbar ask-shell"><div class="ask-head"><div class="ask-title">'+
 (root?'':'<button type="button" data-action="back" class="ask-back" aria-label="뒤로">‹</button>')+
 '<h2>'+title+'</h2></div><div class="ask-head-actions"><button type="button" class="ask-create" data-hc="new">＋ 학습반 만들기</button>'+
 '<button type="button" class="ask-settings" data-go="settings" aria-label="설정">⋯</button></div></div>'+
 '<div class="ask-bar"><button type="button" data-ask="open" class="ask-query"><span>✦</span> 무엇이든 물어보세요</button>'+
 '<button type="button" data-ask="camera" aria-label="교과서·문제집 촬영">📷</button>'+
 '<button type="button" data-ask="voice" aria-label="음성 질문">🎙</button></div></header>';
};
renderPhone=function(){oldRender();if(ui.open)draw()};
function bubble(m){
 return '<div class="ask-bubble '+(m.role==='user'?'ask-user':m.role==='system'?'ask-system':'ask-assistant')+'"><small>'+
 esc(m.role==='user'?'나':m.role==='system'?'연결 상태':m.teacher||'AI 선생님')+'</small>'+
 (m.thumb?'<img src="'+m.thumb+'" alt="'+esc(m.photoName||'질문 사진')+'">':m.photoName?'<div>📷 '+esc(m.photoName)+'</div>':'')+
 '<p>'+esc(m.text||'')+'</p></div>';
}
function draw(){
 const phone=document.getElementById('phone');if(!phone)return;
 phone.querySelector('.ask-modal')?.remove();const t=active(),info=teacher(ui.draft);
 const modal=document.createElement('div');modal.className='ask-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 modal.innerHTML='<div class="ask-panel"><header class="ask-panel-head"><button type="button" data-ask="close" aria-label="닫기">‹</button>'+
 '<div class="ask-panel-name"><strong>AI 선생님에게 질문</strong><small>문제·사진·음성으로 물어보세요</small></div>'+
 '<button type="button" data-ask="history">'+(ui.hist?'대화 보기':'지난 질문')+'</button>'+
 '<button type="button" data-ask="new">＋ 새 질문</button></header>'+
 '<div class="ask-context"><span>'+esc(info.group||'현재 학습 화면')+'</span><span>'+
 esc(info.teacher?'담당 '+info.teacher:info.subject+' 질문')+'</span></div>'+
 '<main class="ask-messages" id="ask-messages">'+
 (ui.hist?'<h3>이 기기에 저장된 질문</h3>'+ui.threads.map(x=>'<button class="ask-thread" type="button" data-ask="thread" data-id="'+esc(x.id)+'"><b>'+
 esc(x.title)+'</b><small>'+new Date(x.date).toLocaleDateString('ko-KR')+'</small></button>').join(''):
 t.messages.length?t.messages.map(bubble).join(''):
 '<div class="ask-empty"><span>✦</span><h3>어떤 부분이 궁금하세요?</h3><p>교과서나 문제집을 촬영하거나 글·음성으로 질문해 보세요.</p>'+
 '<button type="button" data-ask="example" data-text="이 문제의 풀이 과정을 단계별로 알려 주세요.">풀이 과정을 설명해 주세요</button></div>')+'</main>'+
 '<div class="ask-compose">'+(ui.notice?'<div class="ask-notice">'+esc(ui.notice)+'</div>':'')+
 (ui.photo?'<div class="ask-preview"><img alt="첨부 사진" src="'+ui.thumb+'"><span>'+esc(ui.photoName)+'</span>'+
 '<button type="button" data-ask="remove" aria-label="사진 제거">×</button></div>':'')+
 '<div class="ask-editor"><textarea id="ask-text" maxlength="4000" rows="2" placeholder="모르는 부분을 말씀해 주세요...">'+esc(ui.draft)+'</textarea>'+
 '<div class="ask-tools"><button type="button" data-ask="camera" aria-label="사진 촬영">📷</button>'+
 '<button type="button" data-ask="gallery" aria-label="사진 첨부">＋</button>'+
 '<button type="button" data-ask="voice" aria-label="음성 입력">🎙</button>'+
 '<span></span><button class="ask-submit" type="button" data-ask="send"'+(ui.busy?' disabled':'')+'>'+
 (ui.busy?'전송 중':'보내기 ↑')+'</button></div></div>'+
 '<small>질문 기록은 이 브라우저에 보관됩니다. 실제 AI 답변은 서버 연결 상태에 따릅니다.</small></div>'+
 '<input id="ask-camera" type="file" accept="image/*" capture="environment" hidden>'+
 '<input id="ask-gallery" type="file" accept="image/*" hidden></div>';
 phone.appendChild(modal);
 const sc=phone.querySelector('#ask-messages');if(sc)sc.scrollTop=sc.scrollHeight;
}
function show(mode){
 ui.open=true;ui.hist=false;active();draw();
 if(mode==='camera'||mode==='gallery')document.getElementById('ask-'+mode)?.click();
 else if(mode==='voice')voice();
 else document.getElementById('ask-text')?.focus();
}
function dismiss(){ui.open=false;ui.hist=false;try{ui.speech?.stop()}catch{}ui.speech=null;document.getElementById('phone')?.querySelector('.ask-modal')?.remove()}
function compress(file,limit,quality){
 return new Promise((resolve,reject)=>{
  const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{try{const scale=Math.min(1,limit/Math.max(im.naturalWidth,im.naturalHeight));const cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(im.naturalWidth*scale));cv.height=Math.max(1,Math.round(im.naturalHeight*scale));
    cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);resolve(cv.toDataURL('image/jpeg',quality));}
   catch(e){reject(e)}finally{URL.revokeObjectURL(u)}};
  im.onerror=()=>{URL.revokeObjectURL(u);reject(Error('사진 파일을 읽을 수 없습니다.'))};im.src=u;
 });
}
async function photo(file){
 if(!file)return;
 if(!file.type.startsWith('image/')||file.size>12000000){ui.notice='12MB 이하 이미지 파일을 선택해 주세요.';draw();return}
 try{ui.photo=await compress(file,1200,.75);ui.thumb=await compress(file,360,.5);ui.photoName=file.name||'문제 사진';
 if(ui.photo.length>1700000)throw Error('사진 크기를 줄여서 다시 첨부해 주세요.');
 ui.notice='사진이 첨부되었습니다. 질문을 입력하거나 바로 보내실 수 있습니다.';}
 catch(e){ui.photo='';ui.thumb='';ui.photoName='';ui.notice=e.message||'첨부 실패'}
 draw();
}
function voice(){
 if(ui.speech){try{ui.speech.stop()}catch{}return;}
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){ui.notice='현재 브라우저에서 음성 인식을 지원하지 않습니다. 사진이나 글로 질문해 주세요.';draw();return;}
 const sr=new Speech();ui.speech=sr;sr.lang='ko-KR';sr.interimResults=true;sr.continuous=false;
 sr.onresult=ev=>{let t='';for(let i=0;i<ev.results.length;i++)t+=ev.results[i][0]?.transcript||'';ui.draft=t;const a=document.getElementById('ask-text');if(a)a.value=t;};
 sr.onerror=ev=>{ui.notice=ev.error==='not-allowed'?'마이크 사용 권한을 확인해 주세요.':'음성 인식에 실패했습니다.';ui.speech=null;draw();};
 sr.onend=()=>{ui.speech=null;if(ui.open)draw();};
 try{sr.start();ui.notice='말씀하시면 질문창에 음성이 글로 입력됩니다.';draw()}catch{ui.speech=null;ui.notice='음성 인식을 시작할 수 없습니다.';draw()}
}
async function send(){
 if(ui.busy)return;
 const q=ui.draft.trim(),img=ui.photo;if(!q&&!img){ui.notice='질문을 입력하거나 문제 사진을 첨부해 주세요.';draw();return;}
 const t=active(),ctx=teacher(q);const msg={role:'user',text:q||'첨부한 문제 사진의 풀이를 설명해 주세요.',teacher:ctx.teacher,
 thumb:ui.thumb,photoName:ui.photoName,context:ctx.group,date:Date.now()};
 t.messages.push(msg);if(t.title==='새 질문')t.title=(q||'문제 사진 질문').slice(0,40);
 ui.threads=[t,...ui.threads.filter(x=>x.id!==t.id)];ui.photo='';ui.thumb='';ui.photoName='';ui.draft='';ui.busy=true;ui.notice='AI 답변 서버 연결을 확인하고 있습니다.';save();draw();
 try{const turns=t.messages.filter(x=>x.role==='user'||x.role==='assistant').slice(-8).map(x=>({role:x.role,text:x.text}));
  const res=await fetch('/api/education/ask',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({turns,image:img||null,subject:ctx.subject,teacher:ctx.teacher,group:ctx.group})});
  const data=await res.json().catch(()=>({ok:false}));
  if(res.ok&&data.ok&&data.answer)t.messages.push({role:'assistant',text:String(data.answer).slice(0,9000),teacher:ctx.teacher||'AI 학습 도우미',date:Date.now()});
  else t.messages.push({role:'system',text:res.status===503?'질문은 기록되었습니다. 현재 실제 AI 답변 서비스가 연결되지 않아 풀이를 제공하지 못합니다.':'답변 서버에서 응답을 받지 못했습니다. 질문은 기록되었습니다.',date:Date.now()});
 }catch{t.messages.push({role:'system',text:'네트워크 문제로 답변을 받지 못했습니다. 질문은 기록되었습니다.',date:Date.now()})}
 finally{ui.busy=false;ui.notice='';save();if(ui.open)draw()}
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest?.('#phone [data-ask]');if(!b)return;
 ev.preventDefault();ev.stopPropagation();const a=b.dataset.ask;
 if(a==='open'){show('text');return}
 if(a==='camera'||a==='gallery'){if(!ui.open)show(a);else document.getElementById('ask-'+a)?.click();return}
 if(a==='voice'){if(!ui.open)show('voice');else voice();return}
 if(a==='close'){dismiss();return}
 if(a==='new'){fresh();draw();return}
 if(a==='history'){ui.hist=!ui.hist;draw();return}
 if(a==='thread'){ui.threadId=b.dataset.id;ui.hist=false;draw();return}
 if(a==='remove'){ui.photo='';ui.thumb='';ui.photoName='';ui.notice='';draw();return}
 if(a==='example'){ui.draft=b.dataset.text||'';draw();document.getElementById('ask-text')?.focus();return}
 if(a==='send'){send();return}
});
document.addEventListener('input',ev=>{if(ev.target?.id==='ask-text')ui.draft=ev.target.value});
document.addEventListener('change',ev=>{if(['ask-camera','ask-gallery'].includes(ev.target?.id))photo(ev.target.files?.[0])});
document.addEventListener('keydown',ev=>{if(ev.target?.id==='ask-text'&&ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();send()}if(ev.key==='Escape'&&ui.open)dismiss()});
window.HITEL_ASK_INSPECT=()=>({questionBar:true,camera:true,voice:true,threads:ui.threads.length,open:ui.open,context:teacher(ui.draft)});
// The base app renders before extension scripts load; refresh the shell once after overriding it.
render();
})();