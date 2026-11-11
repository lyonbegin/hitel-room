/*
 * Persistent Samsung 3GP4/M4A mdat -> ADTS frame follower.
 *
 * Usage: libaac-mdat-follow.so <growing-mirror.m4a> [48000] [1]
 * stdout: uint32 LE byteCount + one complete ADTS AAC frame, repeated.
 * stderr: AAC_FOLLOW_READY, AAC_FOLLOW_CURSOR, AAC_FOLLOW_ERROR.
 *
 * The recording is never modified and is never reopened between increments.
 * The FFmpeg AAC-LC decoder is used as a size oracle until the PCM decoder
 * can accept complete compressed packets. No search for a terminal moov,
 * no silence/utterance segmentation, no repeated process/model init.
 */
#define _POSIX_C_SOURCE 200809L
#include <libavcodec/avcodec.h>
#include <libavutil/error.h>
#include <libavutil/mem.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#define MAX_FRAME 6144
#define MAX_PENDING (4*1024*1024)
#define MIN_SOURCE 64
static AVCodecContext *decoder;
static AVPacket *packet;
static AVFrame *decoded;
static uint8_t scratch[MAX_FRAME+AV_INPUT_BUFFER_PADDING_SIZE];
static long long checkCount,frameCount,bytesRead,sourceCursor,lastReportMs;
static uint8_t *pending;
static size_t pendingLen,pendingCapacity;
static int rate=48000,channels=1,sampleIndex=3;
static int liveEdge=0; // --live-edge: never replay the backlog accumulated during model prewarm.
#define MAX_CATCHUP_FRAMES 60 // 60 AAC-LC packets = approx 1.28 s; skip only if behind.
#define KEEP_LIVE_FRAMES 36 // approx 0.77 s of newest data when catching up.
#define KEEP_START_FRAMES 24 // 24*1024/48000=512ms of pre-ready Samsung AAC.

