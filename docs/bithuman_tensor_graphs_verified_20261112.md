# Verified tensor graph inventory: bitHuman Expression 2 and Essence 2

Date: 2026-11-12 UTC
Official public showcase models, no API credentials.
GitHub Actions successful run: https://github.com/lyonbegin/hitel-room/actions/runs/43226883541
Graph metadata artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43226883541/artifacts/13948242946

## Confirmed

Real model members were independently extracted from the public IMX v2 containers using tools/bithuman_deep/imx_v2.py. Open model parsers (tflite 2.18.0, ONNX 1.23.0) successfully parsed **all five** target graphs: one TFLite file with five subgraphs, and four ONNX files. No neural model executed, no account credentials or authorization changes were used. Graph metadata and tensor shapes only are in the artifact; no model weights or vendor binaries are committed.

## Expression 2: combined_litert.tflite (158,524,428 bytes)

The actual TFLite file has FIVE named subgraphs. The source is the expression2 public wise-pup IMX.

| Subgraph | Operators | Tensor count | Input(s) | Output(s) |
|---|---:|---:|---|---|
| enc | 349 | 491 | enc_args_0 [1, 35200] | enc_output_0_output [1, 55, 12, 768] |
| tok14 | 68 | 107 | tok14_args_0 [1, 55, 12, 768] | tok14_output_0_output [1, 14, 16, 384] |
| step | 467 | 601 | step_args_0 [1, 16, 16, 90, 52]; step_args_1 [1, 16, 384] | step_output_0_output [1, 16, 90, 52] |
| dec16 | 41 | 101 | dec16_args_0 [16, 36, 90, 52] | dec16_output_0_output [16, 3, 720, 416] |
| dec8 | 41 | 101 | dec8_args_0 [8, 36, 90, 52] | dec8_output_0_output [8, 3, 720, 416] |

All reported tensors above have dtype code 0 in TFLite (FLOAT32). The tensor shapes are directly read from the graph schema, not guessed.

Potential data flow follows compatible tensor names and shapes from enc to tok14, and from latent step to dec16/dec8. However the complete scheduling, preprocessing, state control and audio/video synchronization must still be determined from SDK JNI code; do not assume the subgraphs can be executed consecutively without glue logic.

## Essence 2: ONNX files in Sofia Ramirez public IMX

### a2x_enc_stream.onnx (20,755,566 bytes)

- 1,077 graph nodes
- Inputs: feat [1,s0,12,768], pos_window [1,s0,256], attn [1,1,s0,s0]
- Output: getitem_51 [1,s0,256]
- Most common operations include Constant, Reshape, Concat, Transpose, Gemm, Add, LayerNormalization, MatMul.
- The graph includes aten_getitem operators. Presence of such nodes does NOT guarantee stock ONNX Runtime can execute without operator support.

### a2x_dec.onnx (2,473,874 bytes)

- 14 graph nodes, including GRU and Gemm
- Inputs: ctx_t [1,256], prev [1,63], h [1,1,256]
- Outputs: m [1,63], h_out [1,1,256]
- Dimensions imply a recurrent decoder producing a 63-element output vector and refreshed hidden state; the exact semantic mapping requires the model wrapper.

### model_b1_fp32.onnx (25,111,425 bytes)

- 461 graph nodes
- Inputs: pooled64 [1,64,32,32], P_rgb [1,3,512,512], kp_driving [1,21,3], kp_source [1,21,3]
- Output: rgb with dynamic dimensions
- Operator set includes Conv, GridSample, Resize, Gemm, Softmax and tensor transformations.

### model_b24_fp32.onnx (25,111,611 bytes)

- 461 graph nodes
- Same signature but batch dimension 24: pooled64 [24,64,32,32], P_rgb [24,3,512,512], kp_driving [24,21,3], kp_source [24,21,3].
- Output rgb with dynamic dimensions.

## Engineering implications

Expression 2 is a self-contained LiteRT model with distinct encoder, audio-token, latent-step, and two decoder-batch graphs. Its on-device SDK includes libexpr2jni.so and libLiteRt.so. 

Essence 2 is split into audio-to-expression and pose/appearance rendering models; its Android SDK includes libe2u_jni.so, lible_jni.so, and libonnxruntime.so. The public avatar also includes a driving-clip representation and target-frame data.

This model-layer decomposition materially narrows the scope of an independent implementation: a non-vendor local runtime would need a compatible audio frontend and scheduler, a model interpretation backend, identity data loading, motion/pose mapping, frame synthesis and synchronization. None of that is established merely by successful graph parsing.

## Reproduction

- Container parser: tools/bithuman_deep/imx_v2.py
- Graph inspector: tools/bithuman_deep/inspect_graphs.py
- Workflow: .github/workflows/bithuman-model-graph-audit.yml
- Evidence: GitHub Actions run 43226883541, artifact 13948242946.
- The source data are the public Wise Pup and Sofia Ramirez model downloads.
- The run is successful, but **no face frames, live lip sync or Android inference were produced**.

## Next technical test

1. Validate graph interpreter instantiation (not just schema read), using a public .tflite under Android NativeBridge or a CPU-only local runner.
2. Capture execution order and tensor preparation from the vendor JNI/API interface.
3. Test a known reference audio chunk with identity data and verify output dimensions.
4. Only after a frame can be generated, measure audio latency, frame timing, CPU/NPU route and memory.
