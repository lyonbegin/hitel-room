# Essence2 spoken test fixture

`essence2-spoken-24k.pcm` is the exact offline eSpeak-generated English voice already embedded in the installation candidate. PCM16 little endian, mono, 24 kHz, 14.437 seconds. SHA-256: `8ec78692993f61012a2ee1ba630be9378852aa4865cca13dc2643ca9916e2098`.

The build copies this immutable fixture instead of installing voice-generation packages. `../generate_essence2_real_voice_fixture.sh` records how it was generated. This is a fixed local test response, not an AI service or microphone test.