static long long nowMs(void){
  struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);
  return (long long)t.tv_sec*1000+(long long)t.tv_nsec/1000000;
}
static void sleepMs(long ms){
  struct timespec t={ms/1000,(ms%1000)*1000000};
  nanosleep(&t,NULL);
}
static int freqIndex(int f){
  const int rates[]={96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350};
  for(int i=0;i<13;i++)if(rates[i]==f)return i;
  return -1;
}
static int decodes(const uint8_t *bytes,int n){
  if(n<1||n>MAX_FRAME)return 0;
  avcodec_flush_buffers(decoder);
  memcpy(scratch,bytes,n);
  memset(scratch+n,0,AV_INPUT_BUFFER_PADDING_SIZE);
  packet->data=scratch;
  packet->size=n;
  if(avcodec_send_packet(decoder,packet)<0)return 0;
  int ret=avcodec_receive_frame(decoder,decoded);
  av_frame_unref(decoded);
  return ret==0;
}
static int frameSize(const uint8_t *data,size_t avail){
  int high=avail<MAX_FRAME?(int)avail:MAX_FRAME;
  if(!high||!decodes(data,high))return 0;
  int low=1;
  while(low<high){
    int mid=low+(high-low)/2;
    if(decodes(data,mid))high=mid;else low=mid+1;
  }
  return low;
}
static int writeAll(const void *p,size_t n){
  const uint8_t *s=(const uint8_t *)p;
  while(n){
    size_t k=fwrite(s,1,n,stdout);
    if(k==0)return -1;
    s+=k;n-=k;
  }
  return 0;
}
static int emitAdts(const uint8_t *raw,int n,long long sourceEnd){
  int size=n+7;
  uint8_t h[19]={0};
  h[0]=(uint8_t)(size&255);
  h[1]=(uint8_t)((size>>8)&255);
  h[2]=(uint8_t)((size>>16)&255);
  h[3]=(uint8_t)((size>>24)&255);
  for(int i=0;i<8;i++)h[4+i]=(uint8_t)(((uint64_t)sourceEnd>>(i*8))&255);
  h[12]=0xff;h[13]=0xf1;
  h[14]=(uint8_t)((1<<6)|(sampleIndex<<2)|(channels>>2));
  h[15]=(uint8_t)(((channels&3)<<6)|(size>>11));
  h[16]=(uint8_t)((size>>3)&255);
  h[17]=(uint8_t)(((size&7)<<5)|0x1f);
  h[18]=0xfc;
  if(writeAll(h,sizeof(h))||writeAll(raw,(size_t)n))return -1;
  if(fflush(stdout))return -1;
  return 0;
}
static long long findMdat(const uint8_t *b,long long len){
  long long off=0;
  while(off+8<=len){
    uint64_t box=((uint64_t)b[off]<<24)|((uint64_t)b[off+1]<<16)|
      ((uint64_t)b[off+2]<<8)|b[off+3];
    int hdr=8;
    if(box==1){
      if(off+16>len)return -1;
      box=0;
      for(int j=0;j<8;j++)box=(box<<8)|b[off+8+j];
      hdr=16;
    }
    if(!memcmp(b+off+4,"mdat",4))return off+hdr;
    if(box<8 || box>(uint64_t)(1<<26))return -1;
    off+=(long long)box;
  }
  return -1;
}
static int ensurePending(size_t extra){
  if(extra>MAX_PENDING||pendingLen+extra>MAX_PENDING)return -1;
  if(pendingLen+extra>pendingCapacity){
    size_t cap=pendingCapacity?pendingCapacity:65536;
    while(cap<pendingLen+extra)cap*=2;
    if(cap>MAX_PENDING)cap=MAX_PENDING;
    uint8_t *next=realloc(pending,cap);
    if(!next)return -1;
    pending=next;pendingCapacity=cap;
  }
  return 0;
}
static int readGrowing(FILE *f,long long length){
  if(length<=bytesRead)return 0;
  long long want=length-bytesRead;
  if(want>MAX_PENDING-(long long)pendingLen)return -1;
  if(ensurePending((size_t)want))return -1;
  if(fseeko(f,(off_t)bytesRead,SEEK_SET)!=0)return -1;
  size_t done=fread(pending+pendingLen,1,(size_t)want,f);
  if(done==0){clearerr(f);return 0;}
  pendingLen+=done;
  bytesRead+=(long long)done;
  clearerr(f);return (int)done;
}
int main(int argc,char **argv){
  if(argc<2||argc>5){fprintf(stderr,"USAGE: aac_mdat_follow file [rate] [channels] [--live-edge]\n");return 2;}
  if(argc==5){if(strcmp(argv[4],"--live-edge"))return 2;liveEdge=1;}
  if(argc>=3)rate=atoi(argv[2]);
  if(argc>=4)channels=atoi(argv[3]);
  sampleIndex=freqIndex(rate);
  if(sampleIndex<0||channels<1||channels>7)return 3;
  FILE *f=fopen(argv[1],"rb");
  if(!f){perror("open growing m4a");return 4;}
  setvbuf(stdout,NULL,_IONBF,0);
  av_log_set_level(AV_LOG_QUIET);
  const AVCodec *codec=avcodec_find_decoder(AV_CODEC_ID_AAC);
  if(!codec)return 5;
  decoder=avcodec_alloc_context3(codec);
  decoder->extradata=av_mallocz(2+AV_INPUT_BUFFER_PADDING_SIZE);
  if(!decoder->extradata)return 6;
  decoder->extradata[0]=(uint8_t)((2<<3)|(sampleIndex>>1));
  decoder->extradata[1]=(uint8_t)(((sampleIndex&1)<<7)|(channels<<3));
  decoder->extradata_size=2;
  decoder->err_recognition=AV_EF_EXPLODE|AV_EF_BITSTREAM|AV_EF_BUFFER;
  if(avcodec_open2(decoder,codec,NULL)<0)return 7;
  packet=av_packet_alloc();decoded=av_frame_alloc();
  if(!packet||!decoded)return 8;
  struct stat st;
  int initialized=0;
  long long lastSize=0,lastGrowth=nowMs();
  int bootstrap=liveEdge;
  long long droppedFrames=0,emittedFrames=0;
  fprintf(stderr,"AAC_FOLLOW_STARTED:rate=%d:channels=%d:liveEdge=%d\n",rate,channels,liveEdge);
  for(;;){
    if(fstat(fileno(f),&st)!=0){perror("fstat");return 9;}
    long long sz=(long long)st.st_size;
    if(sz<lastSize){fprintf(stderr,"AAC_FOLLOW_ERROR:SOURCE_TRUNCATED\n");return 10;}
    lastSize=sz;
    if(!initialized){
      if(sz<MIN_SOURCE){sleepMs(50);continue;}
      uint8_t header[4096];
      if(fseeko(f,0,SEEK_SET)!=0)return 11;
      size_t n=fread(header,1,sizeof(header),f);clearerr(f);
      long long begin=findMdat(header,(long long)n);
      if(begin<0){
        if(sz>8192){fprintf(stderr,"AAC_FOLLOW_ERROR:NO_MDAT\n");return 12;}
        sleepMs(50);continue;
      }
      bytesRead=begin;sourceCursor=begin;
      initialized=1;
      fprintf(stderr,"AAC_FOLLOW_READY:mdatOffset=%lld\n",begin);
      fflush(stderr);
    }
    int added=readGrowing(f,sz);
    if(added<0){fprintf(stderr,"AAC_FOLLOW_ERROR:BUFFER_OR_READ\n");return 13;}
    if(added>0)lastGrowth=nowMs();
    if(added==0){sleepMs(40);continue;} // never recompute frames without new bytes
    long long before=frameCount;
    size_t consumed=0;
    // The raw Samsung mdat AAC has no frame delimiters. Parse complete packets
    // to advance an exact source cursor before deciding what to emit.
    size_t cap=64,count=0;
    size_t *ends=(size_t*)malloc(cap*sizeof(*ends));
    if(!ends)return 15;
    while(consumed<pendingLen){
      int n=frameSize(pending+consumed,pendingLen-consumed);
      if(n<=0)break; // partial AAC frame: preserve bytes until next growth
      if(count==cap){
        size_t nextCap=cap*2;
        size_t* resized=(size_t*)realloc(ends,nextCap*sizeof(*ends));
        if(!resized){free(ends);return 15;}
        ends=resized;cap=nextCap;
      }
      consumed+=(size_t)n;
      ends[count++]=consumed;
    }
    size_t skip=0;
    if(bootstrap){
      // Keep precisely the newest ~0.5 sec (24 complete 48k AAC frames).
      // Earlier audio preceding recognizer readiness is explicitly skipped.
      // AAC frames are parsed before skipping: never seek into raw mdat bytes.
      skip=count>KEEP_START_FRAMES?count-KEEP_START_FRAMES:0;
      bootstrap=0;
      fprintf(stderr,"AAC_FOLLOW_LIVE_EDGE_INITIAL:source=%lld:skipFrames=%zu:preservedFrames=%zu:preRollMs=%zu:sourceBytes=%lld\n",
        sourceCursor+(long long)consumed,skip,count-skip,
        (count-skip)*1024UL*1000UL/(unsigned long)rate,sz);
      fflush(stderr);
    }else if(liveEdge && count>MAX_CATCHUP_FRAMES){
      // For a stalled/slow consumer, emit only freshest ~770ms, not a delayed
      // multi-second replay. Other ASR work is unchanged.
      skip=count-KEEP_LIVE_FRAMES;
      fprintf(stderr,"AAC_FOLLOW_LIVE_EDGE_CATCHUP:source=%lld:skipped=%zu:fresh=%zu:bytesBehind=%lld\n",
        sourceCursor+(long long)(skip?ends[skip-1]:0),skip,count-skip,
        sz-(sourceCursor+(long long)consumed));
      fflush(stderr);
    }
    if(skip){
      droppedFrames+=(long long)skip;
      fprintf(stderr,"AAC_FOLLOW_LIVE_EDGE_SKIP:source=%lld:skippedFrames=%zu:totalSkipped=%lld\n",
        sourceCursor+(long long)ends[skip-1],skip,droppedFrames);
      fflush(stderr);
    }
    for(size_t k=skip;k<count;++k){
      const size_t start=k?ends[k-1]:0;
      const size_t len=ends[k]-start;
      if(emitAdts(pending+start,(int)len,sourceCursor+(long long)ends[k])<0){
        free(ends);fprintf(stderr,"AAC_FOLLOW_ERROR:OUTPUT_BROKEN\n");return 14;
      }
      emittedFrames++;
    }
    frameCount+=(long long)count;
    free(ends);
    if(consumed){
      pendingLen-=consumed;
      if(pendingLen)memmove(pending,pending+consumed,pendingLen);
      sourceCursor+=(long long)consumed;
    }
    if(frameCount!=before || (nowMs()-lastReportMs>2000 && initialized)){
      lastReportMs=nowMs();
      fprintf(stderr,"AAC_FOLLOW_CURSOR:source=%lld:read=%lld:frames=%lld:emitted=%lld:dropped=%lld:pending=%zu:added=%d:uptimeMs=%lld\n",
        sourceCursor,bytesRead,frameCount,emittedFrames,droppedFrames,pendingLen,added,lastReportMs);
      fflush(stderr);
    }
    if(added==0)sleepMs(30);
    else if(consumed==0)sleepMs(70);
  }
}
