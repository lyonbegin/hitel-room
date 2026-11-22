# Essence2 0.9.5 — Qualcomm Adreno OpenCL -54 upstream fixes
Date: 2026-11-22. Scope: external evidence and source review; no APK or production code changed in this research commit.

## Local evidence
Real device report from PCM16_NATIVE_BACKEND_BRANCH_TRACE_20261122 at 15:40 KST:
- director_ep=cpu (ORT CPU EP); nativeCreate requestedEP empty, LE_DIRECTOR_OPENCL unset.
- GPU compositor initialises on QUALCOMM Adreno, then [borrow-gpu] DEMOTED to the CPU compositor for the rest of this session: ndrange -> cl_error -54.
- Original fast conv1 test: requested WG 352 > kernel limit 256; legacy conv path selected.
- Original paste remains GPU. A2x block-320 emits 8 motion frames. SDK fallback and player stale frame rejection are distinct.
- Previous local ARM64 audit identifies ClPass::run1 (0x212d24), clEnqueueNDRangeKernel calls (0x212d94/0x212de4), convWith (around 0x215f88–0x2160a0), candidate legacy group 22*8*4=704. Actual failing kernel name and exact global/local tuple still require runtime observation. The 256 limit belongs to the tested fast kernel, not necessarily the legacy kernel.

## 1. clpeak: historical workaround, confirmed replacement (merged)
- Issue: https://github.com/krrishnarraj/clpeak/issues/183 (2026-07-01)
- Actual old code in Android AOSP mirror: https://android.googlesource.com/platform/external/clpeak/+/98f5b2645e18fc90ab9b79869c4abd0bfd125d83%5E1..98f5b2645e18fc90ab9b79869c4abd0bfd125d83/
- src/opencl/cl_common.cpp checks QUALCOMM/qualcomm vendor and caps device max WG to 128 because launches at 256 failed.
- Merged PR https://github.com/krrishnarraj/clpeak/pull/184 ; confirmed merge SHA 8863848584eaa16cbc9ab50548957ed3883a30ac
- https://github.com/krrishnarraj/clpeak/blob/8863848584eaa16cbc9ab50548957ed3883a30ac/src/opencl/cl_common.cpp
- https://github.com/krrishnarraj/clpeak/blob/8863848584eaa16cbc9ab50548957ed3883a30ac/src/opencl/cl_peak.cpp
- https://github.com/krrishnarraj/clpeak/blob/8863848584eaa16cbc9ab50548957ed3883a30ac/include/opencl/cl_peak.h
- Directly inspected clampToKernelWG: if local dimensions unspecified, leave to driver; query CL_KERNEL_WORK_GROUP_SIZE; if local[0] exceeds limit, use kernel limit, adjust global to a multiple. Called by run_kernel and direct kernel_latency dispatch.
- IMPORTANT: this helper is explicitly 1-D benchmark code; it can round global DOWN (discard work). Do NOT copy those semantics into avatar 3-D convolution; preserve all pixels/channels.

## 2. llama.cpp Adreno 830 exact -54 fix (open PR, not merged)
- https://github.com/ggml-org/llama.cpp/pull/31485 and https://github.com/ggml-org/llama.cpp/pull/31485/files
- Directly inspected PR metadata and changed code on 2026-11-22; state open, merged=false. Contributor reports physical-device verification, not independently reproduced by HITEL.
- ggml/src/ggml-opencl/ggml-opencl.cpp: actual enqueue failure logging gets CL_KERNEL_FUNCTION_NAME, global/local 3D tuples and error; load_cl_kernels builds NTILES=2 and NTILES=1 variants for Adreno A8X; chooses 128 or 64 work-items only after querying that variant's maximum.
- ggml/src/ggml-opencl/kernels/gemm_noshuffle_q6_k_f32_tiled.cl: NTILES made compile-time configurable via #ifndef NTILES. Host and kernel must agree. Also dynamic divisors for transpose grid and subgroup-valid fallback.
- Similarity: 256 launch fails for selected kernel, smaller compatible variant avoids error. Different kernel/model/GPU from Essence2; not proof same patch or a global cap works.

