#!/usr/bin/env python3
"""Execute the actual GPU3 dispatch function against a deterministic fake OpenCL driver.

This tests the native route/control flow WITHOUT requiring a phone or claiming
that the original kernel produces mathematically correct pixels on Adreno.
The exact audit_enqueue and known_conv_kernel function bodies are extracted
from the production C++ file; they are not rewritten in the test.
"""
from pathlib import Path
import argparse
import subprocess
import tempfile

CPP = r"""
#include <atomic>
#include <cassert>
#include <cstddef>
#include <cstdint>
#include <ctime>
#include <iostream>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>
using Enqueue = int (*)(void*,void*,unsigned,const size_t*,const size_t*,
                       const size_t*,unsigned,const void* const*,void**);
Enqueue old_enqueue = nullptr;
std::mutex kernel_mutex;
struct KernelLog { std::string name; unsigned long long calls = 0; };
std::unordered_map<void*, KernelLog> kernel_names;
std::atomic<unsigned long long> original_gpu_ok{0}, compact_gpu_ok{0},
                                cpu_error_returned{0};
std::vector<std::string> stages;
struct Call {
  void* queue; void* kernel; unsigned dim; const size_t* offset;
  const size_t* global; size_t local[3]; unsigned num;
  const void* const* wait; void** event;
};
std::vector<Call> calls;
std::vector<int> responses;
size_t reply_index = 0;
long long clock_ns(clockid_t id) {
  timespec ts{};
  clock_gettime(id,&ts);
  return static_cast<long long>(ts.tv_sec)*1000000000+ts.tv_nsec;
}
void route_record(const char* stage, const std::string&,
                  unsigned long long, const size_t*, const size_t*,
                  const size_t*, unsigned, int, int, long long) {
  stages.emplace_back(stage);
}
int fake_enqueue(void* queue,void* kernel,unsigned dim,
                 const size_t* offset,const size_t* global,
                 const size_t* local,unsigned num,
                 const void* const* wait,void** event) {
  assert(reply_index < responses.size());
  Call c{queue,kernel,dim,offset,global,{0,0,0},num,wait,event};
  for(unsigned i=0;i<dim && i<3;i++)c.local[i]=local?local[i]:0;
  calls.push_back(c);
  return responses[reply_index++];
}
void reset(const std::string& kernel,int rc1,int rc2=99999) {
  kernel_names.clear(); kernel_names[reinterpret_cast<void*>(0x1234)]={kernel,0};
  calls.clear(); stages.clear(); responses={rc1};
  if(rc2!=99999) responses.push_back(rc2);
  reply_index=0;
  original_gpu_ok=0; compact_gpu_ok=0; cpu_error_returned=0;
}
"""
SUFFIX = r"""
int main() {
  old_enqueue=fake_enqueue;
  void* queue=reinterpret_cast<void*>(0x44);
  void* kernel=reinterpret_cast<void*>(0x1234);
  size_t offset[3]={0,0,0};
  size_t global[3]={16,352,1};
  size_t local[3]={16,8,1};
  const void* wait[1]={reinterpret_cast<void*>(0x1111)};
  void* event=nullptr;
  auto run=[&](unsigned dim=3)->int{
    return audit_enqueue(queue,kernel,dim,offset,global,local,1,wait,&event);
  };
  reset("k_convi8_7_16",0);
  assert(run()==0 && calls.size()==1 && original_gpu_ok==1 &&
         compact_gpu_ok==0 && stages==std::vector<std::string>{"ORIGINAL_GPU_OK"});
  reset("k_convi8_7_16",-54,0);
  assert(run()==0 && calls.size()==2 && compact_gpu_ok==1 &&
         cpu_error_returned==0 && stages.size()==2 &&
         stages[0]=="ORIGINAL_GPU_INVALID_WORK_GROUP_SIZE" &&
         stages[1]=="COMPAT_GPU_OK");
  assert(calls[0].local[0]==16 && calls[0].local[1]==8 &&
         calls[0].local[2]==1 && calls[1].local[0]==16 &&
         calls[1].local[1]==1 && calls[1].local[2]==1);
  for(const auto& c:calls)
    assert(c.queue==queue && c.kernel==kernel && c.dim==3 &&
           c.offset==offset && c.global==global && c.num==1 &&
           c.wait==wait && c.event==&event);
  reset("k_convi8_7_16",-54,-5);
  assert(run()==-54 && calls.size()==2 && cpu_error_returned==1 &&
         stages.back()=="COMPAT_GPU_FAILED_ORIGINAL_CPU_FALLBACK");
  reset("k_convi8_7_16",-5);
  assert(run()==-5 && calls.size()==1 && cpu_error_returned==1 &&
         stages.back()=="ORIGINAL_GPU_FAILED_ORIGINAL_CPU_FALLBACK");
  reset("unrecognized_kernel",-54);
  assert(run()==-54 && calls.size()==1 && cpu_error_returned==1);
  reset("k_convi8_7_16",-54);
  assert(run(2)==-54 && calls.size()==1);
  local[1]=4;
  reset("k_convi8_7_16",-54);
  assert(run()==-54 && calls.size()==1);
  local[1]=8;
  global[1]=351;
  reset("k_convi8_7_16",-54);
  assert(run()==-54 && calls.size()==1);
  global[1]=352;
  local[0]=256;
  reset("k_convi8_7_16",-54);
  assert(run()==-54 && calls.size()==1);
  std::cout<<"PASS_GPU3_NATIVE_REAL_FUNCTION_9_ROUTE_SCENARIOS\n";
  std::cout<<"PASS_STAGE1_ORIGINAL_SUCCESS_STAGE2_ONLY_MINUS54_AND_WHITELIST\n";
  std::cout<<"PASS_STAGE3_ORIGINAL_ERROR_AND_ARGUMENT_EVENT_PRESERVATION\n";
}
"""

def extracted(source: str, begin: str, end: str) -> str:
    start = source.find(begin)
    stop = source.find(end, start + len(begin))
    if start < 0 or stop < 0:
        raise AssertionError("Production GPU3 function boundary changed: " + begin)
    return source[start:stop]

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, default=Path(
        "tools/bithuman_deep/essence2_gpu3_original_first_native.cpp"))
    opts = p.parse_args()
    src = opts.source.read_text()
    kernel_check = extracted(src, "bool known_conv_kernel(", "\nvoid* audit_create(")
    dispatch = extracted(src, "int audit_enqueue(", "\nint audit_release(")
    with tempfile.TemporaryDirectory(prefix="essence2-gpu3-native-test-") as d:
        cpp = Path(d) / "gpu3_actual_dispatch_test.cpp"
        exe = Path(d) / "gpu3_actual_dispatch_test"
        cpp.write_text(CPP + kernel_check + "\n" + dispatch + SUFFIX)
        subprocess.run(["g++", "-std=c++17", "-O2", "-Wall", "-Wextra",
                        "-Werror", "-pthread", str(cpp), "-o", str(exe)],
                       check=True)
        subprocess.run([str(exe)], check=True)

if __name__ == "__main__":
    main()
