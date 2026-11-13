#include "../include/expression2_native_frame_queue.h"
#include <cstring>
#include <deque>
#include <memory>
#include <mutex>
#include <new>
#include <utility>

struct NativePixels {
    uint64_t index=0;
    std::unique_ptr<int32_t[]> bytes;
    NativePixels(uint64_t id, std::unique_ptr<int32_t[]> src)
        : index(id), bytes(std::move(src)) {}
    NativePixels(NativePixels&&) noexcept = default;
    NativePixels& operator=(NativePixels&&) noexcept = default;
    NativePixels(const NativePixels&) = delete;
    NativePixels& operator=(const NativePixels&) = delete;
};
struct Expr2NativeFrameQueue {
    mutable std::mutex guard;
    std::deque<NativePixels> staged;
    std::deque<NativePixels> ready;
};
extern "C" Expr2NativeFrameQueue* expression2_frame_create() {
    return new (std::nothrow) Expr2NativeFrameQueue();
}
extern "C" int expression2_frame_stage(Expr2NativeFrameQueue* queue,
    uint64_t index,const int32_t* pixels,size_t count) {
    if (!queue || !pixels || count!=EXPR2_OUTPUT_FRAME_PIXELS) return -1;
    try {
        auto owned=std::make_unique<int32_t[]>(count);
        std::memcpy(owned.get(),pixels,count*sizeof(int32_t));
        std::lock_guard<std::mutex> lock(queue->guard);
        queue->staged.emplace_back(index,std::move(owned));
        return 0;
    } catch (...) {return -2;}
}
extern "C" int expression2_frame_pump(Expr2NativeFrameQueue* queue) {
    if(!queue)return -1;
    try {
        std::lock_guard<std::mutex> lock(queue->guard);
        while(!queue->staged.empty()){
            // std::unique_ptr move invalidates staging pointer ownership,
            // matching the verified original's handoff property.
            queue->ready.emplace_back(std::move(queue->staged.front()));
            queue->staged.pop_front();
        }
        return 0;
    } catch (...) {return -2;}
}
extern "C" int expression2_frame_pop(Expr2NativeFrameQueue* queue,
    int32_t* out,size_t count,uint64_t* out_index) {
    if(!queue || !out || !out_index || count!=EXPR2_OUTPUT_FRAME_PIXELS)return -1;
    std::unique_ptr<int32_t[]> owner;
    uint64_t frameIndex=0;
    {
        std::lock_guard<std::mutex> lock(queue->guard);
        if(queue->ready.empty())return 1;
        auto front=std::move(queue->ready.front());
        queue->ready.pop_front();
        frameIndex=front.index;
        owner=std::move(front.bytes);
    }
    // Native original frees after releasing the queue mutex. Do likewise.
    if(!owner)return -2;
    std::memcpy(out,owner.get(),count*sizeof(int32_t));
    *out_index=frameIndex;
    return 0;
    // owner releases frame here once, after copying to the consumer.
}
extern "C" size_t expression2_frame_available(
    const Expr2NativeFrameQueue* queue) {
    if(!queue)return 0;
    std::lock_guard<std::mutex> lock(queue->guard);
    return queue->ready.size();
}
extern "C" void expression2_frame_destroy(Expr2NativeFrameQueue* queue) {
    delete queue;
}
