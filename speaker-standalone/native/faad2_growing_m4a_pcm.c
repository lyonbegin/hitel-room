/*
 * External upstream implementation: FAAD2 2.11.4 (github.com/knik0/faad2).
 * AAC raw access units decoded directly by NeAACDecDecode(), as in
 * github.com/nerln/argano/argano/codecs/aac.py: bytesconsumed is the
 * frame boundary; returned samples are real PCM16.
 *
 * This is NOT HITEL aac_mdat_follow.c, not FFmpeg frame-size oracle,
 * and not Android MediaCodec. Output stdout is 48000Hz mono signed PCM16LE.
 * Java downsampling/512-sample FIFO is a separate layer.
 *
 * Usage: faad-growing-pcm /path/to/growing.m4a [--complete]
 * --complete means input file is immutable, so exit on EOF.
 */
#define _POSIX_C_SOURCE 200809L
#include <neaacdec.h>
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>

#define INPUT_LIMIT (4*1024*1024)
#define READ_BLOCK 65536

static void pause_ms(long ms) {
  struct timespec t={ms/1000,(ms%1000)*1000000L};
  while(nanosleep(&t,&t)&&errno==EINTR){}
}
static uint32_t be32(const unsigned char *p) {
  return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3];
}
static uint64_t be64(const unsigned char *p) {
  uint64_t x=0;for(int i=0;i<8;i++)x=(x<<8)|p[i];return x;
}
static int write_all(int fd,const void *p,size_t n){
  const unsigned char *b=p;
  while(n){ssize_t r=write(fd,b,n);
    if(r<0&&errno==EINTR)continue;
    if(r<=0)return -1;
    b+=r;n-=(size_t)r;
  }
  return 0;
}
static int locate_mdat(int fd,off_t size,off_t *start,off_t *limit){
  off_t off=0;
  while(off+8<=size && off<(off_t)(1024*1024)){
    unsigned char h[16];
    if(pread(fd,h,8,off)!=8)return 0;
    uint64_t box=be32(h),hdr=8;
    if(box==1){if(off+16>size)return 0;
      if(pread(fd,h+8,8,off+8)!=8)return 0;
      box=be64(h+8);hdr=16;
    }
    if(!memcmp(h+4,"mdat",4)){
      *start=off+(off_t)hdr;
      *limit=box==0?0:off+(off_t)box;
      fprintf(stderr,"FAAD2_MDAT_READY start=%" PRId64 " declaredEnd=%" PRId64 "\n",
        (int64_t)*start,(int64_t)*limit);
      return 1;
    }
    if(box<hdr||box>(uint64_t)(1024*1024))return -1;
    off+=(off_t)box;
  }
  return 0;
}
int main(int argc,char **argv){
  if(argc<2||argc>3){
    fprintf(stderr,"usage: faad-growing-pcm file.m4a [--complete]\n");return 2;
  }
  int complete=argc==3&&!strcmp(argv[2],"--complete");
  if(argc==3&&!complete)return 2;
  int fd=open(argv[1],O_RDONLY|O_CLOEXEC);
  if(fd<0){perror("FAAD2_OPEN");return 3;}
  NeAACDecHandle dec=NeAACDecOpen();
  if(!dec){fprintf(stderr,"FAAD2_OPEN_DECODER_FAILED\n");close(fd);return 4;}
  NeAACDecConfigurationPtr cfg=NeAACDecGetCurrentConfiguration(dec);
  cfg->outputFormat=FAAD_FMT_16BIT;
  cfg->downMatrix=1;
  if(!NeAACDecSetConfiguration(dec,cfg)){fprintf(stderr,"FAAD2_CONFIG_FAILED\n");return 5;}
  /* Samsung AAC LC 48kHz mono ASC: AOT2, sample-index3, channel1. */
  unsigned char asc[]={0x11,0x88};
  unsigned long rate=0; unsigned char channels=0;
  if(NeAACDecInit2(dec,asc,sizeof(asc),&rate,&channels)!=0 ||
     rate!=48000||channels!=1){
    fprintf(stderr,"FAAD2_ASC_FAILED rate=%lu channels=%u\n",rate,channels);
    return 6;
  }
  fprintf(stderr,"FAAD2_INIT_OK rate=%lu channels=%u mode=%s\n",
    rate,channels,complete?"complete":"growing");
  unsigned char *pending=malloc(INPUT_LIMIT);
  if(!pending){fprintf(stderr,"FAAD2_ALLOC_FAILED\n");return 7;}
  off_t start=0,limit=0,cursor=0;
  size_t pendingSize=0;
  unsigned long frames=0;
  uint64_t pcmBytes=0;
  int initialized=0;
  for(;;){
    struct stat st;
    if(fstat(fd,&st)!=0){perror("FAAD2_FSTAT");return 8;}
    if(!initialized){
      int found=locate_mdat(fd,st.st_size,&start,&limit);
      if(found<0){fprintf(stderr,"FAAD2_MDAT_INVALID\n");return 9;}
      if(!found){
        if(complete){fprintf(stderr,"FAAD2_NO_MDAT\n");return 10;}
        pause_ms(25);continue;
      }
      initialized=1;cursor=start;
    }
    off_t available=st.st_size;
    if(limit&&limit<available)available=limit;
    if(available<cursor){fprintf(stderr,"FAAD2_SOURCE_TRUNCATED\n");return 11;}
    if((size_t)(available-cursor)>INPUT_LIMIT-pendingSize){
      fprintf(stderr,"FAAD2_PENDING_OVERFLOW=%zu\n",pendingSize);return 12;
    }
    off_t want=available-cursor;
    if(want>READ_BLOCK)want=READ_BLOCK;
    if(want>0){
      ssize_t n=pread(fd,pending+pendingSize,(size_t)want,cursor);
      if(n<0&&errno==EINTR)continue;
      if(n<0){perror("FAAD2_PREAD");return 13;}
      if(n>0){cursor+=n;pendingSize+=(size_t)n;}
    }
    int produced=0;
    while(pendingSize>0){
      NeAACDecFrameInfo info={0};
      void *samples=NeAACDecDecode(dec,&info,pending,(unsigned long)pendingSize);
      if(info.error==0 && info.bytesconsumed>0 && info.bytesconsumed<=pendingSize){
        if(info.samples>0){
          if(info.channels!=1||info.samplerate!=48000||samples==NULL){
            fprintf(stderr,"FAAD2_UNEXPECTED_FORMAT=%lu/%u\n",info.samplerate,info.channels);
            return 14;
          }
          size_t bytes=(size_t)info.samples*sizeof(int16_t);
          if(write_all(STDOUT_FILENO,samples,bytes)!=0){
            fprintf(stderr,"FAAD2_PCM_PIPE_BROKEN\n");return 15;
          }
          pcmBytes+=bytes;produced++;
        }
        pendingSize-=(size_t)info.bytesconsumed;
        if(pendingSize)memmove(pending,pending+info.bytesconsumed,pendingSize);
        frames++;
      }else{
        /* Preserve undecodable/truncated tail until further bytes arrive.
         * No guessing or frame-skipping; never drop original M4A content.
         */
        if(pendingSize>32768){
          fprintf(stderr,"FAAD2_NO_FRAME_PROGRESS error=%u queued=%zu cursor=%" PRId64 "\n",
            info.error,pendingSize,(int64_t)cursor);return 16;
        }
        break;
      }
    }
    if(produced>0 && (frames<5 || frames%48==0)){
      fprintf(stderr,"FAAD2_PCM_FRAME frames=%lu pcmBytes=%" PRIu64
        " queued=%zu source=%" PRId64 "\n",frames,pcmBytes,pendingSize,(int64_t)cursor);
    }
    if(complete&&cursor>=available){
      fprintf(stderr,"FAAD2_COMPLETE frames=%lu pcmBytes=%" PRIu64 " undecoded=%zu\n",
        frames,pcmBytes,pendingSize);
      break;
    }
    if(want<=0 || (produced==0 && want<READ_BLOCK))pause_ms(20);
  }
  NeAACDecClose(dec);free(pending);close(fd);
  return frames>0&&pcmBytes>0?0:17;
}