## 3. Production inference engines — multidimensional workgroup reference (source directly inspected)
### Alibaba MNN
- https://github.com/alibaba/MNN/blob/master/source/backend/opencl/core/runtime/OpenCLRuntime.cpp — lines 273,1066,1122–1129 at inspection: device max is separate; cache/query kernel max from CL_KERNEL_WORK_GROUP_SIZE.
- https://github.com/alibaba/MNN/blob/master/source/backend/opencl/core/OpenCLRunningUtils.cpp — localWS3DDefault (~106), localWS2DDefault (~425). Candidate checks per-axis limits and product of all local dimensions against kernel maximum; for its bounds-safe kernels it rounds global dimensions UP, measures valid candidate dispatches. Certain tuning branch uses cap 64 (not a universal Qualcomm cap). This is implementation reference, not a reported identical failure.
### Tencent TNN
- https://github.com/Tencent/TNN/blob/master/source/tnn/device/opencl/opencl_runtime.cc — GetMaxWorkGroupSize lines 252–257 queries the specific kernel.
- https://github.com/Tencent/TNN/blob/master/source/tnn/device/opencl/opencl_utils.cc — AdrenoLocalSize2D (~165), LocalWS3DDefault (~254), LocalWS2DDefault (~293); allocates 3-D shape from kernel maximum and subgroup size and rounds global up in enqueue helper (~92). Device-specific multidimensional tuning rather than blindly capping product.
### ARM Compute Library
- https://android.googlesource.com/platform/external/ComputeLibrary/+/c66f0e08b/src/core/CL/CLCompileContext.cpp — max_local_workgroup_size(kernel) queries device-specific kernel maximum; distinct from default_ndrange().
- MNN/TNN/ARM source is reference logic, not a ready-made bitHuman patch.

## 4. Other incident reports and compatibility evidence
- https://github.com/leela-zero/leela-zero/issues/1679 — Android convolution -54, developer suspects local (2,128,1); asks instrument exact enqueue. Proposed workaround did not resolve original report. Do not label fixed.
- https://github.com/opencv/opencv/issues/11797 — multiple kernels -54; suggested OPENCV_OPENCL_DEVICE_MAX_WORK_GROUP_SIZE override, no verified fix for reporter. Useful diagnostic pattern, not a setting in Essence2.
- https://github.com/ggml-org/llama.cpp/issues/25870 and merged https://github.com/ggml-org/llama.cpp/pull/25697 (c3d47e696b1187a27e896aa828d48ff9a33fc679) — Galaxy S23+ Adreno 740 compiler E031.41, subgroup compatibility and disabling unsupported flash-attention variants. Reporter confirmed PR fixes crash; a different failure from Essence2 -54.
- https://stackoverflow.com/questions/30166504/opencl-async-work-group-copy-and-maximum-work-group-size — Adreno 420: device advertises 1024, reporter saw -54 above 128, discussion attributes to registers/local memory. Anecdotal, no validated patch.
- https://registry.khronos.org/OpenCL/specs/unified/html/OpenCL_API.html — enqueue and kernel/device queries authoritative.

## 5. Application to Essence2: requirements before changing production binary
1. At real ClPass::run1 launch capture CL_KERNEL_FUNCTION_NAME, work_dim, all global/local/offset dimensions, kernel CL_KERNEL_WORK_GROUP_SIZE, CL_KERNEL_COMPILE_WORK_GROUP_SIZE, CL_KERNEL_PREFERRED_WORK_GROUP_SIZE_MULTIPLE, device CL_DEVICE_MAX_WORK_GROUP_SIZE / CL_DEVICE_MAX_WORK_ITEM_SIZES, local-memory use, return code; collect only failures/first launch per kernel and time summaries.
2. Recover exact failing kernel, required workgroup shape, local-ID indexing/barriers/local scratch aliasing. Do not assume fast conv1's limit applies to legacy conv1; do not blindly force all kernels to 128 or pass NULL.
3. First investigate safe variants for actual convolution shape with original output channels preserved: for candidate legacy {22,8,4}, y=2 gives 176 (requires kernel cap >=176), y=1 gives 88 (below historical 128 but still requires compatibility). Check workgroup dependence in OpenCL body; if local_y=8 is assumed, changing local geometry alone is invalid and needs matching kernel variant. Avoid truncating global work, validate divisibility or safe bounds padding.
4. Compare entire deterministic output buffers with original CPU reference; test edge pixels, batch values and all channels. Verify GPU init, first full convolution, 100+ frame continuous speech, no -54/demotion, compositor GPU and actual unique frames presented. Separate A2x/Director/thermal limit/player stale behavior.
5. Keep original vendor bytes as baseline and separately label any experimental kernel source or dispatch changes. No claims of resolved issue until real-device result.

Status: literature/source investigation and documentation only; no fabricated benchmark result.
