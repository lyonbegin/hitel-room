package com.google.ai.edge.gallery.customtasks.xrlanguageteacher.models

/**
 * Incremental clause adapter, matching supertonic-realtime's first/later sizing
 * (reference de576308d03478edd169e372e2fbef2b54f52c2f).
 * XR supplies cumulative reply snapshots; only new stable text enters the queue.
 */
internal class XrMixedSpeechBuffer {
  private var committed = ""
  private var emitted = 0
  private val tags = Regex("<[^>]*>")
  private val abbreviations = setOf("mr.","mrs.","ms.","dr.","prof.","sr.","jr.","ph.d.","etc.","e.g.","i.e.","vs.","inc.","ltd.","co.","corp.","st.","ave.","blvd.")
  private val strong = ".!?…。！？"
  private val weak = ",;:—–、，；"
  private val closers = "\"'’”)]}»›」』"

  @Suppress("UNUSED_PARAMETER")
  fun offer(raw: String, done: Boolean, nowMs: Long): List<String> {
    val open = raw.lastIndexOf('<')
    val stable = if (open > raw.lastIndexOf('>')) raw.substring(0, open) else raw
    val plain = tags.replace(stable, "").trimStart()
    if (!plain.startsWith(committed)) return emptyList()
    val out = mutableListOf<String>()
    while (committed.length < plain.length) {
      val remainder = plain.substring(committed.length)
      val rest = remainder.trimStart()
      val spaces = remainder.length - rest.length
      if (rest.isEmpty()) { committed = plain; break }
      val end = nextEnd(rest)
      if (end < 0 && !done) break
      val cut = if (end < 0) rest.length else end
      val part = rest.substring(0, cut).trim()
      committed += remainder.substring(0, spaces + cut)
      if (part.isNotEmpty()) { out.add(part); emitted++ }
    }
    return out
  }

  private fun nextEnd(s: String): Int {
    val target = if (emitted == 0) 60 else 180
    val floor = if (emitted == 0) 0 else 23
    for (i in floor until minOf(s.length, target)) {
      val c = s[i]
      if (c == '\n') return i + 1
      if (c !in strong) continue
      if (c == '.') {
        val tail = s.substring(maxOf(0, i - 6), i + 1).lowercase()
        if (abbreviations.any { tail.endsWith(it) } ||
          (i >= 1 && s[i-1].isUpperCase() && (i < 2 || !s[i-2].isLetter()))) continue
      }
      var j = i + 1
      while (j < s.length && s[j] in closers) j++
      if (j < s.length && s[j].isWhitespace()) return j
    }
    if (s.length < target) return -1
    for (i in minOf(s.length, target)-1 downTo floor) {
      if (s[i] in weak && i+1 < s.length && s[i+1].isWhitespace()) return i+1
    }
    for (i in minOf(s.length, target)-1 downTo floor) {
      if (s[i].isWhitespace() && i > 0) return i
    }
    // As in upstream, a very long unbroken token may require a hard cut.
    // Do not split a UTF-16 surrogate pair.
    return if (target < s.length && s[target-1].isHighSurrogate() && s[target].isLowSurrogate()) target-1 else target
  }
}
