> **2026-11-13 수정:** 아래의 425,324바이트 수치는 '실제 함수가 누락되었다'는 뜻이 아니라, JNI 직접 호출 그래프에서 찾은 1,035개 함수만 사용했을 때의 범위입니다. 이후 원본 ELF의 .eh_frame_hdr 2,629개 주소 색인과 .eh_frame FDE 범위를 기준으로 재분해한 결과 실행 영역 689,056바이트 중 681,396바이트(98.89%)를 확인했고, 일반 .text의 미분류 영역은 **316바이트**입니다. 나머지 7,344바이트는 .plt 링크 스텁 영역입니다. 최신 원본 재검증: [Actions #43428318447](https://github.com/lyonbegin/hitel-room/actions/runs/43428318447). [수정된 보고서](expression2_function_index_fde_reassembly_corrected_20261113.md). 아래는 **이전 방식의 한계를 보여주는 비교 기준**으로만 보존합니다.

---

# Expression 2 original ELF split/recompose/difference verification — 2026-11-13

Original AAR SHA256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584
Original ARM64 ELF SHA256: ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c

Verified full CI run: https://github.com/lyonbegin/hitel-room/actions/runs/43424730088
Verification artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43424730088/artifacts/14035343187

Source: tools/bithuman_deep/expression2_elf_reassemble_diff.py
Workflow: .github/workflows/expression2-elf-reassembly-diff.yml

## Experiment A: exact ELF file-layout split and recomposition

Separated the original shared object into 32 disjoint pieces covering the ELF header,
program headers, section payloads, section headers, and all remaining padding.
Emitted each piece to an independent file and reconstructed in reverse iteration
order using file offsets and verified content hashes.

- Original size: 1,188,304 bytes
- Reconstructed size: 1,188,304 bytes
- Original-versus-reconstructed differing bytes: **0**
- Original-versus-reconstructed SHA-256: **IDENTICAL**
- The rebuilt container contains the same original code. This is a file-layout
  roundtrip proof, NOT an independent-source recompilation or independent SDK.

## Experiment B: verified 1,035 original machine-code functions plus ELF non-code

Verified every instruction against its original shared-object bytes, correcting
the Ghidra image-base offset by 0x100000 using the real Native_feed dynamic symbol.

| Field | Verified result |
|---|---:|
| Functions in Ghidra JNI call-graph inventory | 1,035 |
| Listed ARM64 instructions | 65,933 |
| Original machine code bytes matching exactly | 263,732 |
| Total executable ELF-section bytes | 689,056 |
| Executable bytes NOT owned by identified functions | **425,324** |
| Fraction of executable code covered by those functions | **38.27%** |
| Byte differences if unidentified executable bytes are blanked | **374,878** |
| Incorrect function instructions | 0 |
| Overlaps or unmapped original instructions | 0 |

Executable-section gaps:
- .text: 681,444 bytes total; 260,736 identified; **420,708 unidentified**.
- .plt: 7,344 bytes total; 2,880 identified; **4,464 unidentified**.
- __lcxx_override: 268 bytes total; 116 identified; **152 unidentified**.

The 425,324-byte unidentified span is NOT necessarily 425,324 bytes of missing
functions: it may include unvisited code, indirect-only calls, compiler-generated
stubs, and padding. The missing-byte metric and the actual differing-byte metric
differ because blanked bytes may coincidentally equal zero original bytes.

This partial rebuild is a difference diagnostic and is NOT an executable SO.

## Cross-component relationships remaining

- Static direct call graph edges: 2,495.
- ELF relocation records: 3,787.
- Imported symbols: 172.
- Original executable code depends on PC-relative address instructions, read-only
  constants, writable state, dynamic library loading, GOT/PLT, exception unwind
  metadata, and downloaded IMX model members.
- A flat list of function bodies cannot represent those relationships.

## Next reconstruction target

1. Account for 420,708 bytes of the original .text section not covered by the
   existing JNI-origin function inventory, distinguishing indirect entry points
   and compiler/linker code.
2. Account for 4,616 bytes in .plt and __lcxx_override.
3. Map original function-to-constant/data references and relocations, then group
   related code and data by runtime initialization and ownership.
4. Build and test the independently authored native processing modules against
   original input/output traces, without confusing file-layout identity with
   functional equivalence.

**Result: complete original ELF repacking is bit-exact; a new independently
linked Expression 2 SDK is not established.**
