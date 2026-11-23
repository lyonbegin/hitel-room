package com.hitel.zocbodiag;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * In-app metadata-only crawler: original authenticated previousExam.asp WebView
 * uses its existing comm.send(...) against its original pagination endpoint.
 * Per-page results are atomically stored in app-private SQLite.
 *
 * No PDF fetch, no login-cookie/token extraction, no remote proxy/cloud server.
 * No circumvention of throttling: single serial request, >=1500ms delay,
 * stop on errors, timeout or suspected endless pagination.
 */
public final class ReadingCollectorController {
  public static final String EXTRA_COLLECT="com.hitel.zocbodiag.COLLECT_METADATA";
  public static final String EXTRA_SOURCE_URL="com.hitel.zocbodiag.COLLECT_SOURCE_URL";
  private static final int EXPORT_CSV=7441,EXPORT_JSON=7442;
  private static final int PER_PAGE=10, DELAY_MS=1600;
  private static final String[] SUBJECTS={"KR","EG","MT","SC","LS","HI","ET","TH","CH","OT"};
  private static final String[] TERMS={"1M","1E","2M","2E"};
  private static final String DEFAULT_URL="https://m.zocbo.com/exam/school/previousExam.asp";
  private final Activity activity;
  private final ReadingCollectorStore store;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private final String nonce=UUID.randomUUID().toString();
  private final WebView web;
  private final TextView status;
  private final EditText startYear,endYear;
  private final List<Job> jobs=new ArrayList<>();
  private String sourceUrl,runKey="",scope="ALL_UNVERIFIED";
  private String currentSchool="",currentCity="",currentDistrict="",currentFilter="";
  private boolean loaded=false,running=false,destroyed=false,requestPending=false;
  private ReadingCollectorStore.Progress progress=new ReadingCollectorStore.Progress();
  private String previousPageSignature="";
  private int prevTask=-1;
  private int exportMode=0;

