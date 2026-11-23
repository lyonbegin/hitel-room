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
import android.util.Base64;
import android.util.Log;
import java.nio.charset.StandardCharsets;

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
  public static final String EXTRA_QA_ORIGINAL_HTML="com.hitel.zocbodiag.QA_ORIGINAL_HTML_BASE64";
  public static final String EXTRA_AUTO_NINE="com.hitel.zocbodiag.AUTO_NINE_REGION";
  private static final int EXPORT_CSV=7441,EXPORT_JSON=7442;
  private static final int PER_PAGE=10, DELAY_MS=1600, REGION_LIMIT=9;
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
  private final List<AreaScope> originalAreas=new ArrayList<>();
  private boolean discovering=false, waitingAreaNavigation=false, awaitingAreaSnapshot=false;
  private int discoverySiteIndex=0, discoveryIndex=0, selectorRetries=0;
  private int selectedTabOrdinal=-1;
  private final ArrayList<String> requestedRegionNames=new ArrayList<>();
  private int discoverFromYear=2000, discoverToYear=2026;
  private String lastAreaName="";
  private static final String[] SCHOOL_LEVELS={"M","H"};
  private String sourceUrl,runKey="",discoveryRunKey="",scope="ALL_UNVERIFIED";
  private final boolean qaOriginalHtml;
  private String currentSchool="",currentCity="",currentDistrict="",currentFilter="";
  private String currentSite="",currentGrade="",currentYear="",currentTerm="",currentSubject="",currentPaid="N";
  private JSONArray currentRows=new JSONArray();
  private boolean scopeReady=false;
  private boolean loaded=false,running=false,destroyed=false,requestPending=false;
  private ReadingCollectorStore.Progress progress=new ReadingCollectorStore.Progress();
  private String previousPageSignature="";
  private int prevTask=-1;
  private int exportMode=0;

  static final class AreaScope {
    String name,site,schools,city,district,filter,paid,grade,year,term,subject;
    JSONArray firstPage;
    int ordinal=-1; // original left-column selector index, persisted for restart
    AreaScope(String name,String site,String schools,String city,String district,String filter,
              String paid,String grade,String year,String term,String subject,JSONArray firstPage){
      this.name=name;this.site=site;this.schools=schools;this.city=city;this.district=district;
      this.filter=filter;this.paid=paid;this.grade=grade;this.year=year;this.term=term;
      this.subject=subject;this.firstPage=firstPage;
    }
    String nameKey(){return site+"|"+name+"|"+city+"|"+district+"|"+schools;}
    String fingerprint(){return nameKey()+"|"+schools+"|"+district+"|"+filter;}
  }
  static class Job {
    final AreaScope region;
    final String site,grade,year,term,subject;
    Job(String s,String g,String y,String t,String u){this(null,s,g,y,t,u);}
    Job(AreaScope area,String s,String g,String y,String t,String u){
      region=area;site=s;grade=g;year=y;term=t;subject=u;
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
    qaOriginalHtml=a.getIntent()!=null&&a.getIntent().hasExtra(EXTRA_QA_ORIGINAL_HTML);
    if(qaOriginalHtml&&!ReadingCollectorQaProof.emulator())
      throw new SecurityException("Local original HTML QA is emulator-only");
    ScrollView scroll=new ScrollView(a);
    scroll.setBackgroundColor(Color.WHITE);scroll.setFillViewport(true);
    LinearLayout root=new LinearLayout(a);root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(14),dp(22),dp(14),dp(18));
    scroll.addView(root);
    root.addView(text("기출 열람실 시험지 목록 수집",21));
    root.addView(text("PDF는 열거나 저장하지 않습니다. 시험지 번호와 목록 정보만 앱 내부 SQLite에 저장하며, 수집한 내용은 CSV/JSON으로 직접 내보낼 수 있습니다.",13));
    root.addView(text("전국 지역 선택기의 각 ‘전체’ 항목을 앱에서 자동으로 선택합니다. 원본 웹에서 제공한 학교 ID와 실제 시험지 목록만 수집하며, 학교를 하나씩 고르실 필요가 없습니다.",12));

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
    root.addView(text("연도 범위만 설정하시면 됩니다. 수집은 중학교·고등학교 × 원본 지역 ‘전체’ 목록 × 학년·연도·학기·과목을 자동 순회합니다.",12));

    button("전국 지역 ‘전체’ 자동수집 / 이어하기",root,()->startNationwide());
    button("일시정지",root,()->pause("사용자 요청으로 일시정지"));
    button("CSV 파일 내보내기 (엑셀)",root,()->export(EXPORT_CSV));
    button("JSON 파일 내보내기 (전체 메타데이터)",root,()->export(EXPORT_JSON));
    button("저장된 건수·진행상태 확인",root,()->showStatus("상태 조회 · 원본 서버 저장 행과 시험용 캡처는 source_scope로 구분"));


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
        if(discovering && ReadingAreaSelector.isSelector(url)){
          loaded=false;
          selectorRetries=0;
          ui.postDelayed(()->scanOriginalAreaChoices(),700);
          return;
        }
        loaded=NativePdfTitleBridge.isFreeReadingPage(url);
        scopeReady=false;
        if(loaded){
          Diag.log("COLLECTOR_WEBVIEW_READY","original previousExam.asp loaded");
          showStatus(discovering?"지역 ‘전체’ 적용 결과를 읽는 중":"원본 열람실 준비됨; 수집 버튼을 눌러 주십시오.");
          awaitingAreaSnapshot=discovering && waitingAreaNavigation;
          waitingAreaNavigation=false;
          readCurrentScope();
        } else {
          Diag.log("COLLECTOR_WEBVIEW_NON_TARGET",url==null?"null":url.split("\\?")[0]);
          if(running)pause("원본 열람실을 벗어나 수집 중지");
          if(discovering)stopDiscovery("지역 선택 화면을 벗어나 수집 중지");
          showStatus("원본 열람실에 접속하지 못했습니다. 아래 화면에서 로그인 상태를 확인하십시오.");
        }
      }
      @Override public void onReceivedError(WebView w,int code,String description,String failingUrl){
        showStatus("열람실 WebView 오류: "+code+" "+description);
        if(discovering)stopDiscovery("원본 서버 연결 오류: "+code+" "+description);
      }
    });
    root.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(175)));
    a.setContentView(scroll);
    a.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if(qaOriginalHtml){
      String encoded=a.getIntent().getStringExtra(EXTRA_QA_ORIGINAL_HTML);
      if(encoded==null||encoded.length()>45000)throw new IllegalArgumentException("QA HTML length");
      String originalObservedHtml=new String(Base64.decode(encoded,Base64.NO_WRAP),StandardCharsets.UTF_8);
      web.loadDataWithBaseURL(sourceUrl,originalObservedHtml,"text/html","UTF-8",sourceUrl);
      Log.i("ZocboQA","QA_ORIGINAL_HTML_WEBVIEW_PAGE_LOADED source=prior_user_capture not_live");
    }else web.loadUrl(sourceUrl);
    if(!qaOriginalHtml && ReadingCollectorQaProof.emulator() &&
       a.getIntent()!=null&&a.getIntent().getBooleanExtra(EXTRA_AUTO_NINE,false)){
      Log.i("ZocboNine","AUTO_NINE_REGION_ATTEMPT requested=true");
      ui.postDelayed(()->{if(!destroyed)startNationwide();},1500);
    }
    Diag.log("COLLECTOR_ACTIVITY_READY","local-db="+ReadingCollectorStore.DB_NAME+" original-WebView="+safeUrl(sourceUrl).split("\\?")[0]);
  }

  private void readCurrentScope(){
    if(!loaded)return;
    try{
      web.evaluateJavascript(ReadingOriginalPageCapture.script(nonce),v->
        Diag.log("COLLECTOR_PAGE_SNAPSHOT",String.valueOf(v)));
    }catch(Throwable t){
      showStatus("원본 페이지 목록 분석 실패: "+t.getClass().getSimpleName());
      Diag.log("COLLECTOR_SCOPE_ERROR",t.getClass().getName());
    }
  }

  private ArrayList<Integer> nineSourceTabOrder(JSONArray original){
    ArrayList<Integer> selected=new ArrayList<>();
    if(original.length()<REGION_LIMIT)
      throw new IllegalStateException("Original region choices below nine: "+original.length());
    int seoul=-1;
    for(int i=0;i<original.length();i++){
      JSONObject item=original.optJSONObject(i);
      if(item==null)continue;
      String name=item.optString("name","").trim();
      if("서울".equals(name)||"서울특별시".equals(name)){
        if(seoul>=0)throw new IllegalStateException("Duplicate Seoul choices");
        seoul=i;
      }
    }
    if(seoul<0)throw new IllegalStateException("Seoul not found in original source");
    selected.add(seoul);
    for(int i=0;i<original.length()&&selected.size()<REGION_LIMIT;i++){
      if(i==seoul)continue;
      JSONObject item=original.optJSONObject(i);
      if(item!=null && !item.optString("name","").trim().isEmpty())selected.add(i);
    }
    if(selected.size()!=REGION_LIMIT)throw new IllegalStateException("Nine source choices unavailable");
    return selected;
  }
  private void logNine(String stage,String detail){
    String body="stage="+stage+" site="+(discoverySiteIndex<SCHOOL_LEVELS.length?SCHOOL_LEVELS[discoverySiteIndex]:"done")+
      " region_position="+(discoveryIndex+1)+"/"+REGION_LIMIT+
      " selected="+ReadingCollectorStore.sanitize(lastAreaName,50)+
      " area_scopes="+store.countAreas(discoveryRunKey)+
      " live_exam_unique="+store.countLive()+" checkpoint="+progress.taskIndex+":"+progress.page+
      " pages="+progress.pagesDone+" "+ReadingCollectorStore.sanitize(detail,120);
    Log.i("ZocboNine",body);
    Diag.log("COLLECTOR_NINE_HEARTBEAT",body);
  }
  private final class Bridge {
    @JavascriptInterface public void areaCandidates(String auth,String payload){
      if(!nonce.equals(auth)||payload==null||payload.length()>180000)return;
      ui.post(()->{
        if(!discovering||destroyed||waitingAreaNavigation)return;
        try{
          JSONArray list=new JSONArray(payload);
          Diag.log("COLLECTOR_AREA_CHOICES","site="+SCHOOL_LEVELS[discoverySiteIndex]+
            " total="+list.length()+" index="+discoveryIndex);
          if(list.length()==0){
            if(++selectorRetries<4){
              ui.postDelayed(()->scanOriginalAreaChoices(),1100);
            }else stopDiscovery("원본 지역선택기에서 .region .tab__button[data-order]와 대응하는 .region .tab__content[data-order]가 확인되지 않았습니다. 현재 원본 페이지의 구조 또는 접근 상태 확인이 필요합니다.");
            return;
          }
          final ArrayList<Integer> chosen=nineSourceTabOrder(list);
          ArrayList<String> sourceNine=new ArrayList<>();
          for(int actual:chosen)sourceNine.add(list.getJSONObject(actual).optString("name","").trim());
          if(requestedRegionNames.isEmpty())requestedRegionNames.addAll(sourceNine);
          else if(!requestedRegionNames.equals(sourceNine)){
            stopDiscovery("원본 중학교/고등학교 지역 목록이 일치하지 않습니다.");
            return;
          }
          logNine("REGION_CHOICES","source_total="+list.length()+" chosen="+sourceNine.toString());
          // Fail safely if the source's left column changed since the checkpoint.
          for(AreaScope prior:originalAreas){
            if(!SCHOOL_LEVELS[discoverySiteIndex].equals(prior.site))continue;
            JSONObject row=prior.ordinal>=0&&prior.ordinal<list.length()
              ?list.optJSONObject(prior.ordinal):null;
            if(row==null || !prior.name.equals(row.optString("name","")) || !chosen.contains(prior.ordinal)){
              stopDiscovery("저장 이후 원본 지역 목록의 순서가 변경되었습니다. 기존 DB는 유지하며, 다른 지역을 건너뛰지 않습니다.");
              return;
            }
          }
          if(discoveryIndex>=REGION_LIMIT){
            discoverySiteIndex++;
            discoveryIndex=0;
            if(discoverySiteIndex>=SCHOOL_LEVELS.length){
              finishAreaDiscovery();
            }else openAreaSelector();
            return;
          }
          final int actualTab=chosen.get(discoveryIndex);
          selectedTabOrdinal=actualTab;
          JSONObject item=list.optJSONObject(actualTab);
          if(item==null){stopDiscovery("지역 선택 항목을 읽지 못했습니다.");return;}
          lastAreaName=item.optString("name",item.optString("label","전체"));
          Diag.log("COLLECTOR_ORIGINAL_AREA_SELECT","site="+SCHOOL_LEVELS[discoverySiteIndex]+
            " selector="+(discoveryIndex+1)+"/"+REGION_LIMIT+" original_tab="+actualTab+" area="+lastAreaName);
          showStatus("원본 지역 선택: "+SCHOOL_LEVELS[discoverySiteIndex]+
            " · "+(discoveryIndex+1)+"/"+REGION_LIMIT+" · "+lastAreaName+" 전체");
          waitingAreaNavigation=true;
          logNine("CLICK_SOURCE_REGION","original_tab="+actualTab);
          web.evaluateJavascript(ReadingAreaSelector.click(nonce,actualTab),null);
          ui.postDelayed(()->{
            if(discovering&&waitingAreaNavigation){
              stopDiscovery("원본 지역 ‘전체’ 항목의 클릭 후 열람실 이동이 확인되지 않았습니다: "+
                lastAreaName+" (임의 검색 대신 진단 로그 보존)");
            }
          },8500);
        }catch(Throwable t){
          stopDiscovery("원본 지역 선택 목록 분석 실패: "+t.getClass().getSimpleName());
        }
      });
    }
    @JavascriptInterface public void areaClick(String auth,String label){
      if(nonce.equals(auth))Diag.log("COLLECTOR_ORIGINAL_AREA_CLICK",
        ReadingCollectorStore.sanitize(label,70));
    }
    @JavascriptInterface public void areaError(String auth,String error){
      if(!nonce.equals(auth))return;
      ui.post(()->stopDiscovery("원본 지역 선택 실행 실패: "+
        ReadingCollectorStore.sanitize(error,130)));
    }
    @JavascriptInterface public void snapshot(String auth,String payload){
      if(!nonce.equals(auth)||payload==null||payload.length()>250000)return;
      try {
        JSONObject o=new JSONObject(payload);
        final String school=o.optString("schools","").replaceAll("[^0-9|]","");
        final JSONArray first=o.optJSONArray("rows");
        ui.post(()->{
          if(destroyed)return;
          currentSchool=school;
          currentCity=o.optString("city","");
          currentDistrict=o.optString("district","");
          currentFilter=o.optString("filter","");
          currentSite=o.optString("site","");
          currentGrade=o.optString("grade","");
          currentYear=o.optString("year","");
          currentTerm=o.optString("term","");
          currentSubject=o.optString("subject","");
          currentPaid=o.optString("paid","N");
          currentRows=first==null?new JSONArray():first;
          scopeReady=true;
          // Persist ACTUALLY rendered original exam IDs immediately; never defer
          // page-one records until every nationwide selector has been scanned.
          if(currentRows.length()>0&&currentSite.matches("[MH]")&&
             currentGrade.matches("[123]")&&currentYear.matches("[0-9]{4}")&&
             currentTerm.matches("(1M|1E|2M|2E)")&&currentSubject.matches("[A-Z0-9]{2,4}")){
            try{
              ReadingCollectorStore.Progress observed=new ReadingCollectorStore.Progress();
              observed.page=1;
              observed.pagesDone=1;
              observed.rowsSeen=currentRows.length();
              String key="live-rendered-"+sha256(currentSite+"|"+currentGrade+"|"+
                currentYear+"|"+currentTerm+"|"+currentSubject+"|"+
                currentSchool+"|"+currentCity+"|"+currentDistrict);
              int committed=store.savePage(key,observed,currentRows,currentSite,
                currentGrade,currentYear,currentTerm,currentSubject,
                qaOriginalHtml?"QA_USER_CAPTURED_HTML_WEBVIEW":"LIVE_ORIGINAL_WEBVIEW_PAGE1");
              String commitName=qaOriginalHtml?"COLLECTOR_QA_CAPTURED_WEBVIEW_SQLITE_COMMIT":"COLLECTOR_LIVE_FIRST_PAGE_SQLITE_COMMIT";
              String commitProof="page_rows="+currentRows.length()+" committed="+committed+
                " db_count="+store.count()+" no_pdf=true origin="+(qaOriginalHtml?"PRIOR_USER_HTML":"LIVE_WEBVIEW");
              Diag.log(commitName,commitProof);
              if(qaOriginalHtml)Log.i("ZocboQA",commitName+" "+commitProof);
            }catch(Throwable saveError){
              Diag.log("COLLECTOR_LIVE_FIRST_PAGE_STORE_ERROR",
                saveError.getClass().getName()+":"+saveError.getMessage());
              stopDiscovery("원본 첫 페이지 시험번호 DB 저장 실패");
              showStatus("원본 시험번호 DB 저장 실패: "+saveError.getClass().getSimpleName());
              return;
            }
          }
          String msg="원본 화면 자료 "+currentRows.length()+"건, 학교 ID "+(school.isEmpty()?0:school.split("\\|").length)
            +"개, 지역 "+currentCity+" "+currentDistrict
            +" / "+currentSite+currentGrade+" "+currentYear+" "+currentTerm+" "+currentSubject;
          showStatus(msg);
          Diag.log("COLLECTOR_SCOPE_FOUND",msg);
          if(discovering&&awaitingAreaSnapshot){
            awaitingAreaSnapshot=false;
            if(!SCHOOL_LEVELS[discoverySiteIndex].equals(currentSite)||
                (currentCity.isEmpty()&&currentFilter.isEmpty())){
              stopDiscovery("‘"+lastAreaName+" 전체’ 조회 결과에서 원본 지역 정보가 확인되지 않았습니다. 임의 지역코드는 사용하지 않습니다.");
              return;
            }
            Diag.log("COLLECTOR_AREA_SCOPE","city_present="+!currentCity.isEmpty()+
              " filter_present="+!currentFilter.isEmpty()+
              " server_school_id_count="+(currentSchool.isEmpty()?0:currentSchool.split("\\|").length));
            AreaScope found=new AreaScope(lastAreaName,currentSite,currentSchool,
              currentCity,currentDistrict,currentFilter,currentPaid,currentGrade,
              currentYear,currentTerm,currentSubject,currentRows);
            for(AreaScope prior:originalAreas){
              if(prior.nameKey().equals(found.nameKey())){
                stopDiscovery("지역 선택기가 같은 지역을 중복 반환했습니다: "+found.nameKey());
                return;
              }
            }
            // Commit the first-page metadata before recording the region as complete.
            // Interrupted regions may safely retry via exam_no primary key.
            try{
              if(found.firstPage!=null&&found.firstPage.length()>0){
                ReadingCollectorStore.Progress baseline=new ReadingCollectorStore.Progress();
                baseline.page=1;
                store.savePage("original-area-baseline-"+sha256(found.fingerprint()),baseline,
                  found.firstPage,found.site,found.grade,found.year,found.term,found.subject,
                  "ORIGINAL_AREA:"+found.site+"/"+found.name);
              }
              found.ordinal=selectedTabOrdinal;
              store.saveArea(discoveryRunKey,found.ordinal,found);
            }catch(Throwable saveError){
              Diag.log("COLLECTOR_AREA_SAVE_ERROR",saveError.getClass().getName());
              stopDiscovery("지역별 DB 저장 실패: "+saveError.getClass().getSimpleName());
              return;
            }
            originalAreas.add(found);
            Diag.log("COLLECTOR_AREA_PERSISTED",
              "region="+found.site+"/"+found.name+" index="+found.ordinal+
              " rows="+found.firstPage.length()+" areas="+store.countAreas(discoveryRunKey)+
              " exams="+store.count());
            Diag.log("COLLECTOR_ORIGINAL_AREA_CAPTURED","site="+found.site+
              " area="+found.name+" city="+found.city+
              " schoolIDs="+found.schools.split("\\|").length+
              " initialRows="+found.firstPage.length());
            logNine("AREA_SAVED","observed_first_page="+found.firstPage.length());
            discoveryIndex++;
            ui.postDelayed(()->openAreaSelector(),600);
          }
        });
      }catch(Throwable t){
        Diag.log("COLLECTOR_SCOPE_JSON_ERROR",t.getClass().getName());
      }
    }
    @JavascriptInterface public void snapshotError(String auth,String error){
      if(!nonce.equals(auth))return;
      ui.post(()->showStatus("원본 목록 분석 실패: "+ReadingCollectorStore.sanitize(error,150)));
      Diag.log("COLLECTOR_SCOPE_JS_ERROR",ReadingCollectorStore.sanitize(error,100));
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

  private void startNationwide(){
    if(running||discovering){
      showStatus("이미 수집 또는 원본 지역 순회가 진행 중입니다.");return;
    }
    // Launch the original region selector even before a signed-in previousExam
    // page exists. This permits anonymous UI verification; the collector
    // still stops when the original page/API denies access.
    try{
      discoverFromYear=Integer.parseInt(startYear.getText().toString().trim());
      discoverToYear=Integer.parseInt(endYear.getText().toString().trim());
    }catch(Throwable t){showStatus("시작 연도와 종료 연도를 숫자로 입력해 주십시오.");return;}
    if(discoverFromYear<1990||discoverToYear>2100||discoverFromYear>discoverToYear){
      showStatus("연도 범위를 확인해 주십시오 (1990~2100).");return;
    }
    discovering=true;waitingAreaNavigation=false;awaitingAreaSnapshot=false;
    discoveryRunKey="discovery-v3-nine-seoul-"+discoverFromYear+"-"+discoverToYear;
    originalAreas.clear();requestedRegionNames.clear();
    discoverySiteIndex=0;discoveryIndex=0;selectorRetries=0;selectedTabOrdinal=-1;
    try{
      originalAreas.addAll(store.loadAreas(discoveryRunKey));
      if(!originalAreas.isEmpty()){
        AreaScope last=originalAreas.get(originalAreas.size()-1);
        discoverySiteIndex="H".equals(last.site)?1:0;
        discoveryIndex=0;
        for(AreaScope a:originalAreas){
          if(last.site.equals(a.site))discoveryIndex++;
          if("M".equals(a.site))requestedRegionNames.add(a.name);
        }
        if("H".equals(last.site)&&requestedRegionNames.size()!=REGION_LIMIT)
          throw new IllegalStateException("Middle school nine region checkpoints missing");
      }
    }catch(Throwable t){
      discovering=false;
      showStatus("저장된 지역 탐색 위치 복원 실패: "+t.getClass().getSimpleName());
      return;
    }
    showStatus("전국 지역 순회 재개: DB에 저장된 지역 "+
      originalAreas.size()+"곳 · 다음 지역부터 탐색");
    Diag.log("COLLECTOR_NATIONWIDE_DISCOVERY_START","year="+discoverFromYear+"-"+discoverToYear+" original nine Seoul first");
    logNine("START_OR_RESUME","");
    openAreaSelector();
  }
  private void openAreaSelector(){
    if(!discovering||destroyed)return;
    if(discoverySiteIndex>=SCHOOL_LEVELS.length){finishAreaDiscovery();return;}
    loaded=false;scopeReady=false;waitingAreaNavigation=false;awaitingAreaSnapshot=false;
    String url=ReadingAreaSelector.page(sourceUrl,SCHOOL_LEVELS[discoverySiteIndex],discoverToYear);
    Diag.log("COLLECTOR_OPEN_ORIGINAL_REGION_SELECTOR",
      "site="+SCHOOL_LEVELS[discoverySiteIndex]+" index="+discoveryIndex);
    web.loadUrl(url);
  }
  private void scanOriginalAreaChoices(){
    if(!discovering||destroyed||!ReadingAreaSelector.isSelector(web.getUrl()))return;
    try{
      web.evaluateJavascript(ReadingAreaSelector.scan(nonce),v->
        Diag.log("COLLECTOR_SELECTOR_SCAN",String.valueOf(v)));
    }catch(Throwable t){
      stopDiscovery("원본 지역 목록 JavaScript 실행 실패: "+t.getClass().getSimpleName());
    }
  }
  private void stopDiscovery(String reason){
    if(!discovering)return;
    discovering=false;waitingAreaNavigation=false;awaitingAreaSnapshot=false;
    Diag.log("COLLECTOR_DISCOVERY_STOP",
      ReadingCollectorStore.sanitize(reason,200)+" collectedAreas="+originalAreas.size());
    logNine("BLOCKED",reason);
    showStatus(reason+" · 저장된 지역 "+originalAreas.size()+"곳 / 시험지 "+store.count()+"건 유지. 같은 연도 범위로 이어하기 가능합니다.");
  }
  private void finishAreaDiscovery(){
    if(!discovering)return;
    discovering=false;waitingAreaNavigation=false;awaitingAreaSnapshot=false;
    if(originalAreas.size()!=REGION_LIMIT*SCHOOL_LEVELS.length){
      showStatus("원본 중학교·고등학교 18개 지역 범위 중 "+
        originalAreas.size()+"개만 확인되었습니다. DB 보존 후 중단합니다.");
      return;
    }
    // Build a stable order from exactly the source-delivered region choices.
    // No user-selected school ID and no blank / guessed geography parameters.
    jobs.clear();StringBuilder seed=new StringBuilder("R10|"+discoverFromYear+"|"+discoverToYear+"|");
    for(AreaScope region:originalAreas){
      seed.append(region.fingerprint()).append(';');
      for(int y=discoverToYear;y>=discoverFromYear;y--)
        for(String grade:new String[]{"1","2","3"})
          for(String term:TERMS)
            for(String subj:SUBJECTS)
              jobs.add(new Job(region,region.site,grade,String.valueOf(y),term,subj));
    }
    runKey=sha256(seed.toString());
    progress=store.load(runKey);
    // R14: First-page metadata was already saved during each region discovery.
    Diag.log("COLLECTOR_AREA_SET_READY",
      "areaScopes="+originalAreas.size()+" jobs="+jobs.size()+" checkpoint="+
      progress.taskIndex+":"+progress.page+" unique="+store.count());
    if(progress.finished||progress.taskIndex>=jobs.size()){
      showStatus("이 지역·연도 범위는 이미 마지막 페이지까지 조회했습니다. "+
        store.count()+"건 저장 · CSV/JSON으로 내보내십시오.");
      return;
    }
    // WebView remains on the last successful ORIGINAL previousExam.asp page,
    // so original comm.send(...) is available for listing requests.
    loaded=NativePdfTitleBridge.isFreeReadingPage(web.getUrl());
    if(!loaded){
      showStatus("원본 열람실 페이지가 없어 수집을 시작하지 않습니다.");return;
    }
    scope="ORIGINAL_AREA_ALL";
    running=true;requestPending=false;previousPageSignature="";prevTask=-1;
    showStatus("원본 지역 ‘전체’ "+originalAreas.size()+"개 범위 확보 · "+
      jobs.size()+"개 조건 수집 시작");
    nextPage();
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
    if(!scopeReady){
      showStatus("원본 검색 조건 읽기 전입니다. 열람실 로딩이 완료되어야 합니다.");return;
    }
    if(currentSchool.isEmpty()||currentCity.isEmpty()||currentDistrict.isEmpty()
      ||currentFilter.isEmpty()){
      showStatus("수집 차단: 원본의 학교 ID/시도/시군구/지역필터가 완전하지 않습니다. 빈 검색 조건으로 진행하지 않습니다.");
      Diag.log("COLLECTOR_SCOPE_INCOMPLETE","school="+currentSchool.length()
        +" city="+currentCity.length()+" district="+currentDistrict.length()
        +" filter="+currentFilter.length());return;
    }
    if(!currentSite.matches("[MH]")||!currentGrade.matches("[123]")
        ||!currentYear.matches("[0-9]{4}")
        ||!currentTerm.matches("(1M|1E|2M|2E)")||!currentSubject.matches("[A-Z]{2}")){
      showStatus("원본 학년·연도·과목 선택값을 확보하지 못했습니다. 임의 기본값으로 요청하지 않습니다.");return;
    }
    if(currentRows.length()==0){
      showStatus("원본 페이지의 시험지 목록이 0건입니다. 표시된 목록의 번호를 먼저 확인한 후 시작해야 잘못된 전체 수집을 피할 수 있습니다.");
      Diag.log("COLLECTOR_EMPTY_BASELINE","original page has no visible exam data");
      return;
    }
    jobs.clear();
    Job initial=new Job(currentSite,currentGrade,currentYear,currentTerm,currentSubject);
    if(useCurrent){
      jobs.add(initial);
      scope="CURRENT_FILTER_ORIGINAL";
    }else{
      jobs.add(initial);
      for(int y=finish;y>=begin;y--)
        for(String grade:new String[]{"1","2","3"})
          for(String term:TERMS)
            for(String subj:SUBJECTS){
              if(initial.year.equals(String.valueOf(y))&&initial.grade.equals(grade)
                 &&initial.term.equals(term)&&initial.subject.equals(subj))continue;
              jobs.add(new Job(currentSite,grade,String.valueOf(y),term,subj));
            }
      scope="ORIGINAL_REGION_SCHOOL_SET";
    }
    String seed="R9|"+scope+"|"+begin+"|"+finish+"|"+currentSite+"|"
      +currentSchool+"|"+currentCity+"|"+currentDistrict+"|"+currentFilter
      +"|"+currentGrade+"|"+currentYear+"|"+currentTerm+"|"+currentSubject;
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
    // Original server already rendered Page 1 into the WebView. Capture its
    // real IDs before any AJAX: source's scroll handler begins at Page 2.
    // Save the page atomically with the page-2 resume checkpoint.
    if(progress.taskIndex==0 && progress.page==1 && progress.pagesDone==0){
      ReadingCollectorStore.Progress next=new ReadingCollectorStore.Progress();
      next.taskIndex=0;next.page=2;next.pagesDone=1;
      next.rowsSeen=currentRows.length();
      store.savePage(runKey,next,currentRows,currentSite,currentGrade,
        currentYear,currentTerm,currentSubject,scope);
      progress=next;
      Diag.log("COLLECTOR_ORIGINAL_PAGE1_SAVED","rows="+currentRows.length()
        +" DB="+store.count()+" next=original AJAX Page 2");
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
    AreaScope a=job.region;
    data=append(data,"Rg_CitiesProvinces",a==null?currentCity:a.city);
    data=append(data,"Rg_District",a==null?currentDistrict:a.district);
    data=append(data,"Scl_ID",a==null?currentSchool:a.schools);
    data=append(data,"Exfl_Group","");
    data+="&Kind=REGION&Page="+page+"&PageSize="+PER_PAGE;
    data=append(data,"ExPapr_CoreType","E");
    data=append(data,"Grade",job.grade);
    data=append(data,"ExPapr_TestYear",job.year);
    data=append(data,"ExPapr_MidEndTerm",job.term);
    data=append(data,"Subj_Code",job.subject);
    data=append(data,"filter_gugun",a==null?currentFilter:a.filter);
    data+="&answer_chk_status=N&isAnswerPaid="+("Y".equals(a==null?currentPaid:a.paid)?"Y":"N");
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
      +(job.region==null?"현재 지역":job.region.name+" 전체")+
      " / "+job.site+" "+job.grade+"학년 "+job.year+"년 "+job.term+" "+job.subject
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
      final String sourceScope=job.region==null?scope:"ORIGINAL_AREA:"+job.region.site+"/"+job.region.name;
      final int saved=store.savePage(runKey,next,list,job.site,job.grade,job.year,job.term,job.subject,sourceScope);
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
      logNine("PAGE_SAVED","task="+task+" page="+page+" rows="+list.length());
    }catch(Throwable t){
      ui.post(()->{requestPending=false;pause("메타데이터 저장 실패: "+t.getClass().getSimpleName());});
      Diag.log("COLLECTOR_STORE_ERROR",t.getClass().getName());
    }
  }
  private void pause(String reason){
    if(discovering){stopDiscovery(reason);return;}
    if(!running){showStatus(reason);return;}
    running=false;requestPending=false;
    ReadingCollectorStore.Progress saved=store.load(runKey);
    Diag.log("COLLECTOR_PAUSED",reason+" persisted_checkpoint="+saved.taskIndex+":"+saved.page+" db_rows="+store.count());
    logNine("PAUSED",reason);
    showStatus(reason+" · 이미 수집한 "+store.count()+"건 유지");
  }
  private void finish(){
    running=false;requestPending=false;progress.finished=true;
    store.saveProgress(runKey,progress);
    Diag.log("COLLECTOR_FINISHED","jobs="+jobs.size()+" unique="+store.count());
    logNine("FINISHED","jobs="+jobs.size());
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
    if(discovering){stopDiscovery("파일 내보내기를 위해 지역 탐색 일시정지");}
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
    destroyed=true;running=false;discovering=false;
    activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    try{web.removeJavascriptInterface("hitelCollectorNative");web.stopLoading();web.destroy();}
    catch(Throwable ignored){}
    store.close();
  }
}
