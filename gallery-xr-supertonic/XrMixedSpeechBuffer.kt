package com.google.ai.edge.gallery.customtasks.xrlanguageteacher.models

/**
 * Supertonic is an offline text-to-PCM model. This adapter streams stable text prefixes
 * into its one resident engine while the LLM continues generating. Never synthesize a
 * partial word, never speak markup, never replay a committed prefix.
 */
internal class XrMixedSpeechBuffer {
  private var committed = ""
  private var waitingSince = -1L
  private val tags = Regex("<[^>]*>")
  private val boundaries = Regex("""\s+|[。！？]""")
  fun offer(raw: String, done: Boolean, nowMs: Long): List<String> {
    val open = raw.lastIndexOf('<')
    val stableRaw = if (open > raw.lastIndexOf('>')) raw.substring(0, open) else raw
    val plain = tags.replace(stableRaw, "").trimStart()
    // A transient partial tag may disappear from the latest parser snapshot.
    if (!plain.startsWith(committed)) return emptyList()
    val result = mutableListOf<String>()
    if (waitingSince < 0 && plain.length > committed.length) waitingSince = nowMs
    while (committed.length < plain.length) {
      val rest = plain.substring(committed.length)
      if (rest.isBlank()) break
      val ends = boundaries.findAll(rest).map { it.range.last + 1 }.toList()
      val sentenceEnd = ends.firstOrNull { rest.substring(0,it).trimEnd().lastOrNull() in ".!?。！？".toList() }
      val preferred = ends.filter { it <= 48 && rest.substring(0,it).trim().length >= 12 }
      val timed = waitingSince >= 0 && nowMs - waitingSince >= 350L
      val cut = when {
        sentenceEnd != null && sentenceEnd <= 48 -> sentenceEnd
        preferred.isNotEmpty() && (rest.length >= 30 || timed) -> preferred.last()
        rest.length >= 48 && ends.isNotEmpty() -> ends.first()
        timed && ends.isNotEmpty() && rest.substring(0,ends.last()).trim().length >= 6 -> ends.last()
        done -> rest.length
        else -> break
      }
      val part = rest.substring(0,cut)
      committed += part
      if (part.isNotBlank()) result.add(part.trim())
      waitingSince = if (committed.length < plain.length) nowMs else -1L
    }
    if (done && plain.startsWith(committed) && plain.length > committed.length) {
      val remaining = plain.substring(committed.length)
      if (remaining.isNotBlank()) result.add(remaining.trim())
      committed = plain
    }
    return result
  }
}