  static class Job {
    String site,grade,year,term,subject;
    Job(String s,String g,String y,String t,String u){
      site=s;grade=g;year=y;term=t;subject=u;
    }
  }
  private int dp(int n){return (int)(activity.getResources().getDisplayMetrics().density*n+0.5f);}
  private TextView text(String s,int size){
    TextView t=new TextView(activity);t.setText(s);t.setTextSize(size);
    t.setTextColor(Color.rgb(29,40,54));t.setPadding(dp(6),dp(9),dp(6),dp(9));return t;
  }
  private Button button(String label,LinearLayout body,Runnable action){
    Button b=new Button(activity);b.setAllCaps(false);b.setText(label);
    body.addView(b,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(50)));
    b.setOnClickListener(v->action.run());return b;
  }
  private static String urlParam(Uri uri,String name,String fallback){
    try{String s=uri.getQueryParameter(name);return s==null||s.isEmpty()?fallback:s;}
    catch(Throwable t){return fallback;}
  }
  private static String safeUrl(String source){
    return NativePdfTitleBridge.isFreeReadingPage(source)?source:DEFAULT_URL;
  }

  public ReadingCollectorController(Activity a,String lastUrl){
    activity=a;store=new ReadingCollectorStore(a);
    sourceUrl=safeUrl(lastUrl);
    ScrollView scroll=new ScrollView(a);
    scroll.setBackgroundColor(Color.WHITE);scroll.setFillViewport(true);
    LinearLayout root=new LinearLayout(a);root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(14),dp(22),dp(14),dp(18));
    scroll.addView(root);
    root.addView(text("기출 열람실 시험지 목록 수집",21));
    root.addView(text("PDF는 열거나 저장하지 않습니다. 시험지 번호와 목록 정보만 앱 내부 SQLite에 저장하며, 수집한 내용은 CSV/JSON으로 직접 내보낼 수 있습니다.",13));
    root.addView(text("전체 조건 탐색: 지역/학교 미지정 검색이 전국 전체 자료를 반환하는지는 확인 전입니다. 서버가 제공한 결과만 저장하며, 전체 수집이 보장된 것으로 표시하지 않습니다.",12));

    LinearLayout yr=new LinearLayout(a);yr.setOrientation(LinearLayout.HORIZONTAL);
    startYear=new EditText(a);startYear.setSingleLine(true);
    startYear.setInputType(InputType.TYPE_CLASS_NUMBER);
    startYear.setText("2000");startYear.setHint("시작 연도");
    yr.addView(startYear,new LinearLayout.LayoutParams(0,dp(48),1f));
    endYear=new EditText(a);endYear.setSingleLine(true);
    endYear.setInputType(InputType.TYPE_CLASS_NUMBER);
    endYear.setText("2026");endYear.setHint("마지막 연도");
    yr.addView(endYear,new LinearLayout.LayoutParams(0,dp(48),1f));
    root.addView(yr);
    root.addView(text("연도 범위는 수정 가능합니다. 전체 탐색은 중·고등 / 학년 / 연도 / 4개 시험구분 / 10개 과목 코드를 순차 조회합니다.",12));

    button("전체 조건 수집 시작 / 이어하기",root,()->start(false));
    button("현재 열람실 조건만 수집",root,()->start(true));
    button("일시정지",root,()->pause("사용자 요청으로 일시정지"));
    button("CSV 파일 내보내기 (엑셀)",root,()->export(EXPORT_CSV));
    button("JSON 파일 내보내기 (전체 메타데이터)",root,()->export(EXPORT_JSON));
    button("저장된 건수·진행상태 확인",root,()->showStatus("상태 조회"));

    status=text("연결 대기 · 앱 내부 DB: "+store.count()+"건",13);
    root.addView(status);
    root.addView(text("내보내기는 안드로이드 파일 저장 창에서 저장 위치를 직접 선택합니다. 앱 외부 서버로 자동 전송하지 않습니다.",12));
    root.addView(text("원본 열람실 접속 상태 (로그인 필요 시 아래에서 확인)",12));

    web=new WebView(a);
    WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
    s.setLoadsImagesAutomatically(false);
    if(Build.VERSION.SDK_INT>=21)s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new Bridge(),"hitelCollectorNative");
    web.setWebViewClient(new WebViewClient(){
      @Override public void onPageFinished(WebView w,String url){
        loaded=NativePdfTitleBridge.isFreeReadingPage(url);
        if(loaded){
          Diag.log("COLLECTOR_WEBVIEW_READY","original previousExam.asp loaded");
          showStatus("원본 열람실 준비됨; 수집 버튼을 눌러 주십시오.");
          readCurrentScope();
        } else {
          Diag.log("COLLECTOR_WEBVIEW_NON_TARGET",url==null?"null":url.split("\\?")[0]);
          if(running)pause("원본 열람실을 벗어나 수집 중지");
          showStatus("원본 열람실에 접속하지 못했습니다. 아래 화면에서 로그인 상태를 확인하십시오.");
        }
      }
      @Override public void onReceivedError(WebView w,int code,String description,String failingUrl){
        showStatus("열람실 WebView 오류: "+code+" "+description);
      }
    });
    root.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(175)));
    a.setContentView(scroll);
    a.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    web.loadUrl(sourceUrl);
    Diag.log("COLLECTOR_ACTIVITY_READY","local-db="+ReadingCollectorStore.DB_NAME+" original-WebView="+safeUrl(sourceUrl).split("\\?")[0]);
  }

  private void readCurrentScope(){
    if(!loaded)return;
    // This is read-only observation of source HTML, never credential extraction.
    String script="(function(){try{"
      +"var p=new URLSearchParams(location.search);"
      +"var s=p.get('scl_id')||p.get('Scl_ID')||p.get('search_scl_id')||'';"
      +"if(!s){var scripts=document.querySelectorAll('script');"
      +"for(var i=0;i<scripts.length;i++){var t=scripts[i].textContent||'';"
      +"var m=t.match(/var\\s+scl_id\\s*=\\s*[\u0027\\\"]([0-9|]+)[\u0027\\\"]/);"
      +"if(m){s=m[1];break;}}}"
      +"window.hitelCollectorNative.scope('"+nonce+"',s,"
      +"p.get('Rg_CitiesProvinces')||'',p.get('Rg_District')||'',"
      +"p.get('filter_gugun')||'');"
      +"return 'scope-captured';}catch(e){return 'scope-error';}})();";
    web.evaluateJavascript(script,null);
  }

  private final class Bridge {
    @JavascriptInterface public void scope(String auth,String schools,String city,String district,String filter){
      if(!nonce.equals(auth))return;
      ui.post(()->{
        currentSchool=schools==null?"":schools.replaceAll("[^0-9|]","");
        currentCity=city==null?"":city;
        currentDistrict=district==null?"":district;
        currentFilter=filter==null?"":filter;
        Diag.log("COLLECTOR_SCOPE_FOUND","schools-length="+currentSchool.length());
      });
    }
    @JavascriptInterface public void page(String auth,int task,int page,String data){
      if(!nonce.equals(auth)||data==null||data.length()>250000)return;
      onResult(task,page,data);
    }
    @JavascriptInterface public void error(String auth,int task,int page,String error){
      if(!nonce.equals(auth))return;
      ui.post(()->{
        if(!running||task!=progress.taskIndex||page!=progress.page)return;
        requestPending=false;
        pause("조회 실패("+task+"/"+page+"): "+ReadingCollectorStore.sanitize(error,125));
        Diag.log("COLLECTOR_REQUEST_ERROR","task="+task+" page="+page+" "+ReadingCollectorStore.sanitize(error,80));
      });
    }
  }

  private void start(boolean useCurrent) {
    if(running){showStatus("이미 순차 수집이 진행 중입니다.");return;}
    if(!loaded){showStatus("원본 열람실 접속 후 시작할 수 있습니다. 로그인과 페이지 로딩을 확인하십시오.");return;}
    int begin,finish;
    try{begin=Integer.parseInt(startYear.getText().toString().trim());
        finish=Integer.parseInt(endYear.getText().toString().trim());}
    catch(Exception e){showStatus("연도는 숫자로 입력해 주십시오.");return;}
    if(begin<1990||finish>2100||begin>finish||finish-begin>110){
      showStatus("연도 범위를 다시 확인하십시오 (1990~2100).");return;
    }
    Uri original=Uri.parse(sourceUrl);
    jobs.clear();
    if(useCurrent){
      String site=urlParam(original,"SiteID","M");
      String grade=urlParam(original,"Grade","3");
      String year=urlParam(original,"ExPapr_TestYear",String.valueOf(finish));
      String term=urlParam(original,"ExPapr_MidEndTerm","2E");
      String subject=urlParam(original,"Subj_Code","KR");
      if(!site.matches("[MH]")||!grade.matches("[123]")||!year.matches("[0-9]{4}")
          ||!term.matches("(1M|1E|2M|2E)")||!subject.matches("[A-Z]{2}")){
        showStatus("현재 열람실 조건이 불명확합니다. 앱의 연도·학년·학기·과목을 선택한 뒤 재시도하십시오.");return;
      }
      jobs.add(new Job(site,grade,year,term,subject));
      scope="CURRENT_FILTER";
    }else {
      for(int y=finish;y>=begin;y--)
        for(String site:new String[]{"M","H"})
          for(String grade:new String[]{"1","2","3"})
            for(String term:TERMS)
              for(String subj:SUBJECTS)
                jobs.add(new Job(site,grade,String.valueOf(y),term,subj));
      scope="ALL_GEOGRAPHY_UNVERIFIED";
    }
    String seed=scope+"|"+begin+"|"+finish+"|"+
      (useCurrent?(currentSchool+"|"+currentCity+"|"+currentDistrict+"|"+sourceUrl.split("\\?")[0]):"");
    runKey=sha256(seed);
    progress=store.load(runKey);
    if(progress.finished){
      showStatus("이 조건은 이전에 끝까지 조회했습니다. DB="+store.count()
        +"건. 다시 수집하시려면 연도/조건을 변경하십시오.");return;
    }
    if(progress.taskIndex>=jobs.size()){
      progress.finished=true;store.saveProgress(runKey,progress);
      showStatus("완료: DB="+store.count()+"건");return;
    }
    running=true;requestPending=false;
    previousPageSignature="";prevTask=-1;
    Diag.log("COLLECTOR_START","scope="+scope+" total_tasks="+jobs.size()
      +" resume_index="+progress.taskIndex+" page="+progress.page);
    showStatus("수집 시작 · "+jobs.size()+"개 조건 · 마지막 저장 위치부터 이어서 진행");
    nextPage();
  }

  private static String sha256(String input){
    try{
      MessageDigest dig=MessageDigest.getInstance("SHA-256");
      byte[] bytes=dig.digest(input.getBytes("UTF-8"));
      StringBuilder s=new StringBuilder("crawl-v1-");
      for(byte b:bytes)s.append(String.format(Locale.US,"%02x",b&0xff));
      return s.toString();
    }catch(Exception e){return "crawl-fallback";}
  }
  private static String enc(String raw){
    try{return URLEncoder.encode(raw==null?"":raw,"UTF-8");}
    catch(Exception e){return "";}
  }
  private static String append(String source,String key,String value){
    return source+"&"+key+"="+enc(value);
  }
  private String query(Job job,int page) {
    String data="cmd=PREVIOUSEXAM_SEARCHZOCBO_MAIN_V1"
      +"&SiteID="+enc(job.site)+"&Group=A";
    data=append(data,"Rg_CitiesProvinces",
      "CURRENT_FILTER".equals(scope)?currentCity:"");
    data=append(data,"Rg_District",
      "CURRENT_FILTER".equals(scope)?currentDistrict:"");
    data=append(data,"Scl_ID",
      "CURRENT_FILTER".equals(scope)?currentSchool:"");
    data=append(data,"Exfl_Group","");
    data+="&Kind=REGION&Page="+page+"&PageSize="+PER_PAGE;
    data=append(data,"ExPapr_CoreType","E");
    data=append(data,"Grade",job.grade);
    data=append(data,"ExPapr_TestYear",job.year);
    data=append(data,"ExPapr_MidEndTerm",job.term);
    data=append(data,"Subj_Code",job.subject);
    data=append(data,"filter_gugun",
      "CURRENT_FILTER".equals(scope)?currentFilter:"");
    data+="&answer_chk_status=N&isAnswerPaid=Y";
    if("H".equals(job.site))data+="&Course_Name=";
    return data;
  }

  private void nextPage(){
    if(!running||destroyed||!loaded||requestPending)return;
    if(progress.taskIndex>=jobs.size()){finish();return;}
    final int idx=progress.taskIndex,p=progress.page;
    final Job job=jobs.get(idx);
    final String data=query(job,p);
    String js="(function(){try{"
      +"if(!window.comm||typeof comm.send!=='function')"
      +"{window.hitelCollectorNative.error('"+nonce+"',"+idx+","+p+",'original comm.send unavailable');return;}"
      +"var done=false;"
      +"var watchdog=setTimeout(function(){if(!done){done=true;window.hitelCollectorNative.error('"+nonce+"',"+idx+","+p+",'original API timeout');}},30000);"
      +"comm.send('/_api/search.api.asp',"+JSONObject.quote(data)+",'POST',function(j){"
      +"if(done)return;done=true;clearTimeout(watchdog);"
      +"try{if(!j||!Array.isArray(j.list))throw Error('JSON list absent');"
      +"window.hitelCollectorNative.page('"+nonce+"',"+idx+","+p+",JSON.stringify(j.list));}"
      +"catch(e){window.hitelCollectorNative.error('"+nonce+"',"+idx+","+p+",String(e));}"
      +"});"
      +"}catch(e){window.hitelCollectorNative.error('"+nonce+"',"+idx+","+p+",String(e));}})();";
    requestPending=true;
    showStatus("조회 중: "+(idx+1)+"/"+jobs.size()+" 조건 · "
      +job.site+" "+job.grade+"학년 "+job.year+"년 "+job.term+" "+job.subject
      +" · 페이지 "+p);
    try{web.evaluateJavascript(js,null);}
    catch(Throwable t){requestPending=false;pause("WebView 자바스크립트 호출 실패");}
  }

  private void onResult(final int task,final int page,final String response){
    // Bridge runs on a WebView background thread; keep SQLite insert off main.
    if(destroyed||!running||!requestPending||task!=progress.taskIndex||page!=progress.page)return;
    try {
      JSONArray list=new JSONArray(response);
      if(list.length()>PER_PAGE*2){
        ui.post(()->pause("한 페이지 응답 건수가 예상보다 많아 중지했습니다."));return;
      }
      Job job=jobs.get(task);
      String signature="";
      if(list.length()>0){
        JSONObject first=list.optJSONObject(0),last=list.optJSONObject(list.length()-1);
        signature=ReadingCollectorStore.first(first==null?new JSONObject():first,"expapr_no","exPapr_no")
          +"|"+ReadingCollectorStore.first(last==null?new JSONObject():last,"expapr_no","exPapr_no");
      }
      if(page>1 && task==prevTask && signature.equals(previousPageSignature) && !signature.equals("|")){
        ui.post(()->{requestPending=false;pause("서버가 이전 페이지와 같은 자료를 반환합니다. 반복 요청을 중단했습니다.");});
        return;
      }
      previousPageSignature=signature;prevTask=task;
      ReadingCollectorStore.Progress next=new ReadingCollectorStore.Progress();
      next.taskIndex=task;next.page=page+1;
      next.pagesDone=progress.pagesDone+1;
      next.rowsSeen=progress.rowsSeen+list.length();
      if(list.length()<PER_PAGE){next.taskIndex=task+1;next.page=1;}
      next.finished=next.taskIndex>=jobs.size();
      final int saved=store.savePage(runKey,next,list,job.site,job.grade,job.year,job.term,job.subject,scope);
      ui.post(()->{
        if(destroyed)return;
        progress=next;requestPending=false;
        showStatus("누적 DB "+store.count()+"건 / 응답 "+next.rowsSeen+"행 / "
          +next.pagesDone+"페이지 · 조건 "+Math.min(jobs.size(),next.taskIndex+1)+"/"+jobs.size());
        if(!running)return;
        if(next.finished){finish();return;}
        ui.postDelayed(()->nextPage(),DELAY_MS);
      });
      Diag.log("COLLECTOR_PAGE_SAVED","task="+task+" page="+page
        +" rows="+list.length()+" persisted="+saved+" next="+next.taskIndex+":"+next.page);
    }catch(Throwable t){
      ui.post(()->{requestPending=false;pause("메타데이터 저장 실패: "+t.getClass().getSimpleName());});
      Diag.log("COLLECTOR_STORE_ERROR",t.getClass().getName());
    }
  }
  private void pause(String reason){
    if(!running){showStatus(reason);return;}
    running=false;requestPending=false;
    Diag.log("COLLECTOR_PAUSED",reason+" checkpoint="+progress.taskIndex+":"+progress.page);
    showStatus(reason+" · 이미 수집한 "+store.count()+"건 유지");
  }
  private void finish(){
    running=false;requestPending=false;progress.finished=true;
    store.saveProgress(runKey,progress);
    Diag.log("COLLECTOR_FINISHED","jobs="+jobs.size()+" unique="+store.count());
    showStatus("모든 요청 조건의 페이지 탐색 종료. DB "+store.count()
      +"건 · CSV/JSON으로 내보내십시오. 전국 전체 자료 확보 여부는 별도 검증이 필요합니다.");
  }
  private void showStatus(String s){
    if(destroyed)return;
    Runnable r=()->{if(!destroyed)status.setText(
      s+"\n저장 DB: "+store.count()+"건"+(jobs.size()>0
        ?" · "+Math.min(progress.taskIndex+1,jobs.size())+"/"+jobs.size()+" 조건":"")
      +(runKey.length()>0?" · 현재 페이지: "+progress.page:""));};
    if(Looper.myLooper()==Looper.getMainLooper())r.run();else ui.post(r);
  }

  private void export(int format){
    if(running){pause("파일 내보내기를 위해 수집 일시정지");}
    exportMode=format;
    Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType(format==EXPORT_CSV?"text/csv":"application/json");
    String ts=new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.KOREA).format(new Date());
    i.putExtra(Intent.EXTRA_TITLE,"zocbo_exam_metadata_"+ts+(format==EXPORT_CSV?".csv":".json"));
    try{activity.startActivityForResult(i,format);}
    catch(Throwable t){showStatus("안드로이드 저장 창 실행 실패: "+t.getClass().getSimpleName());}
  }
  public void onActivityResult(int requestCode,int resultCode,Intent data){
    if((requestCode!=EXPORT_CSV&&requestCode!=EXPORT_JSON)
      ||resultCode!=Activity.RESULT_OK||data==null||data.getData()==null)return;
    final Uri uri=data.getData();final int kind=requestCode;
    showStatus("파일 내보내기 수행 중");
    new Thread(()->{
      try(OutputStream out=activity.getContentResolver().openOutputStream(uri,"w")){
        if(out==null)throw new IllegalStateException("output stream unavailable");
        int count=kind==EXPORT_CSV?store.exportCsv(out):store.exportJson(out);
        Diag.log("COLLECTOR_EXPORT_OK","format="+(kind==EXPORT_CSV?"CSV":"JSON")+" rows="+count);
        ui.post(()->{showStatus((kind==EXPORT_CSV?"CSV":"JSON")
          +" 저장 완료: "+count+"건");Toast.makeText(activity,"목록 파일 내보내기 완료",Toast.LENGTH_LONG).show();});
      }catch(Throwable e){
        Diag.log("COLLECTOR_EXPORT_ERROR",e.getClass().getName());
        ui.post(()->showStatus("파일 저장 오류: "+e.getClass().getSimpleName()));
      }
    },"ZocboCollectorExport").start();
  }
  public void destroy(){
    destroyed=true;running=false;
    activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    try{web.removeJavascriptInterface("hitelCollectorNative");web.stopLoading();web.destroy();}
    catch(Throwable ignored){}
    store.close();
  }
}
