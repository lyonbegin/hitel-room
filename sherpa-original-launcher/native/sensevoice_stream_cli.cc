// Galaxy Korean STT v3: keep official Sherpa SenseVoice model loaded once,
// read actual decoded audio incrementally from Android MediaExtractor/MediaCodec.
// stdin wire format: little-endian (uint32 seq, uint32 sample_count, PCM16_LE samples[]).
// (seq=0, sample_count=0) is the end of streaming source.
// stdout: STT_READY, STT_SEGMENT:<seq>:<Korean>, STT_FINISHED:<count>.
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <vector>
#include "sherpa-onnx/c-api/c-api.h"

static bool exact_read(void *dst,size_t n) {
  unsigned char *out=(unsigned char *)dst;size_t done=0;
  while(done<n) {
    ssize_t got=read(STDIN_FILENO,out+done,n-done);
    if(got<0){perror("stdin read");return false;}
    if(got==0)return false;
    done+=(size_t)got;
  }
  return true;
}
static uint32_t little32(const unsigned char *b) {
  return (uint32_t)b[0]|((uint32_t)b[1]<<8)|((uint32_t)b[2]<<16)|((uint32_t)b[3]<<24);
}
int main(int argc,char **argv) {
  setvbuf(stdout,nullptr,_IOLBF,0);
  setvbuf(stderr,nullptr,_IOLBF,0);
  if(argc!=3){fprintf(stderr,"USAGE: libsensevoice-stream.so tokens.txt model.int8.onnx\n");return 2;}
  SherpaOnnxOfflineRecognizerConfig cfg={};
  cfg.model_config.num_threads=2;
  cfg.model_config.provider="cpu";
  cfg.model_config.tokens=argv[1];
  cfg.model_config.sense_voice.model=argv[2];
  cfg.model_config.sense_voice.language="ko";
  cfg.model_config.sense_voice.use_itn=1;
  cfg.decoding_method="greedy_search";
  const SherpaOnnxOfflineRecognizer *rec=SherpaOnnxCreateOfflineRecognizer(&cfg);
  if(!rec){fprintf(stderr,"STT_MODEL_INITIALIZATION_FAILED\n");return 3;}
  printf("STT_READY\n");
  unsigned int count=0;
  int exit_code=0;
  for(;;) {
    unsigned char header[8];
    if(!exact_read(header,sizeof(header))){
      fprintf(stderr,"STREAM_SOURCE_EOF_OR_HEADER_ERROR\n");
      exit_code=4;break;
    }
    uint32_t seq=little32(header);
    uint32_t samples=little32(header+4);
    if(seq==0 && samples==0)break;
    if(seq==0 || samples<1 || samples>16000*12) {
      fprintf(stderr,"STREAM_SEGMENT_HEADER_INVALID seq=%u count=%u\n",seq,samples);
      exit_code=5;break;
    }
    std::vector<unsigned char> pcm(samples*2);
    if(!exact_read(pcm.data(),pcm.size())){
      fprintf(stderr,"STREAM_SEGMENT_PCM_TRUNCATED seq=%u\n",seq);
      exit_code=6;break;
    }
    std::vector<float> wave(samples);
    for(uint32_t i=0;i<samples;i++){
      uint16_t u=(uint16_t)pcm[2*i]|((uint16_t)pcm[2*i+1]<<8);
      int16_t value=(int16_t)u;
      wave[i]=(float)value/32768.f;
    }
    printf("STT_ACCEPTED:%u:%u\n",seq,samples);
    const SherpaOnnxOfflineStream *s=SherpaOnnxCreateOfflineStream(rec);
    if(!s){fprintf(stderr,"STT_STREAM_INIT_FAILED seq=%u\n",seq);exit_code=7;break;}
    SherpaOnnxAcceptWaveformOffline(s,16000,wave.data(),(int32_t)samples);
    SherpaOnnxDecodeOfflineStream(rec,s);
    const SherpaOnnxOfflineRecognizerResult *result=SherpaOnnxGetOfflineStreamResult(s);
    const char *text=result && result->text?result->text:"";
    printf("STT_SEGMENT:%u:%s\n",seq,text);
    if(result)SherpaOnnxDestroyOfflineRecognizerResult(result);
    SherpaOnnxDestroyOfflineStream(s);
    count++;
  }
  printf("STT_FINISHED:%u\n",count);
  SherpaOnnxDestroyOfflineRecognizer(rec);
  return exit_code;
}
