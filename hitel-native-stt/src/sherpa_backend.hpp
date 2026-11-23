#pragma once
#include "hitel_native_stt.hpp"
#include <memory>
#include <string>

namespace hitel {
// Uses the ORIGINAL imported IXIO encoder.ort / decoder.ort / joiner.ort,
// tokens.txt and bpe.vocab. Never downloads or substitutes a model.
// This is a new PUBLIC sherpa-onnx C API adapter, NOT the original IXIO JNI.
// .ort compatibility is a runtime validation gate (not yet proven).
std::unique_ptr<StreamingBackend> CreateSherpaBackend(
    const std::string &original_ixio_model_directory);
} // namespace hitel
