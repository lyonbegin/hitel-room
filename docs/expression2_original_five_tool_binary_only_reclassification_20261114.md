# Expression 2 official SDK 0.6.2 — original machine-code five-tool analysis

**Scope:** Unmodified published Android ARM64 ELF, jni/arm64-v8a/libexpr2jni.so. We did not rewrite any vendor function in Kotlin/C++, patch the original, or bypass authentication. No machine-code/IMX content is included in this document.

## Exact evidence

- AAR SHA256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584
- SO SHA256: ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c
- Verified Ghidra full P-code run: https://github.com/lyonbegin/hitel-room/actions/runs/43518753947
- Four original-machine-code tools actually executed: https://github.com/lyonbegin/hitel-room/actions/runs/43526767999
- Five-tool CI with Dyninst source build: https://github.com/lyonbegin/hitel-room/actions/runs/43527214914

## Independent tool results

| Tool | Executed analysis functions | Results |
|---|---|---|
| Ghidra 12.2 | Raw ARM64 P-code memory load/store, direct/indirect calls, noncode refs, all FDEs | 2,629/2,629 FDE ranges; 39,397 LOAD, 25,488 STORE; 10,865 CALL, 1,304 CALLIND |
| Capstone 5.0.6 | Entire FDE machine instruction decode, registers, memory operands, branch groups and direct call edges | 170,349 instructions, 681,396 bytes, zero undecoded FDE bytes, 51,639 memory operands |
| LIEF | ELF sections, segments, symbols, imports, dependencies, dynamic and PLT/GOT relocations | 9 segments; 3,787 relocation records; 2,194 dynamic symbols |
| DDisasm + GTIRB | Code/data block classification, inferred CFG edge types, symbols and auxiliary data | 45,023 code blocks; 5,583 data blocks; 78,375 CFG edges; 22,207 symbols |
| Dyninst ParseAPI | Independent ELF function/block/call flow analysis | Pending verified output at document creation; upstream source compilation required (no Ubuntu Noble dev package) |

**Per-function cross-check**: all 2,629 original ELF FDE entry addresses exactly matched DDisasm CodeBlock starts. Capstone vs Ghidra direct and indirect call counts matched for all 2,629. Instruction count matched for 2,628/2,629; ELF 0x112308 has 135 Capstone vs 134 Ghidra decoded instructions, 4-byte difference. This discrepancy must be investigated.

The Ghidra address image base is +0x100000 relative to original ELF virtual addresses. Ghidra 0x001A7FBC = ELF 0x000A7FBC.

## Actual DDisasm code coverage by ELF section

| Section | Original size | Classified code bytes | Unclassified |
|---|---:|---:|---:|
| .text | 681,444 | 681,428 | 16 |
| .plt | 7,344 | 7,332 | 12 |
| __lcxx_override | 268 | 268 | 0 |

Unclassified .text intervals: [0x113104,0x113110) (12 bytes) and [0x11313C,0x113140) (4 bytes). Unclassified .plt: [0x1172D4,0x1172E0) (12 bytes). These must not be assumed to be padding or real code before examination.

DDisasm CFG edges: 34,026 Fallthrough, 26,209 Branch, 12,169 Call, 5,971 Return. Counts represent inferred CFG edges and do not equal distinct instruction counts.

## ELF relocations and their memory destinations (LIEF)

| AArch64 relocation type | Records |
|---|---:|
| ABS64 | 1,774 |
| RELATIVE | 1,396 |
| JUMP_SLOT | 457 |
| GLOB_DAT | 160 |
| TOTAL | 3,787 |

Relocation sites: .data.rel.ro has 1,771 ABS64 plus 1,349 RELATIVE; .got.plt has 457 JUMP_SLOT; .got has 160 GLOB_DAT. The rest occur in .data/.init_array/.fini_array.

Of the 1,396 RELATIVE addend destinations: .text 1,002; .data.rel.ro 192; .rodata 167; .bss 34; unmapped 1.

Needed shared libraries: libLiteRt.so, libandroid.so, liblog.so, libjnigraphics.so, libm.so, libdl.so, libc.so.

Previous 3,170 relocation records were a filtered subset of the original ELF, and are not directly the same measurement as all 3,787 LIEF relocations.

## 15 central original functions — independently confirmed code block entrypoints

These addresses are ELF virtual addresses and not Ghidra image-base-adjusted addresses.

| Original function role (research interpretation) | ELF entry | Capstone instructions | Ghidra LOAD | Ghidra STORE | Direct calls |
|---|---|---:|---:|---:|---:|
| JNI feed entry | 0x724D8 | 375 | 124 | 44 | 33 |
| PCM native append | 0xA7FBC | 72 | 23 | 19 | 6 |
| PCM vector allocation | 0xACF1C | 153 | 18 | 21 | 10 |
| Segment reset | 0xA77C0 | 145 | 35 | 30 | 11 |
| Canon/history | 0xA7DB0 | 131 | 20 | 20 | 16 |
| Scheduler | 0xA80DC | 85 | 24 | 10 | 3 |
| Source audio window | 0xA8500 | 1189 | 244 | 279 | 65 |
| Audio preprocess | 0xA9794 | 502 | 62 | 37 | 25 |
| Tail/end | 0xA8230 | 48 | 8 | 8 | 2 |
| Async pump | 0xA8404 | 50 | 9 | 6 | 3 |
| Pull-wait pump | 0xAA594 | 58 | 18 | 5 | 5 |
| Frame staging | 0xA7A04 | 190 | 48 | 42 | 13 |
| Frame queue dequeue | 0xAA40C | 98 | 29 | 22 | 8 |
| Output queue count | 0xA84CC | 13 | 5 | 4 | 2 |
| JNI pull | 0x72E7C | 389 | 123 | 51 | 25 |

Function labels are analyst assignments based on earlier binary audits, not original vendor C++ source names.

## Gaps before claiming complete decomposition/reassembly

1. Complete Dyninst source-build CFG execution and reconcile each newly inferred function/block edge against FDE and GTIRB.
2. Investigate one Ghidra 4-byte undecoded location within ELF function 0x112308.
3. Restore every unresolved indirect branch/vtable/relocation target and cross-thread memory ownership; P-code operations alone do not establish runtime aliasing.
4. Perform independent component-only ELF reassembly from archived source bytes/relocation information without initializing output from a copy of the original complete binary.
5. Extend native analysis to JNI/JVM class interfaces and IMX model input-output graph for overall SDK behavior verification.

**Verdict:** four tools have completed actual source-binary analysis. Strong static function-entry/call-count agreement is independently documented. Byte-exact independently relinked executable and SDK functional parity are **not proven**.
