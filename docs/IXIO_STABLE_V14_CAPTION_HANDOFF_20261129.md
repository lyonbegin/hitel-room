# IXIO stable + V14 live caption handoff (2026-11-29)

Base aebde2ef893e220ae66562453b4d6850b091ce86; selective donor eb5ad966559bd57b94fc6cfe8753da9dca03c75a. Do not alter stt/main or Gallery branches.

Preserve original MediaCodec/AAC, M4A selection, PCM queue readiness gate, original speechSDK, virtual call harness and model import. Port V14 current utterance state, changed partial callback, endpoint clearing (including empty endpoint), final cumulative diagnostic snapshot, new-session UI reset and broadcast sequence/timing. No FAAD2 replacement. Existing MainActivity accepts empty strings; SpeakerEngine forwards callbacks unchanged.

CI: .github/workflows/ixio-stable-v14-caption-merge-20261129.yml runs JVM caption and existing regression checks plus Android build/virtual call; original model is private, so full Android speech inference still requires device model import. Do not claim successful build or inference before logs.
