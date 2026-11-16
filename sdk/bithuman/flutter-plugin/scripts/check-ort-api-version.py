#!/usr/bin/env python3
"""check-ort-api-version.py: refuse a native library that asks ONNX Runtime for a C API version the staged
runtime does not serve (2.6.40; scripts/bootstrap.sh runs it on what it staged).

ONNX Runtime serves its C API by number: `OrtGetApiBase()->GetApi(N)` returns the API table for N <= its own
ORT_API_VERSION and NULL above it. A library compiled against newer headers than the runtime it is linked with
asks for a number the runtime does not have, gets NULL, and crashes the app on its first ONNX Runtime call. The
plugin links ONE static ONNX Runtime (1.26.0: C API version 26) on iOS and macOS, so every staged library that
calls ONNX Runtime must ask for 26 or less. libconverse `converse-apple-v2.5.1`'s macOS slice asked for 27 (it
was compiled against Homebrew's 1.27 headers): linked against the static 1.26 it crashed when the voice loaded.
The pinned release is fine; this check keeps a candidate or an override (LIBCONVERSE_RELEASE / LIBCONVERSE_SHA256
/ LIBCONVERSE_XCF_ZIP / BITHUMAN_SDK_DIR, ESSENCE2_XCF_DIR, ORT_XCFRAMEWORK_DIR) from building that crash.

How: the served version is `#define ORT_API_VERSION <n>` of the staged runtime's onnxruntime_c_api.h. For each
library (a static archive, a Mach-O object, an .xcframework: every slice and every architecture of it), every
object that calls `_OrtGetApiBase` is disassembled (objdump -d -r), and at each call site the version handed to
the GetApi call that follows it is read: arm64 `bl _OrtGetApiBase` ... `mov` of N into the first argument
register ... `blr/br xR` (inline or through an `_OUTLINED_FUNCTION_k`), x86_64 `call _OrtGetApiBase` ...
`movl $N, %edi` ... `call/jmp *`. A number above the served version fails the check (exit 3). Every call site must
be read: a GetApi(N) whose N is a constant, or GetVersionString (the pointer at offset 8 of the OrtApiBase table).
Anything this cannot read (a GetApi whose N is not a constant, a call it does not recognise, an object that names
`_OrtGetApiBase` but has no call site it can read, as in a linked dylib, or an LLVM bitcode member built with -flto)
cannot be checked (exit 2): fail closed, never a pass.

usage: check-ort-api-version.py --ort <onnxruntime.xcframework | dir | onnxruntime_c_api.h> [--ort ...]
                                [--refused-list FILE] <library>...
exit:  0 every call site asks for a version the runtime serves; 3 refused (each library named; with
       --refused-list, the refused <library> arguments are written there, one per line); 2 could not check
       (usage, no objdump, no ORT_API_VERSION in the given headers, an unreadable library, a call site or an object
       whose version cannot be read: above).

Needs python3 and objdump (llvm-objdump; the Xcode command line tools' objdump is one). Apache-2.0; (c) bitHuman.
"""
import collections
import os
import plistlib
import re
import shutil
import struct
import subprocess
import sys
import tempfile

SYMBOL = b"_OrtGetApiBase"
CPU_ARM64 = 0x0100000C
CPU_X86_64 = 0x01000007
ARCH = {CPU_ARM64: "arm64", CPU_X86_64: "x86_64"}


class CannotCheck(Exception):
    pass


class Unreadable(CannotCheck):
    """One library whose C API version cannot be read (it is listed with the refused ones: un-staged, never passed)."""


# ---------------------------------------------------------------- the served version

