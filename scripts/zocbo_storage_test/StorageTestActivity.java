package com.hitel.zocbodiag;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.*;
import android.text.InputType;
import android.view.View;
public final class StorageTestActivity extends Activity {
  private EditText exam;
  private TextView status;
  private Button pick;
  private String selectedId;
  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    if(b!=null) selectedId=b.getString("id");
    LinearLayout layout=new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    int p=(int)(20*getResources().getDisplayMetrics().density);
    layout.setPadding(p,p,p,p);
    TextView title=new TextView(this); title.setText("HITEL PDF 저장 시험"); title.setTextSize(23); layout.addView(title);
    TextView help=new TextView(this); help.setText("정식 다운로드한 PDF 또는 직접 만든 PDF를 선택하십시오. 원본 앱과 별도로 설치됩니다."); layout.addView(help);
    exam=new EditText(this); exam.setHint("시험지 번호"); exam.setInputType(InputType.TYPE_CLASS_NUMBER); exam.setText("15958886"); layout.addView(exam);
    pick=new Button(this);pick.setText("PDF 선택 및 저장"); layout.addView(pick);
    status=new TextView(this); status.setText("저장 위치: Download/HITEL-Zocbo/"); status.setTextIsSelectable(true);layout.addView(status);
    setContentView(layout);
    pick.setOnClickListener(v->{
      String id=exam.getText().toString().trim();
      if(!id.matches("[1-9][0-9]{0,9}")) { status.setText("시험지 번호를 확인하십시오."); return; }
      selectedId=id;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.setType("application/pdf");i.addCategory(Intent.CATEGORY_OPENABLE);
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      try {startActivityForResult(i,1);} catch(Exception e){ status.setText("파일 선택 실패: "+e.getClass().getSimpleName()); }
    });
  }
  @Override protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);b.putString("id",selectedId);}
  @Override protected void onActivityResult(int r,int c,Intent data){
    super.onActivityResult(r,c,data);
    if(r!=1||c!=RESULT_OK||data==null||data.getData()==null)return;
    final Uri uri=data.getData(); final String id=selectedId;
    pick.setEnabled(false);status.setText("저장 중");
    new Thread(()->{
      String message;
      try {
        AuthorizedPdfStore.Result result=AuthorizedPdfStore.save(getApplicationContext(),id,uri,-1);
        message="저장 성공\n"+result.relativePath+"\n"+result.bytes+" bytes";
      }catch(Exception e){message="저장 실패: "+e.getMessage();}
      final String result=message;
      runOnUiThread(()->{status.setText(result);pick.setEnabled(true);});
    }).start();
  }
}
