package app.hitel.speakeronly;
import java.io.*;
import java.security.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/** Mutual proof of the user-selected 128-bit key; never sends key or audio to an unverified peer. */
final class CallTxAuth {
  private static byte[] nonce(){byte[] b=new byte[32];new SecureRandom().nextBytes(b);return b;}
  private static byte[] mac(String key,byte role,byte[] client,byte[] server)throws Exception{
    Mac h=Mac.getInstance("HmacSHA256");
    h.init(new SecretKeySpec(key.getBytes(StandardCharsets.US_ASCII),"HmacSHA256"));
    h.update(role);h.update(client);h.update(server);return h.doFinal();
  }
  private static byte[] read(DataInputStream in)throws IOException{byte[] b=new byte[32];in.readFully(b);return b;}
  static void client(String key,DataInputStream in,DataOutputStream out)throws Exception{
    byte[] c=nonce();out.write(c);out.flush();byte[] s=read(in);
    if(!MessageDigest.isEqual(read(in),mac(key,(byte)1,c,s)))throw new SecurityException("TX helper identity not verified");
    out.write(mac(key,(byte)2,c,s));out.flush();
  }
  static void server(String key,DataInputStream in,DataOutputStream out)throws Exception{
    byte[] c=read(in),s=nonce();out.write(s);out.write(mac(key,(byte)1,c,s));out.flush();
    if(!MessageDigest.isEqual(read(in),mac(key,(byte)2,c,s)))throw new SecurityException("TX client identity not verified");
  }
}
