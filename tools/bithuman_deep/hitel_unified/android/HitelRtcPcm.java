package ai.hitel.media;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayDeque;

/** One 16 kHz mono sample timeline per turn. The producer transfers immutable PCM chunks. */
public final class HitelRtcPcm {
    private final ArrayDeque<byte[]> chunks = new ArrayDeque<>();
    private int offset;
    private int buffered;
    private long phase;
    private long consumed;

    public void append(byte[] data) {
        if (data.length == 0) return;
        if ((data.length & 1) != 0) throw new IllegalArgumentException("PCM16 requires whole samples");
        chunks.addLast(data);
        buffered += data.length / 2;
    }

    public long position() { return consumed; }

    public void clear() {
        chunks.clear();
        offset = buffered = 0;
        consumed = phase = 0;
    }

    /** Write all bytes, including silence on source underrun. Called once per ADM capture block. */
    public void read(ByteBuffer dst, int rate, int channels) {
        dst.clear();
        dst.order(ByteOrder.LITTLE_ENDIAN);
        if (rate < 8000 || channels <= 0 || dst.remaining() % (2 * channels) != 0) {
            while (dst.hasRemaining()) dst.put((byte) 0);
            return;
        }
        while (dst.hasRemaining()) {
            short sample = 0;
            if (buffered > 0) {
                byte[] first = chunks.getFirst();
                short current = (short)((first[offset] & 255) | (first[offset + 1] << 8));
                short next = current;
                if (offset + 3 < first.length) {
                    next = (short)((first[offset + 2] & 255) | (first[offset + 3] << 8));
                } else if (buffered > 1) {
                    chunks.removeFirst();
                    byte[] following = chunks.getFirst();
                    next = (short)((following[0] & 255) | (following[1] << 8));
                    chunks.addFirst(first);
                }
                sample = (short)(current + (next - current) * phase / rate);
                phase += 16000;
                while (phase >= rate && buffered > 0) {
                    phase -= rate;
                    consumed++;
                    buffered--;
                    offset += 2;
                    if (offset == chunks.getFirst().length) { chunks.removeFirst(); offset = 0; }
                }
                if (buffered == 0) phase %= rate;
            }
            for (int c = 0; c < channels; c++) dst.putShort(sample);
        }
        dst.rewind();
    }
}
