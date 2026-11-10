/*
 * recover_m4a.c - rescue AAC audio from an .m4a whose recording was
 * interrupted (ftyp + mdat present, moov index never written).
 *
 * Raw AAC frames in mdat carry no sync words or lengths, so the frame
 * boundaries are recovered by using libavcodec's AAC decoder as an
 * oracle: a zero-padded packet [off, off+L) decodes without error only
 * when L >= the true frame length, so a binary search per frame finds it.
 * Each frame is then written out with an ADTS header (lossless).
 *
 * Build: cc -O2 -o recover_m4a recover_m4a.c $(pkg-config --cflags --libs libavcodec libavutil)
 * Usage: recover_m4a in.m4a out.aac [sample_rate=48000] [channels=1] [sizes.txt]
 *        then: ffmpeg -i out.aac -c copy out.m4a
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <libavcodec/avcodec.h>

#define MAX_FRAME 6144              /* 768 bytes/channel max per spec, be generous */
#define RESYNC_CHAIN 8              /* frames that must chain to accept a resync */

static AVCodecContext *ctx;
static AVPacket *pkt;
static AVFrame *frm;
static uint8_t pbuf[MAX_FRAME + AV_INPUT_BUFFER_PADDING_SIZE];

static int sr_index(int sr)
{
    static const int t[] = {96000, 88200, 64000, 48000, 44100, 32000, 24000,
                            22050, 16000, 12000, 11025, 8000, 7350};
    int i;
    for (i = 0; i < 13; i++) if (t[i] == sr) return i;
    return -1;
}

/* 1 if data[0..len) decodes as exactly one clean AAC frame */
static int decodes(const uint8_t *data, int len)
{
    int ret;
    avcodec_flush_buffers(ctx);     /* failed trials leave stale decoder state */
    memcpy(pbuf, data, len);
    memset(pbuf + len, 0, AV_INPUT_BUFFER_PADDING_SIZE);
    pkt->data = pbuf;
    pkt->size = len;
    if (avcodec_send_packet(ctx, pkt) < 0) return 0;
    ret = avcodec_receive_frame(ctx, frm);
    av_frame_unref(frm);
    return ret == 0;
}

/* exact length of the frame starting at data, or 0 if none */
static int frame_len(const uint8_t *data, long avail)
{
    int lo = 1, hi = avail < MAX_FRAME ? (int)avail : MAX_FRAME;
    if (hi < 1 || !decodes(data, hi)) return 0;
    while (lo < hi) {               /* smallest L that decodes */
        int mid = lo + (hi - lo) / 2;
        if (decodes(data, mid)) hi = mid; else lo = mid + 1;
    }
    if (lo > 1 && decodes(data, lo - 1)) return 0;   /* sanity */
    return lo;
}

/* true if RESYNC_CHAIN consecutive frames parse starting at off */
static int chains(const uint8_t *buf, long off, long end)
{
    int i, n;
    for (i = 0; i < RESYNC_CHAIN; i++) {
        if (off >= end || !(n = frame_len(buf + off, end - off))) return 0;
        off += n;
    }
    return 1;
}

/* locate mdat payload; returns offset, sets *end */
static long find_mdat(const uint8_t *b, long size, long *end)
{
    long off = 0;
    while (off + 8 <= size) {
        uint64_t sz = ((uint64_t)b[off] << 24) | (b[off+1] << 16) | (b[off+2] << 8) | b[off+3];
        int hdr = 8;
        if (sz == 1 && off + 16 <= size) {
            int i; sz = 0;
            for (i = 0; i < 8; i++) sz = (sz << 8) | b[off + 8 + i];
            hdr = 16;
        }
        if (!memcmp(b + off + 4, "mdat", 4)) {
            *end = (sz == 0 || off + (long)sz > size) ? size : off + (long)sz;
            return off + hdr;
        }
        if (sz < 8) break;
        off += (long)sz;
    }
    return -1;
}

