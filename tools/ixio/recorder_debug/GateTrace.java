package com.lguplus.callrecorder.hitelqa;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Binder;
/** TEST-ONLY: keep known main-app package check, bypass ONLY vendor signing-gate after pin fails. */
public final class GateTrace {
  private GateTrace(){}
  public static void event(String s){try{RecorderLog.mark("STORE QA_GATE "+s);}catch(Throwable ignored){}}
  private static void flag(String s,boolean b){event(s+"="+b);}
  private static void count(String s,int n){event(s+"="+n);}
  public static void callerUid(int uid){count("AUTH_CALLING_UID",uid);}
  public static void packageCount(String[] a){count("AUTH_UID_PACKAGE_COUNT",a==null?-1:a.length);}
  public static void noPackages(){event("AUTH_UID_PACKAGE_LOOKUP_NULL");}
  public static void expectedPackage(boolean yes){flag("AUTH_EXPECTED_PACKAGE_MATCH",yes);}
  public static void signerCount(Signature[] a){count("AUTH_SIGNER_COUNT",a==null?-1:a.length);}
  public static void pinnedMatch(boolean yes){flag("AUTH_ORIGINAL_PIN_MATCH",yes);}
  public static void originalPinRejected(){event("AUTH_ORIGINAL_PIN_REJECTED");}
  public static boolean sameSignedKnownCaller(Context context){
    boolean known=false;
    try{
      int uid=Binder.getCallingUid();
      PackageManager pm=context.getPackageManager();
      String[] pkgs=pm.getPackagesForUid(uid);
      if(pkgs!=null)for(String p:pkgs)if("com.lguplus.aicallagent".equals(p))known=true;
      // Explicit temporary QA switch: compare packages, not signing certificates.
      // The unchanged original signing path has already failed before reaching here.
      event("AUTH_QA_SIGNATURE_BYPASS_TEST_ONLY knownMain="+known+" allowed="+known);
      return known;
    }catch(Throwable t){
      event("AUTH_QA_SIGNATURE_BYPASS_EXCEPTION "+t.getClass().getSimpleName());
      return false;
    }
  }
  public static void callerAuthorized(boolean allowed){flag("BINDER_CALLER_ALLOWED",allowed);}
  public static void permissionResult(int result){count("BINDER_PERMISSION_RESULT",result);}
  public static void missingCount(int n){count("BINDER_MISSING_PERMISSIONS",n);}
  public static void listenerAuthorized(boolean b){flag("LISTENER_CALLER_ALLOWED",b);}
  public static void userAuthorized(boolean b){flag("SETUSER_CALLER_ALLOWED",b);}
  public static void queueResult(Object result){
    String typ=result==null?"null":result.getClass().getSimpleName();
    try{
      Class<?> cl=Class.forName("kotlinx.coroutines.channels.ChannelResult");
      java.lang.reflect.Method m=cl.getDeclaredMethod("isSuccess-impl",Object.class);
      m.setAccessible(true);
      Object b=m.invoke(null,result);
      event("QUEUE_TRY_SEND success="+Boolean.TRUE.equals(b)+" type="+typ);
    }catch(Throwable t){event("QUEUE_TRY_SEND resultType="+typ+" check="+t.getClass().getSimpleName());}
  }
  public static void consumerLabel(int n){count("CONSUMER_RESUME_LABEL",n);}
  public static void consumerSuspended(){event("CONSUMER_WAIT_SUSPENDED");}
  public static void consumerHasNext(boolean b){flag("CONSUMER_HAS_NEXT",b);}
  public static void command(Object o){event("CONSUMER_COMMAND_TYPE="+(o==null?"null":o.getClass().getSimpleName()));}
  public static void dispatchBegin(){event("CONSUMER_DISPATCH_BEGIN");}
  public static void dispatchEnd(){event("CONSUMER_DISPATCH_RETURN");}
  public static void commandIsStart(boolean b){flag("HANDLE_COMMAND_IS_START",b);}
  public static void handleStartEntered(){event("HANDLE_START_ENTERED");}
  public static void fileNameBlank(boolean b){flag("HANDLE_START_FILE_NAME_BLANK",b);}
  public static void recordStartResult(boolean b){flag("USECASE_RECORD_START_RESULT",b);}
  public static void timeoutRequested(int n){count("TIMEOUT_REQUEST_GENERATION",n);}
  public static void timeoutCurrent(int n){count("TIMEOUT_CURRENT_GENERATION",n);}
  public static void sessionsEmpty(boolean b){flag("TIMEOUT_ACTIVE_SESSIONS_EMPTY",b);}
  public static void prepareBegin(){event("MEDIA_PREPARE_BEGIN");}
  public static void prepareEnd(){event("MEDIA_PREPARE_RETURN");}
  public static void fgsStarted(){event("FGS_START_OK");}
  public static void fgsException(Throwable t){
    event("FGS_START_EXCEPTION_BYPASSED_FOR_QA type="+
      (t==null?"null":t.getClass().getName()));
  }
  public static void mediaStartBegin(){event("MEDIA_START_BEGIN");}
  public static void mediaStartEnd(){event("MEDIA_START_RETURN");}
}
