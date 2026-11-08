from pathlib import Path
p=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe/CallAccessibilityService.java")
s=p.read_text(encoding="utf-8")
def change(old,new):
 global s
 assert old in s, old[:150]
 s=s.replace(old,new,1)
change('''    private long lastSweep,lastCapture;''',
'''    private long lastSweep,lastCapture;
    /** Continuous live OEM-window scan, independent of Samsung event frequency.
     * This can observe live subtitles while Samsung remains an accessible window;
     * it cannot resurrect windows Android removes after backgrounding. */
    private final Runnable liveWindowPoll=new Runnable(){
        @Override public void run(){
            try{
                if(consoleRequested&&LabStore.running()&&"W03".equals(LabStore.currentScenario())){
                    scanNow("w03_live_poll");
                    updateOverlay();
                    if(overlayShown)refreshOverlayTimeline();
                }
            }catch(Throwable err){LabStore.log("W03_LIVE_POLL_ERROR",err.toString());}
            main.postDelayed(this,700);
        }
    };''')
change('''        main.post(this::updateOverlay);''',
'''        main.post(this::updateOverlay);
        main.removeCallbacks(liveWindowPoll);
        main.postDelayed(liveWindowPoll,700);''')
change('''                String pkg=s(root.getPackageName());if(!relevant(pkg))continue;''',
'''                String pkg=s(root.getPackageName());if(!relevant(pkg))continue;
                // Avoid polling HITEL's changing UI and emitting circular logs.
                if("w03_live_poll".equals(reason)&&!isSamsung(pkg))continue;''')
change('''    @Override public void onDestroy(){main.removeCallbacks(dialerMonitor);hideOverlay();consoleRequested=false;instance=null;''',
'''    @Override public void onDestroy(){main.removeCallbacks(liveWindowPoll);main.removeCallbacks(dialerMonitor);
        hideOverlay();consoleRequested=false;instance=null;''')
p.write_text(s,encoding="utf-8")
print("PASS v0.9 continuous Samsung live-window polling every 700ms; suppressed HITEL UI scan loop")
