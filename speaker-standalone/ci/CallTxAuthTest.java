package app.hitel.speakeronly;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;
public final class CallTxAuthTest {
  static void exercise(boolean good)throws Exception{
    try(ServerSocket server=new ServerSocket(0,1,InetAddress.getLoopbackAddress())){
      ExecutorService pool=Executors.newSingleThreadExecutor();
      String key="0123456789abcdef0123456789abcdef";
      Future<Boolean> peer=pool.submit(()->{
        try(Socket s=server.accept()){
          s.setSoTimeout(2000);
          CallTxAuth.server(key,new DataInputStream(s.getInputStream()),new DataOutputStream(s.getOutputStream()));return true;
        }catch(Exception e){return false;}
      });
      boolean ok=false;
      try(Socket c=new Socket(InetAddress.getLoopbackAddress(),server.getLocalPort())){
        c.setSoTimeout(2000);
        CallTxAuth.client(good?key:"ffffffffffffffffffffffffffffffff",new DataInputStream(c.getInputStream()),new DataOutputStream(c.getOutputStream()));ok=true;
      }catch(Exception e){}
      if(ok!=good||peer.get(3,TimeUnit.SECONDS)!=good)throw new AssertionError("mutual auth");
      pool.shutdownNow();
    }
  }
  public static void main(String[] args)throws Exception{exercise(true);exercise(false);System.out.println("PASS_TX_MUTUAL_AUTH_AND_WRONG_KEY_REJECTED");}
}
