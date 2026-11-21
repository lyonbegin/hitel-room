package ai.bithuman.flutter

import java.io.ByteArrayOutputStream
import kotlin.math.PI
import kotlin.math.sin

fun main() {
    val source = FloatArray(22050 * 4 + 7) { (0.7 * sin(2 * PI * 440 * it / 22050)).toFloat() }
    fun render(block: Int): ByteArray {
        val output = ByteArrayOutputStream()
        val resampler = KoreanPcmResampler(22050, 24000) { output.write(it) }
        var start = 0
        while (start < source.size) {
            val end = minOf(start + block, source.size)
            resampler.push(source.copyOfRange(start, end)); resampler.flushPacket()
            start = end
        }
        resampler.finish()
        return output.toByteArray()
    }
    val whole = render(source.size)
    val expectedSamples = (source.size.toLong() * 24000 + 22049) / 22050
    check(whole.size.toLong() == expectedSamples * 2) { "Audio duration drift" }
    for (size in listOf(1, 137, 2205, 8192)) {
        check(whole.contentEquals(render(size))) { "Callback boundary changes PCM: $size" }
    }
    var firstDelivered = false
    val early = KoreanPcmResampler(22050, 24000) { firstDelivered = true }
    early.push(source.copyOfRange(0, 2206))
    check(firstDelivered) { "PCM withheld until finish" }
    val text = "안녕하세요. 입력한 문장을 그대로 읽어 드립니다. 다음 문장은 앞 문장을 재생하면서 합성합니다."
    val segments = KoreanSpeechSegments.split(text)
    check(segments.size >= 3 && segments.joinToString("") == text)
    check(KoreanSpeechSegments.split("가".repeat(160)).all { it.length <= 64 })
    check(KoreanSpeechSegments.split(" \n ").isEmpty())
    println("PASS_KOREAN_CONTINUOUS_PCM_DURATION_BOUNDARIES_EARLY_DELIVERY_SEGMENTATION")
}
