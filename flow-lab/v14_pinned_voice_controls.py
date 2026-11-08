from pathlib import Path

base=Path("AndroidProject/app/src/main")
w=base/"java/app/hitel/samsungprobe/W03ConsoleActivity.java"
g=Path("AndroidProject/app/build.gradle.kts")
s=w.read_text(encoding="utf-8")

def sub(a,b):
    global s
    assert a in s, "W03 pinned voice control anchor not found: "+a[:130]
    s=s.replace(a,b,1)

# The user's handset viewport shows only sections 1-2: mic and Vox settings
# were buried after a 270dp caption ListView nested in a ScrollView.
# Keep the actual STT button (not a cosmetic duplicate) on the root screen,
# visible above the scrollable call/caption content in both normal/log tabs.
sub('''    private ScrollView scrollBody;''',
'''    private TextView pinnedMicState;
    private ScrollView scrollBody;''')

sub('''    private void status(String message){status.setText(message);}''',
'''    private void status(String message){
        if(status!=null)status.setText(message);
        if(pinnedMicState!=null)pinnedMicState.setText(message);
    }''')

sub('''        addButtonRow(content,sttButton,stop);
        content.addView(label(
           "한국어 Zipformer INT8''',
'''        // Real primary microphone controls pinned under the two activity tabs.
        // screen children before this: header, flowStatus, tabs, sc, logPage.
        LinearLayout micBar=container();
        micBar.setOrientation(LinearLayout.HORIZONTAL);
        micBar.addView(sttButton,new LinearLayout.LayoutParams(0,dp(54),1));
        micBar.addView(stop,new LinearLayout.LayoutParams(0,dp(54),1));
        screen.addView(micBar,3,new LinearLayout.LayoutParams(-1,dp(54)));
        pinnedMicState=label("한국어 마이크 대기 · 버튼을 누르면 STT가 시작됩니다.",12,false);
        pinnedMicState.setMaxLines(3);
        pinnedMicState.setPadding(dp(7),dp(3),dp(7),dp(3));
        pinnedMicState.setBackgroundColor(0xfff1f1f1);
        screen.addView(pinnedMicState,4,new LinearLayout.LayoutParams(-1,dp(52)));
        content.addView(label(
           "한국어 Zipformer INT8''')

sub('''        content.addView(voxSettings,new LinearLayout.LayoutParams(-1,dp(48)));''',
'''        // Keep original VoxSherpa model/settings UI one-tap visible,
        // regardless of content scroll position and caption list length.
        screen.addView(voxSettings,5,new LinearLayout.LayoutParams(-1,dp(48)));''')

# The v14 layout already makes the log ListView mutually exclusive with
# the call ScrollView. Do not reintroduce accessibility overlay.
assert 'TYPE_ACCESSIBILITY_OVERLAY' not in s
assert 'screen.addView(micBar,3' in s
assert 'screen.addView(voxSettings,5' in s
assert s.count('pinnedMicState=label(')==1
assert 'screen.addView(logPage,new LinearLayout.LayoutParams(-1,0,1));' in s
w.write_text(s,encoding="utf-8")

grad=g.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in grad
assert 'versionCode = 16' in grad
grad=grad.replace('versionCode = 16','versionCode = 17',1)
grad=grad.replace('0.14.2-upstream-vox-integrated','0.14.3-pinned-voice-vox-controls',1)
g.write_text(grad,encoding="utf-8")
print("PASS W03 genuine sherpa microphone and original VoxSherpa settings pinned above scroll area, no overlay, same app ID")
