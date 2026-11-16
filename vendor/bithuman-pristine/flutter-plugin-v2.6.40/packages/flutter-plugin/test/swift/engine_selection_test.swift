// Which engine a `load` names on Apple (shared/Classes/EngineSelection.swift, 2.6.36): an unknown name, or
// an engine the build does not carry, is refused by name instead of rendering Expression 2; from 2.6.39 also
// Expression 2 below iOS 18 / macOS 15. Plain Swift, no Flutter, no engine: scripts/test_swift_unit.sh.
import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String, line: Int = #line) {
  if !ok { failures += 1; print("  FAIL (line \(line)) \(what)") } else { print("  PASS \(what)") }
}

// The same table as EngineRegistry.descriptors.
let ids = [
  EngineId(canonical: "expression2", aliases: ["embody", "expression-2"]),
  EngineId(canonical: "essence2", aliases: ["elevate", "essence-2", "essence-2-light", "essence-2-mobile"]),
]
let full: (String) -> Bool = { _ in true }
let noEssence2: (String) -> Bool = { $0 != "essence2" }

check(EngineSelection.resolve("expression2", among: ids, inBuild: full) == .engine("expression2"), "expression2")
check(EngineSelection.resolve("expression-2", among: ids, inBuild: full) == .engine("expression2"), "the public id expression-2")
check(EngineSelection.resolve("embody", among: ids, inBuild: full) == .engine("expression2"), "the old slug embody")
check(EngineSelection.resolve("essence2", among: ids, inBuild: full) == .engine("essence2"), "essence2")
check(EngineSelection.resolve("essence-2", among: ids, inBuild: full) == .engine("essence2"), "the public id essence-2")
check(EngineSelection.resolve("elevate", among: ids, inBuild: full) == .engine("essence2"), "the old slug elevate")
check(EngineSelection.resolve("essence2", among: ids, inBuild: full).errorMessage == nil, "a usable engine has no error")

// The Dart default until 2.6.36 ('essence') rendered Expression 2 on Apple without a word.
let unknown = EngineSelection.resolve("essence", among: ids, inBuild: full)
check(unknown == .unknown("essence") && unknown.canonical == nil, "'essence' names no engine: refused")
check(unknown.errorMessage?.contains("unknown engine 'essence'") == true
      && unknown.errorMessage?.contains("'expression2' or 'essence2'") == true, "its message names what to pass")
check(EngineSelection.resolve("", among: ids, inBuild: full) == .unknown(""), "an empty name: refused")

// A build where bootstrap did not stage Essence 2 rendered Expression 2 when asked for essence2.
let missing = EngineSelection.resolve("essence-2", among: ids, inBuild: noEssence2)
check(missing == .notInBuild("essence2") && missing.canonical == nil, "essence2 not in the build: refused")
check(missing.errorMessage?.contains("does not include the Essence 2 engine") == true
      && missing.errorMessage?.contains("scripts/bootstrap.sh") == true, "its message says how to fix the build")
check(EngineSelection.resolve("expression2", among: ids, inBuild: noEssence2) == .engine("expression2"),
      "expression2 still loads in that build")
check(EngineSelection.errorCode == "unsupported", "the code is Android's for an engine it cannot run")

// 2.6.36: Essence 2 on an OS older than it renders on (a libessence2 rebuilt at the package floor lets the
// app run on iOS 16) is refused by name, never handed to the engine; Expression 2 still loads there.
let oldOS: (String) -> (need: String, running: String)? = { $0 == "essence2" ? (need: "iOS 26", running: "iOS 17.5") : nil }
let below = EngineSelection.resolve("essence-2", among: ids, inBuild: full, unmetOS: oldOS)
check(below == .needsNewerOS("essence2", need: "iOS 26", running: "iOS 17.5", instead: "expression2")
      && below.canonical == nil, "essence2 below its OS: refused")
check(below.errorMessage?.contains("Essence 2 needs iOS 26 or later; this device runs iOS 17.5") == true
      && below.errorMessage?.contains("engine: 'expression2'") == true, "its message names both OSes and what loads")
check(EngineSelection.resolve("expression2", among: ids, inBuild: full, unmetOS: oldOS) == .engine("expression2"),
      "expression2 still loads on that OS")
