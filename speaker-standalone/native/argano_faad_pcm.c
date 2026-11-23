/*
 * Growing 3GP4/M4A raw AAC -> 16 kHz mono S16LE stdout.
 *
 * NEW EXTERNAL IMPLEMENTATION: inspired by nerln/argano's AacCodec.segment
 * (MIT): libfaad NeAACDecDecode's bytesconsumed determines each raw AAC
 * access unit even when a final moov/stsz table does not exist.
 * Decoder: FreewareAdvancedAudio/faad2 (separate third-party dependency).
 * Resampler: FFmpeg libswresample; no HITEL aac_mdat_follow or MediaCodec.
 *
 * Usage: libargano-faad-pcm.so file.m4a follow|fixed
 * stdout: UNFRAMED S16LE mono 16000 Hz PCM. No diagnostics on stdout.
 * stderr: ARGANO_FAAD_* log lines.
 *
 * The input file is never modified. It is opened once and read sequentially.
 * Partial AAC access units remain in pending until more input is available.
 */
#define _POSIX_C_SOURCE 200809L
#include <neaacdec.h>
#include <libswresample/swresample.h>
#include <libavutil/channel_layout.h>
#include <libavutil/samplefmt.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#define PENDING_MAX (256u*1024u)
#define NEW_DATA_BUFFER 8192u
static uint8_t pending[PENDING_MAX];
static size_t pendingLen;
static long long cursor;
static long long dataEnd=-1;
static NeAACDecHandle aac;
static SwrContext *resampler;
static int configuredChannels;
static long long frames, outBytes;

