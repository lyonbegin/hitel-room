from pathlib import Path
base=Path("AndroidProject/app")
src=base/"src/main/java/app/hitel/samsungprobe"
main=src/"MainActivity.java"
w03=src/"W03ConsoleActivity.java"
gradle=base/"build.gradle.kts"
manifest=base/"src/main/AndroidManifest.xml"
s=main.read_text(encoding="utf-8")
def m_replace(old,new):
 global s
 assert old in s,("MainActivity anchor missing",old[:160])
 s=s.replace(old,new,1)
m_replace('''    private Button followButton;''',
'''    private Button followButton,accessibilitySetupButton;
    private boolean accessibilityGuideShown=false,accessibilitySettingsOpened=false;''')
m_replace('''root.addView(text("HITEL 통화 기능 검증 v0.6",20,Color.BLACK,true));''',
'''root.addView(text("HITEL 통화 기능 검증 v0.13",20,Color.BLACK,true));''')
m_replace('''        actions.addView(button("접근성 설정",()->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))),new LinearLayout.LayoutParams(0,dp(40),1));''',
'''        accessibilitySetupButton=button("접근성 설정",this::openAccessibilitySettings);
        actions.addView(accessibilitySetupButton,new LinearLayout.LayoutParams(0,dp(40),1));''')
m_replace('''        setContentView(root);showTab("flow");handler.post(monitor);''',
'''        setContentView(root);showTab("flow");handler.post(monitor);
        // Installation alone cannot start Settings. First foreground launch can.
        handler.postDelayed(this::showAccessibilityGuideOnFirstLaunch,420);''')
m_replace('''    private boolean accessibilityEnabled(){''',
'''    private void openAccessibilitySettings(){
        accessibilitySettingsOpened=true;
        try{
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            LabStore.log("W13_ACCESSIBILITY_SETTINGS_OPENED",
                "User approved opening Android accessibility settings");
        }catch(Exception e){
            toast("접근성 설정을 열지 못했습니다. 휴대전화 설정 → 접근성 → 설치된 앱에서 HITEL을 선택해 주십시오.");
            LabStore.log("W13_ACCESSIBILITY_SETTINGS_FAILED",e.toString());
        }
    }
    private void openRestrictedSettingsHelp(){
        new AlertDialog.Builder(this)
            .setTitle("접근성 항목이 비활성화된 경우")
            .setMessage("Android 13 이상에서는 APK를 직접 설치한 앱의 접근성 서비스가 제한될 수 있습니다. 믿을 수 있는 앱인지 확인하신 다음, 설정 → 애플리케이션 → HITEL 통화 실시간 자막 v0.13 → 우측 상단 메뉴(⋮) → '제한된 설정 허용'을 선택하십시오. 그 다음 접근성 → 설치된 앱 → HITEL 통화 흐름검증 서비스를 켜십시오.")
            .setPositiveButton("앱 정보 열기",(d,w)->{
                try{
                    Intent appInfo=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    appInfo.setData(android.net.Uri.parse("package:"+getPackageName()));
                    startActivity(appInfo);
                }catch(Exception e){toast("휴대전화 설정 → 애플리케이션에서 HITEL 앱을 선택해 주십시오.");}
            })
            .setNegativeButton("닫기",null).show();
    }
    private void showAccessibilityGuideOnFirstLaunch(){
        if(isFinishing()||accessibilityGuideShown||accessibilityEnabled())return;
        accessibilityGuideShown=true;
        new AlertDialog.Builder(this)
            .setTitle("HITEL 접근성 서비스 설정")
            .setMessage("삼성 기본 전화 앱은 그대로 사용합니다. HITEL이 삼성 텍스트 통화 버튼과 상대방 자막을 확인하려면 접근성 서비스가 필요합니다.\n\n'접근성 설정 열기' → '설치된 앱' → 'HITEL 통화 흐름검증 - 화면 분석' → 사용을 켜 주십시오.\n\n사용 여부는 고객님이 직접 결정하십니다. 권한을 허용하지 않으면 자동 문자통화·실시간 자막 중계를 시작하지 않습니다.")
            .setPositiveButton("접근성 설정 열기",(d,w)->openAccessibilitySettings())
            .setNeutralButton("항목이 비활성화된 경우",(d,w)->openRestrictedSettingsHelp())
            .setNegativeButton("나중에",null)
            .show();
        LabStore.log("W13_FIRST_LAUNCH_ACCESSIBILITY_PROMPT",
            "Actual first app launch: explicit user consent required, no auto activation");
    }
    private boolean accessibilityEnabled(){''')
m_replace('''    @Override protected void onResume(){super.onResume();
        if(requesting&&accessibilityEnabled()&&!pendingId.isEmpty()){''',
'''    @Override protected void onResume(){super.onResume();
        handler.postDelayed(()->{
            boolean ready=accessibilityEnabled();
            if(accessibilitySetupButton!=null)
                accessibilitySetupButton.setText(ready?"접근성 연결됨":"접근성 설정");
            if(accessibilitySettingsOpened){
                accessibilitySettingsOpened=false;
                if(ready){
                    toast("HITEL 접근성 서비스가 활성화되었습니다.");
                    LabStore.log("W13_ACCESSIBILITY_ENABLED","Service found enabled on Android settings return");
                }else{
                    LabStore.log("W13_ACCESSIBILITY_NOT_ENABLED",
                        "User returned from Settings without enabling accessibility");
                }
            }
        },350);
        if(requesting&&accessibilityEnabled()&&!pendingId.isEmpty()){''')
main.write_text(s,encoding="utf-8")
w=w03.read_text(encoding="utf-8")
w=w.replace("HITEL v0.11 접근성 서비스를 먼저 활성화","HITEL v0.13 접근성 서비스를 먼저 활성화")
w=w.replace("HITEL v0.11 접근성 서비스 연결 필요","HITEL v0.13 접근성 서비스 연결 필요")
w=w.replace("v0.11 접근성 서비스를 활성화","v0.13 접근성 서비스를 활성화")
w=w.replace("삼성 화면의 HITEL 복귀 패널을 직접 눌러도 되며, ","")
w03.write_text(w,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v12"' in g
assert 'versionCode = 12' in g
g=g.replace('app.hitel.callflowlab.v12','app.hitel.callflowlab.v13')
g=g.replace('versionCode = 12','versionCode = 13')
g=g.replace('0.12.0-fullscreen-only-no-overlay','0.13.0-first-launch-accessibility')
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.12 (전체화면)' in m
manifest.write_text(m.replace('HITEL 통화 실시간 자막 v0.12 (전체화면)',
    'HITEL 통화 실시간 자막 v0.13 (접근성 첫 실행 안내)'),encoding="utf-8")
print("PASS v13: accessibility onboarding at first app launch; user-controlled Settings; return confirmation; no overlay; unique app package")