check(EngineSelection.resolve("essence2", among: ids, inBuild: noEssence2, unmetOS: oldOS) == .notInBuild("essence2"),
      "a build without Essence 2 says so first")
check(EngineSelection.resolve("essence2", among: ids, inBuild: full, unmetOS: { _ in nil }) == .engine("essence2"),
      "on iOS 26 essence2 loads")

// 2.6.39: Expression 2 renders on iOS 18 / macOS 15 and later (its CoreML models are opset CoreML8). Below that
// the load is refused by name, with the same code as every engine that cannot run here, before the engine (and its
// CoreML compile) exists; Essence 2 there no longer points at Expression 2, which would be refused too.
check(EngineSelection.expression2MinimumOS == "iOS 18 / macOS 15", "Expression 2's floor as the message names it")
let mac14: (String) -> (need: String, running: String)? = {
  $0 == "essence2" ? (need: "macOS 26", running: "macOS 14.8")
    : $0 == "expression2" ? (need: EngineSelection.expression2MinimumOS, running: "macOS 14.8") : nil
}
for name in ["expression2", "expression-2", "embody"] {
  let x2 = EngineSelection.resolve(name, among: ids, inBuild: full, unmetOS: mac14)
  check(x2 == .needsNewerOS("expression2", need: "iOS 18 / macOS 15", running: "macOS 14.8", instead: nil)
        && x2.canonical == nil, "'\(name)' on macOS 14: refused by name")
  check(x2.errorMessage == "Expression 2 needs iOS 18 / macOS 15 or later; this device runs macOS 14.8",
        "'\(name)' on macOS 14: the message names the floor and the running OS, and offers no engine that cannot run")
}
let e2mac14 = EngineSelection.resolve("essence2", among: ids, inBuild: full, unmetOS: mac14)
check(e2mac14 == .needsNewerOS("essence2", need: "macOS 26", running: "macOS 14.8", instead: nil),
      "essence2 on macOS 14: refused, and Expression 2 is not offered")
check(e2mac14.errorMessage == "Essence 2 needs macOS 26 or later; this device runs macOS 14.8",
      "essence2 on macOS 14: its message")
let ios17: (String) -> (need: String, running: String)? = {
  $0 == "essence2" ? (need: "iOS 26", running: "iOS 17.5")
    : $0 == "expression2" ? (need: EngineSelection.expression2MinimumOS, running: "iOS 17.5") : nil
}
let x2ios17 = EngineSelection.resolve("expression2", among: ids, inBuild: noEssence2, unmetOS: ios17)
check(x2ios17.errorMessage == "Expression 2 needs iOS 18 / macOS 15 or later; this device runs iOS 17.5",
      "expression2 on iOS 17 (a build without Essence 2): refused by name")
// iOS 18-25 / macOS 15-25: Expression 2 loads, and Essence 2 still points at it.
let mac15: (String) -> (need: String, running: String)? = { $0 == "essence2" ? (need: "macOS 26", running: "macOS 15.7") : nil }
check(EngineSelection.resolve("expression2", among: ids, inBuild: full, unmetOS: mac15) == .engine("expression2"),
      "expression2 on macOS 15 loads")
check(EngineSelection.resolve("essence2", among: ids, inBuild: full, unmetOS: mac15).errorMessage
      == "Essence 2 needs macOS 26 or later; this device runs macOS 15.7. Load an Expression 2 avatar (engine: 'expression2') on this device",
      "essence2 on macOS 15: the 2.6.36 message, unchanged")
// An unknown name or a missing engine is still said first, whatever the OS.
check(EngineSelection.resolve("essence", among: ids, inBuild: full, unmetOS: mac14) == .unknown("essence"),
      "an unknown name on macOS 14: still 'unknown engine'")
check(EngineSelection.resolve("essence2", among: ids, inBuild: noEssence2, unmetOS: mac14) == .notInBuild("essence2"),
      "essence2 not in the build on macOS 14: says so first")

if failures > 0 { print("engine_selection_test: \(failures) FAILED"); exit(1) }
print("engine_selection_test: all passed")
