package ai.bithuman.flutter

import java.io.File
import java.io.Writer

internal object HitelTimelineCsv {
    private data class Row(val fields: Map<String, String>) {
        operator fun get(key: String): String = fields[key].orEmpty()
        fun number(key: String): Long? = get(key).toLongOrNull()
    }

    private val field = Regex("""(?:^| )([^ =]+)=([^ ]*)""")
    private val frameStages = setOf("sync.generated", "sync.present", "sync.drop")
    private val turnStages = setOf("sync.begin", "sync.preroll", "pcm.received", "sdk.feed",
        "audio.write.done", "audio.start", "audio.clock.first", "audio.finish")

    fun writeFrames(folder: File, writer: Writer) {
        csv(writer, listOf("turn", "sdk_frame_index", "first_pcm_sample", "end_pcm_sample_exclusive",
            "source_start_ms", "source_end_ms", "pcm_received_ns", "sdk_feed_ns", "audio_written_ns",
            "audio_start_ns", "first_audio_clock_ns", "generated_ns", "pull_us", "pull_thread_cpu_us",
            "motion_ready_before_pull", "shown_ns", "audio_sample_at_decision", "late_ms", "result"))
        val turns = linkedMapOf<Long, MutableList<Row>>()
        read(folder) { row ->
            val turn = row.number("turn") ?: return@read
            if (row["stage"] in frameStages || row["stage"] in turnStages) {
                turns.getOrPut(turn) { mutableListOf() }.add(row)
            }
        }
        for ((turn, rows) in turns) {
            val byStage = rows.groupBy { it["stage"] }
            val input = byStage["pcm.received"].orEmpty()
            val finish = byStage["audio.finish"]?.lastOrNull()
            val end = input.mapNotNull { it.number("endSample") }.maxOrNull()
                ?: finish?.number("writtenSamples") ?: continue
            val indexed = rows.filter { it["stage"] in frameStages }.groupBy { it.number("sdkFrameIndex") }
            val feed = byStage["sdk.feed"].orEmpty()
            val written = byStage["audio.write.done"].orEmpty()
            val startNs = byStage["audio.start"]?.firstOrNull()?.get("monotonicNs")
            val firstClock = byStage["audio.clock.first"]?.firstOrNull()?.get("monotonicNs")
            val firstIndex = if (input.firstOrNull()?.number("firstSample") == 0L) 0L
                else indexed.keys.filterNotNull().filter { it >= 0 }.minOrNull() ?: 0L
            val limit = (end / 640L + if (end % 640L == 0L) 0L else 1L).coerceAtMost(firstIndex + 100_000)
            for (index in firstIndex until limit) {
                val from = index * 640L
                val until = minOf(from + 640L, end)
                val available = indexed[index].orEmpty().associateBy { it["stage"] }
                val generated = available["sync.generated"]
                val shown = available["sync.present"]
                val drop = available["sync.drop"]
                val decision = shown ?: drop
                val status = when {
                    shown != null -> "shown"
                    drop != null -> drop["reason"]
                    generated != null -> "generated_no_display_in_log"
                    finish != null -> "sdk_frame_not_returned_in_log"
                    else -> "pending_or_missing"
                }
                csv(writer, listOf(turn, index, from, until, from / 16.0, until / 16.0,
                    covering(input, until), covering(feed, until), covering(written, until),
                    startNs, firstClock, generated?.get("monotonicNs"), generated?.get("pullUs"),
                    generated?.get("pullThreadCpuUs"), generated?.get("motionReadyBefore"),
                    shown?.get("monotonicNs"), decision?.get("audioSamples"), shown?.get("lateMs"), status))
            }
        }
    }

    private fun covering(rows: List<Row>, until: Long): String? =
        rows.firstOrNull { row ->
            val start = row.number("firstSample")
            val end = row.number("endSample")
            start != null && end != null && start < until && until <= end
        }?.get("monotonicNs")

    private fun read(folder: File, consume: (Row) -> Unit) {
        for (name in listOf("hitel_e2_trace.previous.log", "hitel_e2_trace.log")) {
            val file = File(folder, name)
            if (!file.isFile) continue
            file.forEachLine { line ->
                if (" stage=sync." in line || " stage=sdk." in line ||
                    " stage=audio." in line || " stage=pcm.received" in line) {
                    consume(Row(field.findAll(line).associate { it.groupValues[1] to it.groupValues[2] }))
                }
            }
        }
    }

    private fun csv(writer: Writer, columns: List<Any?>) {
        writer.write(columns.joinToString(",") { value ->
            val text = value?.toString().orEmpty()
            if (text.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
                "\"" + text.replace("\"", "\"\"") + "\""
            } else text
        })
        writer.write("\n")
    }
}
