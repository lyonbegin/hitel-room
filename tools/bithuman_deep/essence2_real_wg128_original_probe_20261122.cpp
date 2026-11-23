#include <android/log.h>
#include <dirent.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <jni.h>
#include <time.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <atomic>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <string_view>
#include <thread>
#include <vector>
#include <unordered_map>

namespace {
constexpr std::size_t kCapacity = 2048;
constexpr std::size_t kMessageSize = 640;
struct Event {
    long long time_ns;
    int tid;
    long long cpu_us;
    int turn;
    const char* transport;
    char message[kMessageSize];
};

std::array<Event, kCapacity> events{};
std::size_t first = 0;
std::size_t count = 0;
std::atomic<unsigned long long> dropped{0};
std::atomic<int> active_turn{0};
std::mutex event_mutex;
std::once_flag install_once;
int capture_flags = 0;
using Logger = void (*)(const __android_log_message*);
Logger logd = nullptr;

long long clock_ns(clockid_t id) {
    timespec ts{};
    if (clock_gettime(id, &ts) != 0) return 0;
    return static_cast<long long>(ts.tv_sec) * 1'000'000'000 + ts.tv_nsec;
}

bool sdk_message(std::string_view text) {
    constexpr std::string_view prefixes[]{
        "[hitel-cl]", "[le-pipe]", "[le-pipe-rep]", "[le-director-opencl]", "[le-place]", "[le-zc]", "[le-stepdown]",
        "[le_a2x]", "[le-skip]", "[borrow-gpu]", "[le-paste-opencl]", "[le-a2x]",
        "[le-otrace]", "[le-perf]", "[le_ort_profile]", "[le-cl]", "[le-adpf]", "[le-output]",
        "[le-driver]", "[le-open]", "[borrow-gpu-split]", "[borrow]", "[le]",
        "PROD where=", "stopped on an exception:",
    };
    for (const auto prefix : prefixes) {
        if (text.find(prefix) != std::string_view::npos) return true;
    }
    if (text.find("ExecutionProvider") != std::string_view::npos ||
        text.find("OpenCL device") != std::string_view::npos ||
        text.find("OpenCL platform") != std::string_view::npos) return true;
    return false;
}

void capture(std::string_view text, const char* transport, bool on_sdk_thread) {
    if (!sdk_message(text)) return;
    std::unique_lock<std::mutex> lock(event_mutex, std::try_to_lock);
    if (!lock) {
        dropped++;
        return;
    }
    if (count == kCapacity) {
        first = (first + 1) % kCapacity;
        count--;
        dropped++;
    }
    auto& event = events[(first + count++) % kCapacity];
    event = {clock_ns(CLOCK_BOOTTIME), on_sdk_thread ? gettid() : 0,
             on_sdk_thread ? clock_ns(CLOCK_THREAD_CPUTIME_ID) / 1000 : 0, active_turn.load(), transport, {}};
    const auto size = std::min(text.size(), kMessageSize - 1);
    for (std::size_t i = 0; i < size; i++) {
        unsigned char c = text[i];
        event.message[i] = c >= 32 && c < 127 ? static_cast<char>(c) : ' ';
    }
}


// SDK 0.9.5 verified table at ELF VA 0x3cb7e8. API signatures are OpenCL 1.2.
// Do not change driver arguments, return codes, event ownership or queue synchronization.
using CreateKernel = void* (*)(void*, const char*, int*);
using GetWG = int (*)(void*, void*, unsigned, size_t, void*, size_t*);
using Enqueue = int (*)(void*, void*, unsigned, const size_t*, const size_t*, const size_t*, unsigned, const void* const*, void**);
using ReleaseKernel = int (*)(void*);
CreateKernel old_create = nullptr;
GetWG old_wg = nullptr;
Enqueue old_enqueue = nullptr;
ReleaseKernel old_release = nullptr;
std::mutex kernel_mutex;
struct KernelLog { std::string name; unsigned long long calls = 0; };
std::unordered_map<void*, KernelLog> kernel_names;
std::once_flag gpu_once;
int gpu_flags = 0;
void* audit_create(void* program, const char* name, int* err) {
    void* result = old_create(program, name, err);
    try {
        if (result) {
            std::lock_guard<std::mutex> lock(kernel_mutex);
            kernel_names[result] = KernelLog{name ? name : "(null)", 0};
        }
        char line[512];
        std::snprintf(line, sizeof(line), "[hitel-cl] create kernel=%s success=%d rc=%d",
                      name ? name : "(null)", result != nullptr, err ? *err : (result ? 0 : -99999));
        capture(line, "cl-api", true);
    } catch (...) {}
    return result;
}
int audit_wg(void* kernel, void* device, unsigned param, size_t bytes, void* value, size_t* written) {
    int rc = old_wg(kernel, device, param, bytes, value, written);
    try {
        if (param == 0x11b0) {
            std::string name = "(unknown)";
            { std::lock_guard<std::mutex> lock(kernel_mutex);
              auto it = kernel_names.find(kernel); if (it != kernel_names.end()) name = it->second.name; }
            size_t limit = 0;
            if (rc == 0 && value && bytes >= sizeof(limit)) std::memcpy(&limit, value, sizeof(limit));
            char line[512];
            std::snprintf(line, sizeof(line), "[hitel-cl] wg_limit kernel=%s max=%zu rc=%d", name.c_str(), limit, rc);
            capture(line, "cl-api", true);
        }
    } catch (...) {}
    return rc;
}
int audit_enqueue(void* queue, void* kernel, unsigned dim, const size_t* offset,
                  const size_t* global, const size_t* local, unsigned num,
                  const void* const* wait, void** event) {
    const auto start = clock_ns(CLOCK_BOOTTIME);
    int rc = old_enqueue(queue, kernel, dim, offset, global, local, num, wait, event);
    const auto us = (clock_ns(CLOCK_BOOTTIME) - start) / 1000;
    try {
        std::string name = "(unknown)";
        unsigned long long n = 0;
        { std::lock_guard<std::mutex> lock(kernel_mutex);
          auto it = kernel_names.find(kernel);
          if (it != kernel_names.end()) { n=++it->second.calls; if (rc != 0 || n <= 2 || n % 100 == 0) name=it->second.name; }
        }
        if (rc != 0 || (n != 0 && (n <= 2 || n % 100 == 0))) {
            size_t g[3]{}, l[3]{};
            for (unsigned i=0; i<dim && i<3; ++i) { if(global) g[i]=global[i]; if(local) l[i]=local[i]; }
            char line[640];
            std::snprintf(line, sizeof(line),
                "[hitel-cl] enqueue kernel=%s n=%llu dim=%u global=%zux%zux%zu local=%zux%zux%zu rc=%d host_enqueue_us=%lld",
                name.c_str(), n, dim, g[0],g[1],g[2],l[0],l[1],l[2],rc,us);
            capture(line, "cl-api", true);
        }
    } catch (...) {}
    return rc;
}
int audit_release(void* kernel) {
    int rc = old_release(kernel);
    try { if (rc == 0) { std::lock_guard<std::mutex> lock(kernel_mutex); kernel_names.erase(kernel); } } catch (...) {}
    return rc;
}
int install_gpu_audit() {
#if defined(__aarch64__)
    std::call_once(gpu_once, [] {
        void* lib = dlopen("lible_jni.so", RTLD_NOW | RTLD_NOLOAD);
        if (!lib) { capture("[hitel-cl] hook unavailable: SDK not loaded", "cl-api", true); return; }
        using OpenApi = void** (*)(const char**);
        auto open = reinterpret_cast<OpenApi>(dlsym(lib, "_ZN2le2cl4openEPPKc"));
        Dl_info info{};
        if (!open || !dladdr(reinterpret_cast<void*>(open), &info) || !info.dli_fbase) {
            capture("[hitel-cl] hook unavailable: SDK symbol not found", "cl-api", true); return;
        }
        const auto base = reinterpret_cast<std::uintptr_t>(info.dli_fbase);
        if (reinterpret_cast<std::uintptr_t>(open) != base + 0x216798 ||
            *reinterpret_cast<const unsigned*>(base + 0x20906c) != 0x93407d16 ||
            *reinterpret_cast<const unsigned*>(base + 0x20b5f0) != 0x937f7d08 ||
            *reinterpret_cast<const unsigned*>(base + 0x215f44) != 0x5280002b ||
            *reinterpret_cast<const unsigned*>(base + 0x215f88) != 0x52800037) {
            capture("[hitel-cl] hook unavailable: exact patched SDK identity mismatch", "cl-api", true); return;
        }
        const char* reason = nullptr;
        void** api = open(&reason);
        if (!api || reinterpret_cast<std::uintptr_t>(api) != base + 0x3cb7e8 ||
            !api[10] || !api[11] || !api[13] || !api[22]) {
            capture("[hitel-cl] hook unavailable: OpenCL API table mismatch or unavailable", "cl-api", true); return;
        }
        old_create = reinterpret_cast<CreateKernel>(api[10]);
        old_wg = reinterpret_cast<GetWG>(api[11]);
        old_enqueue = reinterpret_cast<Enqueue>(api[13]);
        old_release = reinterpret_cast<ReleaseKernel>(api[22]);
        // This is the SDK's writable .bss table, populated by open() via dlsym.
        api[10] = reinterpret_cast<void*>(audit_create);
        api[11] = reinterpret_cast<void*>(audit_wg);
        api[13] = reinterpret_cast<void*>(audit_enqueue);
        api[22] = reinterpret_cast<void*>(audit_release);
        gpu_flags=1;
        capture("[hitel-cl] hook installed: real create/wg_limit/enqueue/release; no driver return changes", "cl-api", true);
    });
#endif
    return gpu_flags;
}

void capture_logd(const __android_log_message* message) {
    // Never read back our own encoded native messages.
    if (message && message->message &&
        (!message->tag || std::strcmp(message->tag, "HITEL_E2TRACE") != 0))
        capture(message->message, "logd", true);
    if (message) logd(message);
}

void read_stderr(int read_fd) {
    char buffer[1024];
    std::string line;
    while (true) {
        const ssize_t bytes = read(read_fd, buffer, sizeof(buffer));
        if (bytes < 0 && errno == EINTR) continue;
        if (bytes <= 0) break;
        for (ssize_t i = 0; i < bytes; i++) {
            if (buffer[i] == '\n') {
                capture(line, "stderr", false);
                line.clear();
            } else if (line.size() < kMessageSize - 1) {
                line.push_back(buffer[i]);
            }
        }
    }
    if (!line.empty()) capture(line, "stderr", false);
    close(read_fd);
}

bool capture_stderr() {
    int fds[2];
    if (pipe2(fds, O_CLOEXEC) != 0) return false;
    const int flags = fcntl(fds[1], F_GETFL);
    const bool attached = flags >= 0 && fcntl(fds[1], F_SETFL, flags | O_NONBLOCK) == 0 &&
                          dup2(fds[1], STDERR_FILENO) >= 0;
    close(fds[1]);
    if (attached) std::thread(read_stderr, fds[0]).detach();
    else close(fds[0]);
    return attached;
}

jobjectArray strings(JNIEnv* env, const std::vector<std::string>& lines) {
    const jclass string_class = env->FindClass("java/lang/String");
    const auto result = env->NewObjectArray(static_cast<jsize>(lines.size()), string_class, nullptr);
    if (!result) return nullptr;
    for (std::size_t i = 0; i < lines.size(); i++) {
        const jstring line = env->NewStringUTF(lines[i].c_str());
        if (!line) return nullptr;
        env->SetObjectArrayElement(result, static_cast<jsize>(i), line);
        env->DeleteLocalRef(line);
    }
    return result;
}

bool sdk_worker(std::string_view name) {
    return name.substr(0, 3) == "e2-" || name.substr(0, 3) == "ORT" ||
           name.substr(0, 3) == "ort" || name.substr(0, 6) == "onnxru";
}
}  // namespace

