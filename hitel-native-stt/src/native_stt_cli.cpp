#include "hitel_native_stt.hpp"
#include "sherpa_backend.hpp"

#include <array>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "Usage: hitel-native-stt-cli ORIGINAL_IXIO_MODEL_DIRECTORY PCM16LE_16KHZ_FILE\n";
    return 2;
  }
  try {
    std::ifstream input(argv[2], std::ios::binary);
    if (!input) throw std::runtime_error("Cannot open supplied PCM file");
    hitel::NativeSttEngine engine(
        hitel::CreateSherpaBackend(argv[1]),
        [](const hitel::CaptionEvent &event) {
          std::cout << (event.is_final ? "FINAL" : "PARTIAL")
                    << " samples=" << event.audio_samples
                    << " decode=" << event.decoder_step
                    << " rev=" << event.revision
                    << " timestampNs=" << event.emit_ns
                    << " text=" << event.text << std::endl;
        },
        [](const hitel::TraceEvent &event) {
          if (std::string(event.phase) == "NATIVE_DECODE_DONE")
            std::cerr << "TRACE " << event.phase << " samples=" << event.samples
                      << " decode=" << event.decode_step
                      << " durationUs=" << event.elapsed_us
                      << " changed=" << event.text_changed << '\n';
        });
    std::array<std::uint8_t, 1024> buffer{};
    while (input) {
      input.read(reinterpret_cast<char *>(buffer.data()), buffer.size());
      const auto count = static_cast<std::size_t>(input.gcount());
      if (count) engine.AcceptPcm16Le(buffer.data(), count);
    }
    engine.Finish();
    std::cerr << "FINISHED acceptedSamples=" << engine.accepted_samples()
              << " decoderSteps=" << engine.decoded_steps()
              << " captionRevisions=" << engine.caption_revisions() << '\n';
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "STT ERROR: " << error.what() << '\n';
    return 1;
  }
}
