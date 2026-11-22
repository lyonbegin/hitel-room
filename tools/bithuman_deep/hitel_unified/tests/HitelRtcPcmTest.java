package ai.hitel.media;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public final class HitelRtcPcmTest {
    public static void main(String[] args) {
        for (int rate : new int[]{8000,16000,44100,48000}) {
            HitelRtcPcm pcm = new HitelRtcPcm();
            int expectedSamples = 16000;
            byte[] source = new byte[expectedSamples * 2];
            ByteBuffer src = ByteBuffer.wrap(source).order(ByteOrder.LITTLE_ENDIAN);
            for (int i=0;i<expectedSamples;i++) src.putShort((short)(i+1));
            for (int i=0;i<source.length;i+=638)
                pcm.append(java.util.Arrays.copyOfRange(source,i,Math.min(source.length,i+638)));
            ByteBuffer dst=ByteBuffer.allocateDirect(rate/100*4).order(ByteOrder.LITTLE_ENDIAN);
            for (int block=0;block<100;block++) {
                pcm.read(dst,rate,2);
                for (int row=0;row<rate/100;row++) {
                    short expected=(short)(((long)block*rate/100+row)*16000/rate+1);
                    if(dst.getShort()!=expected || dst.getShort()!=expected) throw new AssertionError("PCM content");
                }
            }
            if(pcm.position()!=expectedSamples) throw new AssertionError("Lost or late PCM");
            pcm.read(dst,rate,2);
            while(dst.hasRemaining()) if(dst.get()!=0) throw new AssertionError("Underrun leaked audio");
            pcm.append(new byte[]{1,2});
            pcm.clear(); pcm.read(dst,rate,2);
            if(pcm.position()!=0 || dst.getShort()!=0) throw new AssertionError("Cancelled PCM leaked");
        }
        System.out.println("PASS: source PCM complete without video at 8, 16, 44.1 and 48 kHz");
    }
}