extern "C" JNIEXPORT jint JNICALL
Java_ai_bithuman_flutter_HitelSdkProbe_nativeInstall(JNIEnv* env, jobject, jstring prefix) {
    const char* chars = env->GetStringUTFChars(prefix, nullptr);
    if (!chars) return 0;
    const std::string profile(chars);
    env->ReleaseStringUTFChars(prefix, chars);
    std::call_once(install_once, [&profile] {
        using SetLogger = void (*)(Logger);
        void* liblog = dlopen("liblog.so", RTLD_NOW | RTLD_LOCAL);
        const auto set_logger = reinterpret_cast<SetLogger>(
            liblog ? dlsym(liblog, "__android_log_set_logger") : nullptr);
        logd = reinterpret_cast<Logger>(liblog ? dlsym(liblog, "__android_log_logd_logger") : nullptr);
        if (set_logger && logd) {
            set_logger(capture_logd);
            capture_flags |= 1;
        }
        if (capture_stderr()) {
            capture_flags |= 2;
            setvbuf(stderr, nullptr, _IONBF, 0);
        }
        // le::diag_stream() at 0x17400c sends diagnostics to /dev/null
        // when BITHUMAN_ENGINE_QUIET=1 unless BITHUMAN_DEBUG=1.
        // Experimental original OpenCL Director; preserve SDK first-frame grade and demotion.
        if (setenv("LE_DIRECTOR_OPENCL", "1", 1) == 0) capture_flags |= 32;
        if (setenv("BITHUMAN_DEBUG", "1", 1) == 0) capture_flags |= 16;
        const int report = setenv("LE_PIPE_REPORT_S", "1", 1);
        const int tessera = setenv("LE_TESS_TIMING", "1", 1);
        const int compose = setenv("LE_ZC_TIMING", "1", 1);
        const int paste = setenv("LE_PASTE_OPENCL_TIMING", "1", 1);
        if (report == 0 && tessera == 0 && compose == 0 && paste == 0) capture_flags |= 4;
        if (!profile.empty() && setenv("LE_ORT_PROFILE", profile.c_str(), 1) == 0) capture_flags |= 8;
    });
    return capture_flags;
}