int main(int argc, char **argv)
{
    FILE *f, *out, *sizes = NULL;
    uint8_t *buf, adts[7];
    long size, off, end, skipped = 0, nframes = 0;
    int sr = 48000, ch = 1, sri, n;
    const AVCodec *codec;

    if (argc < 3) {
        fprintf(stderr, "usage: %s in.m4a out.aac [sample_rate] [channels] [sizes.txt]\n", argv[0]);
        return 1;
    }
    if (argc > 3) sr = atoi(argv[3]);
    if (argc > 4) ch = atoi(argv[4]);
    if ((sri = sr_index(sr)) < 0) { fprintf(stderr, "bad sample rate\n"); return 1; }

    if (!(f = fopen(argv[1], "rb"))) { perror(argv[1]); return 1; }
    fseek(f, 0, SEEK_END); size = ftell(f); fseek(f, 0, SEEK_SET);
    buf = malloc(size);
    if (fread(buf, 1, size, f) != (size_t)size) { perror("read"); return 1; }
    fclose(f);

    if ((off = find_mdat(buf, size, &end)) < 0) { fprintf(stderr, "no mdat found\n"); return 1; }
    fprintf(stderr, "mdat payload: %ld .. %ld (%ld bytes)\n", off, end, end - off);

    av_log_set_level(AV_LOG_QUIET);
    codec = avcodec_find_decoder(AV_CODEC_ID_AAC);
    ctx = avcodec_alloc_context3(codec);
    ctx->extradata = av_mallocz(2 + AV_INPUT_BUFFER_PADDING_SIZE);
    ctx->extradata[0] = (2 << 3) | (sri >> 1);           /* AAC-LC AudioSpecificConfig */
    ctx->extradata[1] = ((sri & 1) << 7) | (ch << 3);
    ctx->extradata_size = 2;
    ctx->err_recognition = AV_EF_EXPLODE | AV_EF_BITSTREAM | AV_EF_BUFFER;
    if (avcodec_open2(ctx, codec, NULL) < 0) { fprintf(stderr, "decoder open failed\n"); return 1; }
    pkt = av_packet_alloc();
    frm = av_frame_alloc();

    if (!(out = fopen(argv[2], "wb"))) { perror(argv[2]); return 1; }
    if (argc > 5 && !(sizes = fopen(argv[5], "w"))) { perror(argv[5]); return 1; }

    while (off < end) {
        n = frame_len(buf + off, end - off);
        if (!n) {                   /* corruption or truncated tail: resync */
            long s = off + 1;
            while (s < end && !chains(buf, s, end)) s++;
            if (s >= end) { skipped += end - off; break; }
            fprintf(stderr, "resync: skipped %ld bytes at %ld\n", s - off, off);
            skipped += s - off;
            off = s;
            continue;
        }
        adts[0] = 0xFF; adts[1] = 0xF1;                  /* MPEG-4, no CRC */
        adts[2] = (1 << 6) | (sri << 2) | (ch >> 2);     /* profile LC */
        adts[3] = ((ch & 3) << 6) | ((n + 7) >> 11);
        adts[4] = ((n + 7) >> 3) & 0xFF;
        adts[5] = (((n + 7) & 7) << 5) | 0x1F;
        adts[6] = 0xFC;
        fwrite(adts, 1, 7, out);
        fwrite(buf + off, 1, n, out);
        if (sizes) fprintf(sizes, "%d\n", n);
        off += n;
        if (++nframes % 50000 == 0)
            fprintf(stderr, "  %ld frames (%.1f min), %.0f%%\n", nframes,
                    nframes * 1024.0 / sr / 60, 100.0 * off / end);
    }

    fprintf(stderr, "recovered %ld frames = %.2f min of audio; %ld bytes unrecoverable\n",
            nframes, nframes * 1024.0 / sr / 60, skipped);
    fclose(out);
    if (sizes) fclose(sizes);
    return 0;
}
