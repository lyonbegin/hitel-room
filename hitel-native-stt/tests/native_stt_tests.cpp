#include "hitel_native_stt.hpp"
#include <array>
#include <cmath>
#include <cstdint>
#include <deque>
#include <exception>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
struct Response { std::string text; bool endpoint = false; };
struct MockBackend final : hitel::StreamingBackend {
  explicit MockBackend(std::vector<Response> answers) : scripted(answers.begin(), answers.end()) {}
  std::deque<Response> scripted, ready;
  std::vector<float> received;
  bool endpoint = false, finished = false;
  int resets = 0;
  void Accept16k(const float *x, std::size_t n) override {
    received.insert(received.end(), x, x + n);
    if (!scripted.empty()) { ready.push_back(scripted.front()); scripted.pop_front(); }
  }
  bool IsReady() override { return !ready.empty(); }
  hitel::Hypothesis DecodeAndGetResult() override {
    if (ready.empty()) throw std::runtime_error("invalid decode");
    auto r = ready.front(); ready.pop_front(); endpoint = r.endpoint;
    return {r.text, {}};
  }
  bool IsEndpoint() override { return endpoint; }
  void Reset() override { ++resets; endpoint = false; }
  void InputFinished() override { finished = true; }
};
std::array<std::uint8_t, 1024> Audio() {
  std::array<std::uint8_t, 1024> b{};
  b[0] = 0; b[1] = 0x80; b[2] = 0xff; b[3] = 0x7f;
  return b;
}
void Require(bool ok, const char *why) { if (!ok) throw std::runtime_error(why); }
void TestImmediateUpdates() {
  auto backend = std::make_unique<MockBackend>(
      std::vector<Response>{{"한국"}, {"한국"}, {"한국 산업"}, {"한국 산업 서비스"}});
  auto *raw = backend.get();
  std::vector<hitel::CaptionEvent> out;
  std::vector<hitel::TraceEvent> traces;
  hitel::NativeSttEngine engine(std::move(backend),
      [&](const hitel::CaptionEvent &x){out.push_back(x);},
      [&](const hitel::TraceEvent &x){traces.push_back(x);});
  auto pcm = Audio();
  for (int i=0;i<4;++i) {
    engine.AcceptPcm16Le(pcm.data(), pcm.size());
    Require(out.size()==(i==0?1u:i==1?1u:i==2?2u:3u),
            "Changed caption must emit in the same AcceptPcm call");
  }
  Require(out[0].text=="한국" && out[1].text=="한국 산업" &&
          out[2].text=="한국 산업 서비스", "Partial captions were lost");
  Require(out[0].audio_samples==512 && out[1].audio_samples==1536 &&
          out[2].audio_samples==2048, "Wrong caption audio offsets");
  Require(raw->received.size()==2048 && engine.accepted_samples()==2048,
          "PCM frames lost/reordered");
  Require(std::abs(raw->received[0]+1.f)<1.e-7f, "PCM negative normalization");
  Require(std::abs(raw->received[1]-32767.f/32768.f)<1.e-7f,
          "PCM positive normalization");
  Require(engine.decoded_steps()==4 && engine.caption_revisions()==3,
          "Unexpected decode/revision gate");
  Require(traces.size()>=8, "Missing per-PCM/per-decode traces");
  engine.Finish();
  Require(raw->finished && out.size()==4 && out[3].is_final, "Missing EOF final");
  engine.Finish();
  Require(out.size()==4, "Duplicated final on repeated Finish");
}
void TestCorrectionAndEndpoint() {
  auto backend = std::make_unique<MockBackend>(
      std::vector<Response>{{"안녕하세요"}, {"안녕하"}, {"안녕하",true}, {"새 문장"}});
  auto *raw = backend.get();
  std::vector<hitel::CaptionEvent> out;
  hitel::NativeSttEngine engine(std::move(backend),
      [&](const hitel::CaptionEvent &x){out.push_back(x);});
  auto pcm=Audio();
  for(int i=0;i<4;++i) engine.AcceptPcm16Le(pcm.data(),pcm.size());
  Require(out.size()==4, "Unexpected number of endpoint events");
  Require(out[0].text=="안녕하세요"&&!out[0].is_final, "First partial");
  Require(out[1].text=="안녕하"&&!out[1].is_final, "Shorter correction ignored");
  Require(out[2].text=="안녕하"&&out[2].is_final, "Endpoint final missing");
  Require(out[3].text=="새 문장"&&!out[3].is_final, "Previous caption not cleared");
  Require(raw->resets==1, "Backend endpoint reset missing");
  engine.Finish();
  Require(out.size()==5 && out[4].text=="새 문장" && out[4].is_final,
          "EOF final missing after endpoint");
}
void TestInvalidPCM() {
  hitel::NativeSttEngine engine(std::make_unique<MockBackend>(std::vector<Response>{}),
                                [](const hitel::CaptionEvent &){});
  std::array<std::uint8_t,3> pcm{};
  bool rejected=false;
  try{engine.AcceptPcm16Le(pcm.data(),3);}catch(const std::invalid_argument&){rejected=true;}
  Require(rejected,"Odd PCM bytes accepted");
  rejected=false;
  try{engine.AcceptPcm16Le(nullptr,2);}catch(const std::invalid_argument&){rejected=true;}
  Require(rejected,"Null pointer accepted");
  engine.Finish();
  rejected=false;
  try{engine.AcceptPcm16Le(pcm.data(),2);}catch(const std::logic_error&){rejected=true;}
  Require(rejected,"Audio after EOF accepted");
}
}
int main(){
  try{
    TestImmediateUpdates(); TestCorrectionAndEndpoint(); TestInvalidPCM();
    std::cout<<"ALL native STT engine tests passed\n";return 0;
  }catch(const std::exception &e){
    std::cerr<<"TEST FAILED: "<<e.what()<<'\n';return 1;
  }
}