static void sleepMs(long ms){
  struct timespec ts={ms/1000,(ms%1000)*1000000};
  nanosleep(&ts,NULL);
}
static uint32_t be32(const uint8_t *p){
  return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3];
}
static uint64_t be64(const uint8_t *p){
  return ((uint64_t)be32(p)<<32)|be32(p+4);
}
static long long mdatOffset(FILE *f,long long sz){
  uint8_t h[16];long long pos=0;
  while(pos+8<=sz && pos<1024*1024){
    if(fseeko(f,(off_t)pos,SEEK_SET)!=0)return -1;
    if(fread(h,1,8,f)!=8)return -1;
    uint64_t size=be32(h);
    int header=8;
    if(size==1){
      if(pos+16>sz||fread(h+8,1,8,f)!=8)return -1;
      size=be64(h+8);header=16;
    }
    if(!memcmp(h+4,"mdat",4)){
      if(size>=((uint64_t)header) && size<(uint64_t)INT64_MAX)
        dataEnd=pos+(long long)size;
      return pos+header;
    }
    if(size<header)return -1;
    pos+=(long long)size;
  }
  return -1;
}
static int initAac(void){
  static unsigned char asc[2]={0x11,0x88}; /* AAC-LC 48kHz mono */
  unsigned long rate=0;unsigned char channels=0;
  aac=NeAACDecOpen();
  if(!aac)return -1;
  NeAACDecConfigurationPtr cfg=NeAACDecGetCurrentConfiguration(aac);
  cfg->outputFormat=FAAD_FMT_16BIT;
  if(!NeAACDecSetConfiguration(aac,cfg))return -1;
  if(NeAACDecInit2(aac,asc,2,&rate,&channels)!=0)return -1;
  fprintf(stderr,"ARGANO_FAAD_INIT:rate=%lu:declaredChannels=%u\n",rate,channels);
  return rate==48000?0:-1;
}
static int setupResample(int channels){
  if(channels!=1 && channels!=2)return -1;
  int64_t inLayout=channels==1?AV_CH_LAYOUT_MONO:AV_CH_LAYOUT_STEREO;
  resampler=swr_alloc_set_opts(NULL,AV_CH_LAYOUT_MONO,AV_SAMPLE_FMT_S16,16000,
                             inLayout,AV_SAMPLE_FMT_S16,48000,0,NULL);
  if(!resampler||swr_init(resampler)<0)return -1;
  configuredChannels=channels;
  fprintf(stderr,"ARGANO_FAAD_RESAMPLE:48000:%d->16000:1\n",channels);
  return 0;
}
static int sendPcm(const void *s16,unsigned long totalSamples,int channels){
  if(totalSamples==0)return 0; /* AAC priming frame */
  if(channels!=1 && channels!=2)return -1;
  if(!resampler && setupResample(channels)!=0)return -1;
  if(configuredChannels!=channels)return -1;
  int inputFrames=(int)(totalSamples/(unsigned long)channels);
  uint8_t output[16384];
  uint8_t *out[1]={output};
  const uint8_t *in[1]={(const uint8_t *)s16};
  int produced=swr_convert(resampler,out,(int)(sizeof(output)/2),in,inputFrames);
  if(produced<0)return -1;
  size_t bytes=(size_t)produced*2;
  if(bytes && fwrite(output,1,bytes,stdout)!=bytes)return -1;
  if(bytes && fflush(stdout))return -1;
  outBytes+=(long long)bytes;
  return 0;
}
static int drainResample(void){
  if(!resampler)return 0;
  uint8_t output[16384];uint8_t *out[1]={output};
  for(int i=0;i<32;i++){
    int n=swr_convert(resampler,out,(int)(sizeof(output)/2),NULL,0);
    if(n<0)return -1;
    if(!n)break;
    size_t b=(size_t)n*2;
    if(fwrite(output,1,b,stdout)!=b)return -1;
    outBytes+=(long long)b;
  }
  return fflush(stdout)==0?0:-1;
}
int main(int argc,char **argv){
  if(argc!=3 || (strcmp(argv[2],"follow") && strcmp(argv[2],"fixed"))){
    fprintf(stderr,"usage: argano-faad-pcm file.m4a follow|fixed\n");return 2;
  }
  int fixed=!strcmp(argv[2],"fixed");
  FILE *f=fopen(argv[1],"rb");
  if(!f){perror("ARGANO_FAAD_OPEN");return 3;}
  setvbuf(stderr,NULL,_IOLBF,0);
  if(initAac()!=0){fprintf(stderr,"ARGANO_FAAD_ERROR:INIT\n");return 4;}
  int ready=0, idle=0;
  for(;;){
    struct stat st;
    if(fstat(fileno(f),&st)!=0){perror("ARGANO_FAAD_FSTAT");return 5;}
    long long size=(long long)st.st_size;
    if(!ready){
      long long begin=mdatOffset(f,size);
      if(begin<0){
        if(fixed){fprintf(stderr,"ARGANO_FAAD_ERROR:NO_MDAT\n");return 6;}
        sleepMs(30);continue;
      }
      cursor=begin;
      ready=1;
      fprintf(stderr,"ARGANO_FAAD_MDAT:offset=%lld:declaredEnd=%lld\n",begin,dataEnd);
    }
    long long end=size;
    if(dataEnd>=0 && dataEnd<end)end=dataEnd;
    if(end<cursor){
      fprintf(stderr,"ARGANO_FAAD_ERROR:FILE_TRUNCATED\n");return 7;
    }
    long long have=end-cursor-(long long)pendingLen;
    if(have>0){
      size_t take=have>NEW_DATA_BUFFER?NEW_DATA_BUFFER:(size_t)have;
      if(pendingLen+take>PENDING_MAX){
        fprintf(stderr,"ARGANO_FAAD_ERROR:PENDING_OVERFLOW\n");return 8;
      }
      if(fseeko(f,(off_t)(cursor+(long long)pendingLen),SEEK_SET)!=0)return 9;
      size_t got=fread(pending+pendingLen,1,take,f);
      clearerr(f);
      if(got>0){pendingLen+=got;idle=0;}
      else{sleepMs(20);continue;}
    }else if(!fixed){sleepMs(25);continue;}
    size_t processed=0;
    while(processed<pendingLen){
      NeAACDecFrameInfo info;
      memset(&info,0,sizeof(info));
      void *samples=NeAACDecDecode(aac,&info,pending+processed,
                                    (unsigned long)(pendingLen-processed));
      if(info.error||info.bytesconsumed==0){
        /* A truncated AAC frame is not discarded: retry after next write.
           Following argano, reset poisoned codec state for the next attempt. */
        if(info.error){
          NeAACDecClose(aac);aac=NULL;
          if(initAac()!=0)return 10;
          if(++idle==1 || idle%200==0)
            fprintf(stderr,"ARGANO_FAAD_PARTIAL:pending=%zu:error=%u\n",
                    pendingLen-processed,info.error);
        }
        break;
      }
      if(info.bytesconsumed>pendingLen-processed)return 11;
      if(info.samplerate!=48000 || (info.channels!=1&&info.channels!=2)){
        fprintf(stderr,"ARGANO_FAAD_ERROR:UNSUPPORTED_FORMAT:rate=%lu:channels=%u\n",
                info.samplerate,info.channels);return 12;
      }
      if(sendPcm(samples,info.samples,info.channels)<0)return 13;
      processed+=(size_t)info.bytesconsumed;
      frames++;
      if(frames<=3||frames%128==0)
        fprintf(stderr,"ARGANO_FAAD_FRAME:frames=%lld:cursor=%lld:pcmBytes=%lld:pending=%zu\n",
                frames,cursor+(long long)processed,outBytes,pendingLen-processed);
    }
    if(processed){
      pendingLen-=processed;
      if(pendingLen)memmove(pending,pending+processed,pendingLen);
      cursor+=(long long)processed;
    }
    if(fixed && cursor+(long long)pendingLen>=end){
      if(drainResample()!=0)return 14;
      fprintf(stderr,"ARGANO_FAAD_COMPLETE:frames=%lld:pcmBytes=%lld:remaining=%zu\n",
              frames,outBytes,pendingLen);
      if(pendingLen>0)return 15; /* don't silently claim a complete decode */
      break;
    }
    if(!fixed && pendingLen>=PENDING_MAX-NEW_DATA_BUFFER){
      fprintf(stderr,"ARGANO_FAAD_ERROR:STALLED_FRAME\n");return 16;
    }
  }
  if(resampler)swr_free(&resampler);
  if(aac)NeAACDecClose(aac);
  fclose(f);
  return frames>0?0:17;
}
