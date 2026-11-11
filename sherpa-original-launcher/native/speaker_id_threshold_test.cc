// Public data ONLY. Compare speaker embedding cosine for two labeled speakers.
// Produces NO audio and NO transcription in logs.
#include "sherpa-onnx/c-api/c-api.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
static float cosine(const std::vector<float>& a,const std::vector<float>& b){
  double ab=0,aa=0,bb=0;
  for(size_t i=0;i<a.size();++i){ab+=double(a[i])*b[i];aa+=double(a[i])*a[i];bb+=double(b[i])*b[i];}
  return float(ab/sqrt(aa*bb));
}
static std::vector<float> embed(const SherpaOnnxSpeakerEmbeddingExtractor* ex,
                                const std::string& path){
  const auto* wave=SherpaOnnxReadWave(path.c_str());
  if(!wave){fprintf(stderr,"READ_FAILED %s\n",path.c_str());exit(5);}
  const auto* stream=SherpaOnnxSpeakerEmbeddingExtractorCreateStream(ex);
  SherpaOnnxOnlineStreamAcceptWaveform(stream,wave->sample_rate,wave->samples,wave->num_samples);
  SherpaOnnxOnlineStreamInputFinished(stream);
  if(!SherpaOnnxSpeakerEmbeddingExtractorIsReady(ex,stream)){
    fprintf(stderr,"EMBED_NOT_READY %s seconds %.2f\n",path.c_str(),
      double(wave->num_samples)/wave->sample_rate);exit(6);
  }
  const float* v=SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(ex,stream);
  if(!v){fprintf(stderr,"EMBED_FAILED %s\n",path.c_str());exit(7);}
  int dim=SherpaOnnxSpeakerEmbeddingExtractorDim(ex);
  std::vector<float> ans(v,v+dim);
  SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(v);
  SherpaOnnxDestroyOnlineStream(stream);
  SherpaOnnxFreeWave(wave);
  return ans;
}
int main(){
  const std::string model="/tmp/spk/model/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx";
  SherpaOnnxSpeakerEmbeddingExtractorConfig cfg{};
  cfg.model=model.c_str();cfg.num_threads=1;cfg.provider="cpu";
  const auto* ex=SherpaOnnxCreateSpeakerEmbeddingExtractor(&cfg);
  if(!ex){fprintf(stderr,"MODEL_LOAD_FAILED\n");return 3;}
  auto path=[](const char* n){return std::string("/tmp/spk/wav/")+n;};
  const auto f=embed(ex,path("fangjun-sr-2.wav"));
  const auto ft=embed(ex,path("fangjun-test-sr-1.wav"));
  const auto l=embed(ex,path("leijun-sr-1.wav"));
  const auto lt=embed(ex,path("leijun-test-sr-1.wav"));
  const auto u=embed(ex,path("liudehua-test-sr-1.wav"));
  float fSame=cosine(f,ft),lSame=cosine(l,lt);
  float fOther=cosine(f,l),fOther2=cosine(f,u),lOther=cosine(l,u);
  printf("PUBLIC_CAMPPLUS_V23_SPEAKER_ID_SCORES same_fangjun=%.4f same_leijun=%.4f different_fangjun_leijun=%.4f different_fangjun_liudehua=%.4f different_leijun_liudehua=%.4f\n",
         fSame,lSame,fOther,fOther2,lOther);
  printf("V23_ACTUAL_THRESHOLDS_SELF_MIN=0.66 OTHER_MAX=0.43\n");
  printf("V23_LABELS f_self=%s l_self=%s cross_f_l=%s\n",
         fSame>=.66?"SELF":(fSame<=.43?"OTHER":"UNKNOWN"),
         lSame>=.66?"SELF":(lSame<=.43?"OTHER":"UNKNOWN"),
         fOther>=.66?"FALSE_SELF":(fOther<=.43?"OTHER":"UNKNOWN"));
  SherpaOnnxDestroySpeakerEmbeddingExtractor(ex);
  if(!(fSame>fOther && lSame>fOther)){fprintf(stderr,"SPEAKER_DISCRIMINATION_FAIL\n");return 4;}
  return 0;
}
