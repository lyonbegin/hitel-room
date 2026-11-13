# Expression 2 native SDK: address-table-first decomposition and reconstruction — corrected audit

## What was wrong with the earlier approach

The previous audit started with the 28 Native JNI entry points and followed static
direct calls to find 1,035 functions (65,933 instructions, 263,732 bytes).
That is only the JNI-reachable call closure and does NOT establish that these
are all native functions in the original library. Earlier statement that
425,324 executable bytes were missing functions was too strong: those bytes
were merely outside the traced closure.

The original binary contains a more comprehensive sorted function-address
index. The authoritative place to start is .eh_frame_hdr and its .eh_frame
FDE list, cross-checked against .dynsym STT_FUNC symbols and relocated
function-pointer tables in .data.rel.ro.

## Direct original ELF proof — Actions 43428318447

CI: https://github.com/lyonbegin/hitel-room/actions/runs/43428318447
Artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43428318447/artifacts/14038263264

- Original vendor AAR SHA256: 067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584
- Original ARM64 SO SHA256: ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c
- Original ARM64 ELF bytes: 1,188,304
- Sorted .eh_frame_hdr table length: 21,044 bytes
- .eh_frame_hdr FDE count: **2,629**
- .eh_frame actual FDE records: **2,629**
- Every .eh_frame_hdr function starting address equals an .eh_frame FDE address.
- Every sorted .eh_frame_hdr FDE pointer equals the referenced .eh_frame entry.
- Header encodings: PC-relative signed 32-bit pointer; data-relative signed
  32-bit sorted search-table entries.
- Original symbol STT_FUNC entries: 1,351, with **1,175 unique starts**.
- FDE starts not present in the symbol list: **1,454**.
- Relocated code-pointer entries: 1,838, with 910 distinct destinations.
  Of these, 1,831 entries originate from .data.rel.ro.
- Unique function-address seed union across the three classes: **2,629**.

FDE is a function unwind range descriptor, and does not always imply
"one FDE equals exactly one complete high-level source function."
It nevertheless provides much more complete executable boundaries than
a JNI-root-only Ghidra call graph.

## Source-address-led code partition vs original

| Original section | Total bytes | Included by symbol/FDE range | Remaining |
|---|---:|---:|---:|
| .text | 681,444 | 681,128 | **316** |
| __lcxx_override | 268 | 268 | 0 |
| .plt | 7,344 | 0 | **7,344** |
| **Total executable** | **689,056** | **681,396** | **7,660** |

- New function-boundary coverage: **98.888%** of the entire ELF executable
  sections, versus **38.27%** from the 1,035-function JNI-origin closure.
- .text coverage: **99.954%**.
- Original byte identity after partition and reassembly: **0 byte difference**.
- Remaining diff when unknown executable regions are omitted/zeroed:
  **6,706 actual nonzero bytes** (not 7,660; some originals are zero).
- Linker PLT is not an original high-level function list and should be
  separately linked or identified as stubs, not counted as undiscovered AI functions.

Exact remaining .text spans:
- 0x113104–0x113110: 12 bytes
- 0x11313c–0x113140: 4 bytes
- 0x117088–0x1171b4: 300 bytes

Original .plt span:
- 0x1172c0–0x118f70: 7,344 bytes

No executable-address candidates from the relocated pointer table point into
these four unclassified spans.

## Correct procedure from now on

1. Begin from original .eh_frame_hdr sorted function start index and exact
   .eh_frame FDE extent, NOT only JNI static call graph.
2. Augment with .dynsym/.symtab exported/hidden function symbols, relocated
   pointer tables, and known JNI export addresses.
3. Partition .text and custom executable sections by these exact extents.
4. Examine the remaining **316 bytes of .text** and treat PLT independently.
5. Bind each recovered function range to .rodata/.data.rel.ro/.data/.bss
   and dynamic relocations, and check indirect callers and state ownership.
6. Distinguish a byte-exact original ELF file-layout roundtrip from an
   independently linked new SO and from actual model inference.
7. Preserve original source addresses and hashes when comparing any
   independently written functional module to original input/output fixtures.

The verified roundtrip does NOT claim that an independently built SDK
already runs its full encoder-to-frame pipeline. No authentication or
metering bytes were altered.

## Source

- tools/bithuman_deep/expression2_address_table_recompose.py
- .github/workflows/expression2-address-table-recompose.yml
