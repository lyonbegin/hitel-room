from pathlib import Path

def once(s, old, new):
    if s.count(old) != 1: raise AssertionError(f'Stream adapter anchor {s.count(old)}: {old[:90]}')
    return s.replace(old, new, 1)

def patch_streaming_engine(engine: Path):
    s = engine.read_text(encoding='utf-8')
    s = once(s, '    private var delivered = 0L\n',
             '    private var delivered = 0L\n    private var lastFrameNs = 0L\n')
    s = once(s, '        utterances++\n',
             '        utterances++\n        lastFrameNs = System.nanoTime()\n')
    s = once(s, 'delivered = PlayoutClock.nextDelivered(k, delivered); framesTotal++',
             'delivered = PlayoutClock.nextDelivered(k, delivered); framesTotal++\n'
             '                        lastFrameNs = System.nanoTime()')
    s = once(s, '        if (!closed) return\n        open = false\n',
        '''        if (!closed) return
        val expected = (uttFed + HOP - 1) / HOP
        // available()==0/one refused pull does not mean the inference worker finished.
        val quietMs = (System.nanoTime() - lastFrameNs) / 1000000
        if (delivered < expected && (delivered == 0L || queued > 0 || quietMs < 5000L)) return
        HitelE2Trace.event("sdk.utterance.drained", "utterance" to utterances,
            "framesThrough" to delivered, "expectedFrames" to expected,
            "complete" to (delivered >= expected), "quietMs" to quietMs)
        open = false
''')
    # The original bh-feed worker already serialises feed/tail/reset. Keep only
    # metadata under the adapter monitor: the native feed can wait for the
    # renderer to drain its bounded queue. Holding this monitor across it
    # prevented the renderer from publishing the frame that would free it.
    start = s.index('    @Synchronized override fun feed(f16k: FloatArray) {',
                    s.index('class Essence2Engine('))
    end = s.index('    @Synchronized override fun reset() {', start)
    s = s[:start] + '''    override fun feed(f16k: FloatArray) {
        if (f16k.isEmpty()) return
        val generation = synchronized(this) {
            if (closed && open) { pending.add(f16k); pendingN = pending.size; return }
            if (!open || closed) startUtterance()
            uttFed += f16k.size
            open = true
            gen
        }
        val feedAt = System.nanoTime()
        HitelE2Trace.event("sdk.feed.begin", "samples16k" to f16k.size)
        avatar.feed(f16k)
        val available = avatar.available()
        synchronized(this) { if (generation == gen) queued = available }
        HitelE2Trace.event("sdk.feed.end", "durationUs" to (System.nanoTime() - feedAt) / 1000,
            "sdkQueued" to available, "adapterMonitorHeld" to false)
        renderSpot.wake()
    }

    override fun flushTail() {
        val generation = synchronized(this) {
            if (pending.isNotEmpty()) { pendingClose = true; return }
            if (!open || closed) return
            gen
        }
        // While native tail processing runs, closed remains false. A refused
        // pull during this call is not an utterance boundary.
        val tailAt = System.nanoTime()
        avatar.endOfAudio()
        val available = avatar.available()
        synchronized(this) {
            if (generation == gen) {
                closed = true; queued = available; lastFrameNs = System.nanoTime()
            }
        }
        HitelE2Trace.event("sdk.endOfAudio.end", "durationUs" to (System.nanoTime() - tailAt) / 1000,
            "adapterMonitorHeld" to false)
        renderSpot.wake()
    }

''' + s[end:]
    s = once(s, '            val monitorWantedAt = System.nanoTime()\n',
             '            val availableAfterPull = avatar.available()\n'
             '            val monitorWantedAt = System.nanoTime()\n')
    s = once(s, '                queued = avatar.available()\n                when {',
             '                queued = availableAfterPull\n                when {')
    s = once(s, '                        "sdkQueued" to avatar.available())',
             '                        "sdkQueued" to availableAfterPull)')
    s = once(s, '            val monitorWantedAt = System.nanoTime()\n',
             '            var idleStepCount = 0\n            val monitorWantedAt = System.nanoTime()\n')
    s = once(s, '                        repeat(PlayoutClock.idleSteps(k, delivered, nt)) { stepIdle() }',
             '                        idleStepCount = PlayoutClock.idleSteps(k, delivered, nt)')
    s = once(s, '            if (at < 0) {\n',
             '            repeat(idleStepCount) { if (g == gen) stepIdle() }\n            if (at < 0) {\n')
    s = once(s, '    private var closed = false\n', '    @Volatile private var closed = false\n')
    engine.write_text(s, encoding='utf-8')