extern "C" JNIEXPORT jint JNICALL
Java_ai_bithuman_flutter_HitelSdkProbe_nativePrepareGpuAudit(JNIEnv*, jobject) {
    return install_gpu_audit();
}

extern "C" JNIEXPORT jobjectArray JNICALL
Java_ai_bithuman_flutter_HitelSdkProbe_nativeDrain(JNIEnv* env, jobject) {
    std::vector<Event> pending;
    pending.reserve(kCapacity);
    {
        std::lock_guard<std::mutex> lock(event_mutex);
        while (count != 0) {
            pending.push_back(events[first]);
            first = (first + 1) % kCapacity;
            count--;
        }
    }
    std::vector<std::string> lines;
    for (const auto& event : pending) {
        lines.push_back(std::to_string(event.time_ns) + '\t' + std::to_string(event.tid) + '\t' +
                        std::to_string(event.cpu_us) + '\t' + event.transport + '\t' + event.message + '\t' +
                        std::to_string(event.turn));
    }
    const auto lost = dropped.exchange(0);
    if (lost > 0) {
        lines.push_back(std::to_string(clock_ns(CLOCK_BOOTTIME)) + "\t0\t0\tprobe\tdropped=" +
                        std::to_string(lost) + '\t' + std::to_string(active_turn.load()));
    }
    return strings(env, lines);
}