def served_version(paths):
    """The ORT_API_VERSION of the staged runtime's headers (the lowest, if copies disagree)."""
    found = {}
    for p in paths:
        heads = []
        if os.path.isfile(p):
            heads = [p]
        elif os.path.isdir(p):
            for root, _dirs, files in os.walk(p, followlinks=True):
                heads += [os.path.join(root, f) for f in files if f == "onnxruntime_c_api.h"]
        for h in heads:
            try:
                text = open(h, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            m = re.search(r"^\s*#\s*define\s+ORT_API_VERSION\s+(\d+)\b", text, re.M)
            if m:
                found[os.path.realpath(h)] = int(m.group(1))
    if not found:
        raise CannotCheck("no `#define ORT_API_VERSION` in an onnxruntime_c_api.h under %s" % ", ".join(paths))
    return min(found.values()), sorted(set(found.values()))


# ---------------------------------------------------------------- the libraries' objects

def binaries(arg):
    """(label, path) of every binary [arg] names: itself, an .xcframework's slices, or the .a files of a dir."""
    if os.path.isfile(arg):
        return [(arg, arg)]
    if not os.path.isdir(arg):
        raise CannotCheck("no such library: %s" % arg)
    info = os.path.join(arg, "Info.plist")
    if arg.rstrip("/").endswith(".xcframework") and os.path.isfile(info):
        with open(info, "rb") as f:
            plist = plistlib.load(f)
        out = []
        for lib in plist.get("AvailableLibraries", []):
            ident = lib.get("LibraryIdentifier", "")
            rel = lib.get("BinaryPath") or lib.get("LibraryPath", "")
            b = os.path.join(arg, ident, rel)
            if os.path.isdir(b):  # a .framework without BinaryPath: its binary has the framework's name
                b = os.path.join(b, os.path.splitext(os.path.basename(b))[0])
            if not os.path.isfile(b):
                raise CannotCheck("%s lists %s/%s, which is not there" % (arg, ident, rel))
            out.append(("%s/%s" % (os.path.basename(arg.rstrip("/")), ident), b))
        return out
    out = []
    for root, _dirs, files in os.walk(arg, followlinks=True):
        out += [(os.path.join(root, f), os.path.join(root, f)) for f in sorted(files) if f.endswith(".a")]
    return out


def thin(data):
    """[(cputype, bytes)] of a universal binary's slices, or [(None, data)] for a thin one."""
    if len(data) >= 8 and data[:4] in (b"\xca\xfe\xba\xbe", b"\xca\xfe\xba\xbf"):
        wide = data[3] == 0xBF
        n = struct.unpack(">I", data[4:8])[0]
        if n > 64:  # 0xcafebabe is also a Java class file; a fat header never has this many slices
            return [(None, data)]
        out, off = [], 8
        for _ in range(n):
            if wide:
                cpu, _sub, o, size, _al, _res = struct.unpack(">iiQQII", data[off:off + 32])
                off += 32
            else:
                cpu, _sub, o, size, _al = struct.unpack(">iiIII", data[off:off + 20])
                off += 20
            out.append((cpu & 0xFFFFFFFF, data[o:o + size]))
        return out
    return [(None, data)]


def members(data):
    """[(name, bytes)] of an `ar` archive (BSD `#1/<n>` and GNU `//` long names), or [('', data)] for an object."""
    if not data.startswith(b"!<arch>\n"):
        return [("", data)]
    out, off, longnames = [], 8, b""
    while off + 60 <= len(data):
        head = data[off:off + 60]
        name = head[:16].decode("ascii", "replace").rstrip()
        try:
            size = int(head[48:58].decode("ascii").strip() or "0")
        except ValueError:
            raise CannotCheck("a malformed archive member header at offset %d" % off)
        body = data[off + 60:off + 60 + size]
        off += 60 + size + (size & 1)
        if name.startswith("#1/"):
            n = int(name[3:])
            name, body = body[:n].rstrip(b"\0").decode("utf-8", "replace"), body[n:]
        elif name == "//":
            longnames = body
            continue
        elif name.startswith("/") and name[1:].isdigit():
            i = int(name[1:])
            name = longnames[i:longnames.find(b"\n", i)].decode("utf-8", "replace").rstrip("/")
        elif name in ("/", "/SYM64/") or name.startswith("__.SYMDEF"):
            continue
        out.append((name.rstrip("/"), body))
    return out


def macho_cpu(obj):
    if len(obj) < 8:
        return None
    magic = struct.unpack("<I", obj[:4])[0]
    if magic in (0xFEEDFACF, 0xFEEDFACE):
        return struct.unpack("<I", obj[4:8])[0]
    return None


# ---------------------------------------------------------------- the call sites

def objdump_tool():
    """An objdump that reads Mach-O: $OBJDUMP, llvm-objdump, Xcode's, else `objdump` (on macOS it is LLVM's)."""
    for c in [os.environ.get("OBJDUMP"), "llvm-objdump"] + ["llvm-objdump-%d" % v for v in range(30, 13, -1)]:
        if c and shutil.which(c):
            return shutil.which(c)
    try:
        p = subprocess.run(["xcrun", "--find", "objdump"], capture_output=True, text=True, timeout=30)
        if p.returncode == 0 and p.stdout.strip():
            return p.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    if shutil.which("objdump"):
        return shutil.which("objdump")
    raise CannotCheck("no objdump on PATH (install the Xcode command line tools: xcode-select --install)")


ARM_MOV = re.compile(r"\bmov\s+[w]0,\s*#(0x[0-9a-f]+|\d+)\b")  # the first argument register
ARM_CALL = re.compile(r"\b(blr|br)\s+(x\d+)\b")
ARM_LDR = re.compile(r"\bldr\s+(x\d+),\s*\[x\d+(?:,\s*#(0x[0-9a-f]+|\d+))?\]")  # a function pointer from a table
X86_MOV = re.compile(r"\bmovl?\s+\$(0x[0-9a-f]+|\d+),\s*%edi\b")
X86_CALL = re.compile(r"\b(callq?|jmpq?)\s+\*(?:(0x[0-9a-f]+|\d+)?\(%\w+\)|%(\w+))")
X86_LDR = re.compile(r"\bmovq?\s+(0x[0-9a-f]+|\d+)?\(%\w+\),\s*%(\w+)")
VERSION_STRING = "GetVersionString"  # OrtApiBase offset 8: harmless, asks for no version
GETAPI_UNREAD = "GetApi(?)"          # OrtApiBase offset 0 with a version that is not a constant: cannot check
REL_API = re.compile(r"RELOC_BRANCH\w*\s+_OrtGetApiBase\s*$")
REL_OUTLINED = re.compile(r"RELOC_BRANCH\w*\s+(\S*_OUTLINED_FUNCTION_\d+)\s*$")
FUNC = re.compile(r"^[0-9a-f]+ <(.+)>:$")


def call_sites(tool, path, arch):
    """The GetApi(N) argument at every `_OrtGetApiBase` call site of one Mach-O object (None: not readable)."""
    p = subprocess.run([tool, "-d", "-r", "--no-show-raw-insn", path], capture_output=True, text=True, timeout=600)
    if p.returncode != 0:
        raise CannotCheck("objdump failed on %s: %s" % (path, (p.stderr or "").strip()[:300]))
    lines = p.stdout.splitlines()
    funcs = {}
    for i, l in enumerate(lines):
        m = FUNC.match(l.strip())
        if m:
            funcs[m.group(1)] = i
    mov, call, ldr = (ARM_MOV, ARM_CALL, ARM_LDR) if arch == "arm64" else (X86_MOV, X86_CALL, X86_LDR)

    def scan(start, depth=0):
        """What the first indirect call after `_OrtGetApiBase` asks for: N (a constant moved into the first argument
        register within 4 lines before the call), VERSION_STRING (the pointer at offset 8), GETAPI_UNREAD (the pointer
        at offset 0, N not a constant), or None (not recognised)."""
        loads, moved = {}, None
        for j in range(start, min(start + 16, len(lines))):
            line = lines[j]
            if j > start and FUNC.match(line.strip()):
                return None
            m = mov.search(line)
            if m:
                moved = (j, int(m.group(1), 0))
            ld = ldr.search(line)
            if ld:
                reg, off = (ld.group(1), ld.group(2)) if arch == "arm64" else (ld.group(2), ld.group(1))
                loads[reg] = int(off or "0", 0)
            c = call.search(line)
            if c:
                if moved is not None and j - moved[0] <= 4:
                    return moved[1]
                if arch == "arm64":
                    off = loads.get(c.group(2))
                elif c.group(3):
                    off = loads.get(c.group(3))
                else:
                    off = int(c.group(2) or "0", 0)
                return VERSION_STRING if off == 8 else GETAPI_UNREAD if off == 0 else None
            o = REL_OUTLINED.search(line)
            if o and depth == 0 and o.group(1) in funcs:
                v = scan(funcs[o.group(1)] + 1, 1)
                if v is not None:
                    return v
        return None

    return [scan(i + 1) for i, l in enumerate(lines) if REL_API.search(l)]


# ---------------------------------------------------------------- main

def main(argv):
    ort, libs, refused_list, i = [], [], None, 0
    while i < len(argv):
        a = argv[i]
        if a in ("-h", "--help"):
            print(__doc__)
            return 0
        if a in ("--ort", "--refused-list"):
            if i + 1 >= len(argv):
                raise CannotCheck("%s needs a value" % a)
            if a == "--ort":
                ort.append(argv[i + 1])
            elif refused_list is not None:
                raise CannotCheck("--refused-list given twice")
            else:
                refused_list = argv[i + 1]
            i += 2
            continue
        if a.startswith("-"):
            raise CannotCheck("unknown option %s" % a)
        libs.append(a)
        i += 1
    if not ort or not libs:
        raise CannotCheck("usage: check-ort-api-version.py --ort <onnxruntime.xcframework|headers> <library>...")
    served, versions = served_version(ort)
    tool = objdump_tool()
    print("ONNX Runtime C API served by the staged runtime: %d (ORT_API_VERSION in its headers: %s)"
          % (served, ", ".join(map(str, versions))))
    refused, unreadable = [], []
    tmp = tempfile.mkdtemp(prefix="ort-api-check.")
    try:
        n = 0
        for lib in libs:
            bad = []
            try:
                n = check_library(lib, tool, tmp, served, bad, n)
            except Unreadable as e:
                unreadable.append(lib)
                print("CANNOT CHECK: %s" % e)
                continue
            if bad:
                refused.append(lib)
                for line in bad:
                    print("REFUSED: %s" % line)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if refused_list is not None:
        with open(refused_list, "w") as f:
            f.writelines(r + "\n" for r in refused + unreadable)
    if refused:
        print("REFUSED: %s %s ONNX Runtime for a C API version above %d. The staged runtime answers that GetApi "
              "call with NULL, so the app would crash on its first ONNX Runtime call. Use builds compiled against "
              "ONNX Runtime 1.%d (or older) headers: libconverse converse-apple-v2.5.2 or later."
              % (" and ".join(refused), "asks" if len(refused) == 1 else "ask", served, served))
    if unreadable:
        print("CANNOT CHECK: %s: the C API version %s asks ONNX Runtime for cannot be read, so it is not passed "
              "(fail closed). Stage plain Mach-O static builds whose every OrtGetApiBase()->GetApi call names a "
              "constant version: libconverse converse-apple-v2.5.2 or later."
              % (" and ".join(unreadable), "it" if len(unreadable) == 1 else "each"))
    if refused:
        return 3
    if unreadable:
        return 2
    print("ok: every ONNX Runtime call site asks for a C API version the staged runtime serves (<= %d)" % served)
    return 0


def check_library(lib, tool, tmp, served, bad, n):
    """Every call site of [lib] (all its slices and objects): lines printed, refusals appended to [bad]. Raises
    Unreadable when a part of it cannot be read. Returns the running object counter."""
    for label, b in binaries(lib):
        try:
            data = open(b, "rb").read()
        except OSError as e:
            raise CannotCheck("cannot read %s: %s" % (b, e))
        for cpu, sl in thin(data):
            per = collections.defaultdict(collections.Counter)
            arch_seen = None
            for name, obj in members(sl):
                c = macho_cpu(obj)
                # A Mach-O object names the symbol `_OrtGetApiBase`; LLVM bitcode (-flto) names it without the underscore.
                if SYMBOL not in obj and (c is not None or SYMBOL[1:] not in obj):
                    continue
                what = "%s%s" % (label, " (%s)" % name if name else "")
                if c is None:
                    kind = ("LLVM bitcode (built with -flto or -fembed-bitcode)"
                            if obj[:4] in (b"BC\xc0\xde", b"\xde\xc0\x17\x0b") else "not a Mach-O object")
                    raise Unreadable("%s names OrtGetApiBase but is %s: the C API version it asks for cannot "
                                      "be read. Stage a build of plain Mach-O objects" % (what, kind))
                arch = ARCH.get(c)
                if arch is None:
                    raise Unreadable("%s names OrtGetApiBase but is a Mach-O object for CPU type 0x%x, which "
                                      "this check does not read" % (what, c))
                arch_seen = arch
                n += 1
                f = os.path.join(tmp, "m%06d.o" % n)
                with open(f, "wb") as out:
                    out.write(obj)
                sites = call_sites(tool, f, arch)
                os.remove(f)
                if not sites:
                    raise Unreadable("%s [%s] names OrtGetApiBase but has no call to it this check can read "
                                      "(a linked library, or the function's address taken): the C API version "
                                      "it asks for cannot be read" % (what, arch))
                bad_sites = sum(1 for v in sites if v is None or v == GETAPI_UNREAD)
                if bad_sites:
                    raise Unreadable("%s [%s]: %d of its %d OrtGetApiBase call site(s) ask for a C API version "
                                      "this check cannot read (%s)" % (what, arch, bad_sites, len(sites),
                                      "GetApi with a version that is not a constant" if GETAPI_UNREAD in sites
                                      else "a call it does not recognise"))
                for v in sites:
                    per[name or os.path.basename(b)][v] += 1
            if not per:
                continue
            where = "%s [%s]" % (label, arch_seen or ARCH.get(cpu, "?"))
            asks = collections.Counter()
            for c in per.values():
                asks.update(c)
            shown = ", ".join("%s: %d" % ("GetApi(%d)" % k if isinstance(k, int) else k, v)
                              for k, v in sorted(asks.items(), key=lambda kv: (not isinstance(kv[0], int),
                                                                               kv[0] if isinstance(kv[0], int) else 0)))
            print("  %s: %d call site(s) of OrtGetApiBase; %s" % (where, sum(asks.values()), shown))
            for obj, c in sorted(per.items()):
                over = sorted(k for k in c if isinstance(k, int) and k > served)
                if over:
                    bad.append("%s %s asks for C API version %s (%d call site(s))"
                               % (where, obj, "/".join(map(str, over)), sum(c[k] for k in over)))
    return n


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except CannotCheck as e:
        print("check-ort-api-version: cannot check: %s" % e, file=sys.stderr)
        sys.exit(2)
