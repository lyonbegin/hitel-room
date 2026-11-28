package com.google.ai.edge.gallery.customtasks.xrlanguageteacher.models

/**
 * Incremental HUD snapshot adapter; no reply-tag or character-count gate.
 * XR supplies cumulative reply snapshots; only new stable text enters the queue.
 */
internal class XrMixedSpeechBuffer {
  private var committed = ""
  private val tags = Regex("<[^>]*>")
  private val abbreviations = setOf("mr.","mrs.","ms.","dr.","prof.","sr.","jr.","ph.d.","etc.","e.g.","i.e.","vs.","inc.","ltd.","co.","corp.","st.","ave.","blvd.")
  private val strong = ".!?…。！？"
  private val closers = "\"'’”)]}»›」』"

  @Suppress("UNUSED_PARAMETER")
  fun offer(raw: String, done: Boolean, nowMs: Long): List<String> {
    val open = raw.lastIndexOf('<')
    val stable = if (open > raw.lastIndexOf('>')) raw.substring(0, open) else raw
    val plain = tags.replace(stable, "").trimStart()
    if (!plain.startsWith(committed)) {
      android.util.Log.w("HITEL_SUPERTONIC", "HUD_PREFIX_REVISED committed=${committed.length} current=${plain.length}")
      if (plain.length < committed.length) return emptyList()
      committed = plain.substring(0, committed.length)
    }
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
      if (part.isNotEmpty()) { out.add(part) }
    }
    return out
  }

  private fun nextEnd(s: String): Int {
    for (i in s.indices) {
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
      if (c != '.' || j == s.length || s[j].isWhitespace()) return j
    }
    return -1
  }
}
