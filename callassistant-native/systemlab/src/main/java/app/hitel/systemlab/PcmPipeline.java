package app.hitel.systemlab;

public final class PcmPipeline {
    public static final int RATE = 16000;
    private PcmPipeline() {}
    public static byte[] tone(int millis, double hz) {
        if (millis < 1 || millis > 2000 || hz <= 0 || hz >= RATE / 2)
            throw new IllegalArgumentException("Invalid PCM tone");
        int count = RATE * millis / 1000;
        byte[] out = new byte[count * 2];
        for (int i = 0; i < count; i++) {
            short v = (short) (Math.sin(2 * Math.PI * hz * i / RATE) * 4000);
            out[i * 2] = (byte) v;
            out[i * 2 + 1] = (byte) (v >>> 8);
        }
        return out;
    }
    public static int peak(byte[] pcm, int length) {
        int peak = 0;
        for (int i = 0; i + 1 < length; i += 2) {
            short v = (short) ((pcm[i] & 255) | (pcm[i + 1] << 8));
            peak = Math.max(peak, Math.abs(v));
        }
        return peak;
    }
}
