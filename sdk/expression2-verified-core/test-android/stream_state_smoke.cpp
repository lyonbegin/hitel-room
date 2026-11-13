// Candidate-only verification against original PRE-INFERENCE oracle observations.
// These tests do not compare outputs to a live model or certify full-SDK parity.
#include "../include/expression2_stream_state.h"
#include <array>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <cstdio>
#ifdef EXPR2_STANDALONE_TEST_STUBS
extern "C" int expression2_verified_canon_history(const void* a,size_t as,void* b,size_t bs){
 if(!a||!b||as!=299520||bs!=4792320)return -1;
 auto* src=static_cast<const uint8_t*>(a);auto* dst=static_cast<uint8_t*>(b);
 for(size_t s=0;s<16;++s)for(size_t h=0;h<16;++h)
   std::memcpy(dst+(s*16+h)*18720,src+s*18720,18720);
 return 0;
}
extern "C" int expression2_verified_preprocess(const float*,size_t in,float*,size_t out){
 return (in==44000&&out==35200)?0:-1;
}
#endif

static std::vector<float> make_chunk(size_t n,size_t seed){
 std::vector<float> a(n);
 for(size_t i=0;i<n;++i){auto x=static_cast<int64_t>((i*7919u+seed*11113u)%100003u);
   a[i]=static_cast<float>(x-50000)/131072.0f;}
 return a;
}
static bool same_snapshot(const Expr2StreamSnapshot& a, size_t total){
 return a.pcm_samples==total&&a.scheduled_samples==total&&a.total_input_samples==total&&
 a.pcm_capacity_samples>=64000&&a.segment_open==1&&a.tail_pending==0&&
 a.canon_history_initialized==1&&a.step==0&&a.queued_native_frames==0;
}
static std::string run_cases(){
 int passed=0,failed=0;
 std::vector<uint8_t> canon(299520);
 for(size_t i=0;i<canon.size();++i)canon[i]=static_cast<uint8_t>((i*31u+7u)%251u);
 struct FeedCase {const char* name;std::vector<int> chunks;};
 const std::vector<FeedCase> feeds={
   {"empty_initial",{0}}, {"single_8",{8}},
   {"below_threshold",{25599}}, {"threshold_exact",{25600}},
   {"threshold_split",{8000,17600}},
   {"second_threshold",{25600,18399,1}},
   {"third_threshold",{25600,18400,25599,1}},
   {"many_small_chunks",{1600,1600,3200,6400,12800,1600,8000,10000}},
   {"capacity_growth",{32000,32000,1,64000}}
 };
 for(size_t ci=0;ci<feeds.size();++ci){
   auto* s=expression2_stream_create(canon.data(),canon.size());
   bool ok=s!=nullptr;
   std::vector<float> reference;
   if(ok)for(size_t j=0;j<feeds[ci].chunks.size();++j){
     auto a=make_chunk(feeds[ci].chunks[j],ci*37+j);
     ok=expression2_stream_feed(s,a.data(),a.size())==0;
     reference.insert(reference.end(),a.begin(),a.end());
     Expr2StreamSnapshot snap{};
     ok=ok&&expression2_stream_snapshot(s,&snap)==0&&same_snapshot(snap,reference.size());
     std::vector<float> readback(reference.size());
     ok=ok&&expression2_stream_copy_pcm(s,readback.data(),readback.size())==0&&
        (readback.empty()||std::memcmp(readback.data(),reference.data(),reference.size()*4)==0);
     if(!ok)break;
   }
   if(ok){passed++;} else {failed++;std::printf("EXPR2_CANDIDATE_FEED_FAIL %s\n",feeds[ci].name);}
   expression2_stream_destroy(s);
 }
 struct EndCase{bool open,tail;int64_t samples,end;};
 const std::vector<EndCase> ends={
   {false,false,0,0},{false,false,1000,500},{false,true,1000,100},
   {true,false,0,0},{true,false,1000,0},{true,false,1000,500},
   {true,false,1000,1000},{true,false,1000,1001},
   {true,false,1000,-1},{true,false,30000,15000},{true,true,25000,18000}
 };
 // Only the directly representable states are tested without internal-state
 // injection. Unreachable synthetic original states stay NOT VERIFIED here.
 for(size_t i=0;i<ends.size();++i){
   const auto& e=ends[i];
   if(e.tail||(!e.open&&e.samples>0)){continue;}
   auto* s=expression2_stream_create(canon.data(),canon.size());
   auto a=make_chunk(e.samples,17+i);
   bool ok=s&&(!e.open||expression2_stream_feed(s,a.data(),a.size())==0);
   ok=ok&&expression2_stream_end_segment(s,e.end)==0;
   Expr2StreamSnapshot snap{};
   ok=ok&&expression2_stream_snapshot(s,&snap)==0;
   auto expected=(e.open&&e.end>0&&e.end<e.samples)?e.end:e.samples;
   ok=ok&&snap.scheduled_samples==static_cast<uint64_t>(expected)&&
      snap.segment_open==e.open&&snap.tail_pending==e.open;
   if(ok)passed++;else{failed++;std::printf("EXPR2_CANDIDATE_END_FAIL %zu\n",i);}
   expression2_stream_destroy(s);
 }
 // Scheduler is deliberately backpressured: no backend or model invocation.
 const std::vector<int> counts={0,25599,25600,43999,44000,69599,69600};
 for(auto n:counts){
   auto* s=expression2_stream_create(canon.data(),canon.size());
   auto a=make_chunk(n,99);
   bool ok=s&&expression2_stream_feed(s,a.data(),a.size())==0;
   const auto gate=expression2_stream_scheduler_precheck(s);
   const auto expected=n>=25600?EXPR2_STREAM_BACKPRESSURED:EXPR2_STREAM_NOT_READY;
   if(ok&&gate==expected)passed++;else{failed++;std::printf("EXPR2_CANDIDATE_GATE_FAIL %d %d\n",n,gate);}
   expression2_stream_destroy(s);
 }
 // Connect a complete 44000-sample window to the previously proven DSP code.
 {
   auto* s=expression2_stream_create(canon.data(),canon.size());
   auto a=make_chunk(44000,901);
   std::vector<float> out(35200);
   bool ok=s&&expression2_stream_feed(s,a.data(),a.size())==0&&
        expression2_stream_preprocess_first_window(s,out.data(),out.size())==0;
   if(ok)passed++;else{failed++;std::puts("EXPR2_CANDIDATE_WINDOW_FAIL");}
   if(s){expression2_stream_reset(s);Expr2StreamSnapshot snap{};
     if(expression2_stream_snapshot(s,&snap)==0&&snap.pcm_samples==0&&
        snap.pcm_capacity_samples>=64000&&snap.segment_open==0&&snap.tail_pending==0)passed++;
     else {failed++;std::puts("EXPR2_CANDIDATE_RESET_FAIL");}}
   expression2_stream_destroy(s);
 }
 char message[160];
 std::snprintf(message,sizeof(message),"EXPR2_STREAM_PREINFERENCE_SMOKE_%s passed=%d failed=%d",failed?"FAIL":"PASS",passed,failed);
 return message;
}
#ifdef EXPR2_ANDROID_TEST_JNI
#include <jni.h>
extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_verifiedStreamStateSmoke(JNIEnv* env,jobject){
 const auto result=run_cases();return env->NewStringUTF(result.c_str());
}
#endif
#ifdef EXPR2_HOST_TEST_MAIN
int main(){const auto result=run_cases();std::puts(result.c_str());
 return result.find("SMOKE_PASS")!=std::string::npos?0:1;}
#endif