extern "C" JNIEXPORT void JNICALL
Java_ai_bithuman_flutter_HitelSdkProbe_nativeSetTurn(JNIEnv*, jobject, jint turn) {
    active_turn.store(turn);
}

extern "C" JNIEXPORT jobjectArray JNICALL
Java_ai_bithuman_flutter_HitelSdkProbe_nativeThreads(JNIEnv* env, jobject) {
    std::vector<std::string> rows;
    DIR* tasks = opendir("/proc/self/task");
    if (!tasks) return strings(env, rows);
    const long ticks_per_second = sysconf(_SC_CLK_TCK);
    while (const auto* entry = readdir(tasks)) {
        if (entry->d_name[0] < '0' || entry->d_name[0] > '9') continue;
        const std::string tid = entry->d_name;
        std::ifstream stat("/proc/self/task/" + tid + "/stat");
        std::string raw;
        if (!std::getline(stat, raw)) continue;
        const auto begin = raw.find('(');
        const auto end = raw.rfind(") ");
        if (begin == std::string::npos || end == std::string::npos || end <= begin) continue;
        const auto name = raw.substr(begin + 1, end - begin - 1);
        if (!sdk_worker(name)) continue;
        std::istringstream fields(raw.substr(end + 2));
        char state = '?';
        std::string ignored;
        unsigned long long user = 0, kernel = 0;
        fields >> state;
        for (int i = 0; i < 10; i++) fields >> ignored;
        if (!(fields >> user >> kernel)) continue;
        rows.push_back(tid + '\t' + name + '\t' + state + '\t' + std::to_string(user + kernel) +
                       '\t' + std::to_string(ticks_per_second));
    }
    closedir(tasks);
    return strings(env, rows);
}
