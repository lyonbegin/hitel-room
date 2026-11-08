package app.hitel.nativebridge

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.telephony.TelephonyManager
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Standalone diagnostic launcher inside the existing app; not a replacement dialer.
 * Opens the original Phone UI for a real user-initiated call. Polls MediaStore
 * every 2.5s, while accessibility observes whether Samsung's STOP label appears.
 * Keeps all recording metadata locally; NEVER uploads call audio or JSON.
 */
class CallRecordingProbeActivity : Activity() {
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val sampling = AtomicBoolean(false)
    private var watching = false
    private var sessionStart = 0L
    private var entries = JSONArray()
    private val previousSizes = HashMap<String, Long>()
    private var recordingUiConfirmed = false
    private var duringCallReadable = false
    private var duringCallSizeGrew = false
    private var mediaSeenDuringCall = false
    private var lastIdleAtMillis = 0L
    private lateinit var output: TextView

    private val poll = object : Runnable {
        override fun run() {
            if (!watching) return
            if (sampling.compareAndSet(false, true)) {
                worker.execute {
                    val snapshot = CallRecordingFileProbe.sample(applicationContext, sessionStart)
                    val controls = SamsungCallRecordingController.status()
                    val telephony = callState()
                    runOnUiThread {
                        try {
                            if (watching) appendSample(snapshot, controls, telephony)
                        } finally {
                            sampling.set(false)
                        }
                    }
                }
            }
            main.postDelayed(this, 2_500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "삼성 통화녹음 파일 접근 검증"
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(20, 18, 20, 22)
        }
        val titleView = TextView(this).apply {
            text = "삼성 전화 녹음 검증 — InCallUI / MediaStore"
            textSize = 18f
        }
        root.addView(titleView)
        addButton(root, "① 접근성 서비스 설정") {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        addButton(root, "② 오디오·전화상태 권한 요청") { requestTestPermissions() }
        addButton(root, "③ 다음 통화에서 '녹음 시작' 한 번만 누르기 허용") {
            SamsungCallRecordingController.armForNextCall()
            printStatus("사용자 허가: 삼성 녹음 시작 버튼 1회 클릭 대기")
        }
        addButton(root, "자동 클릭 해제") {
            SamsungCallRecordingController.disarm()
            printStatus("자동 클릭 해제")
        }
        addButton(root, "④ 2.5초 간격 파일 검사 시작") { begin() }
        addButton(root, "⑤ 기본 전화 앱 열기 (직접 발신)") {
            startActivity(Intent(Intent.ACTION_DIAL))
        }
        addButton(root, "검사 종료") { finishProbe() }
        addButton(root, "진단 결과 로컬 Download 폴더에 저장") { saveReport() }
        output = TextView(this).apply {
            text = "검사 시작 → 자동 클릭 허용 → 전화 앱으로 이동하여 실제 통화\n" +
                   "녹음 중에도 파일이 읽히는지, 크기가 늘어나는지 기록합니다.\n" +
                   "녹음 중 파일이 보이지 않아도 녹음 자체의 실패로 판정하지 않습니다."
            textSize = 13f
            setTextIsSelectable(true)
        }
        root.addView(output)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun addButton(container: LinearLayout, label: String, callback: () -> Unit) {
        container.addView(Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { callback() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun requestTestPermissions() {
        val perms = mutableListOf<String>()
        val audio = if (Build.VERSION.SDK_INT >= 33)
            Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE
        if (checkSelfPermission(audio) != PackageManager.PERMISSION_GRANTED) perms.add(audio)
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            perms.add(Manifest.permission.READ_PHONE_STATE)
        if (perms.isEmpty()) printStatus("검사 권한이 이미 허용되어 있습니다.")
        else requestPermissions(perms.toTypedArray(), 5701)
    }

    @Suppress("DEPRECATION")
    private fun callState(): String {
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            return "PERMISSION_REQUIRED"
        return try {
            val tel = getSystemService(TELEPHONY_SERVICE) as TelephonyManager
            when (tel.callState) {
                TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
                TelephonyManager.CALL_STATE_RINGING -> "RINGING"
                TelephonyManager.CALL_STATE_IDLE -> "IDLE"
                else -> "UNKNOWN"
            }
        } catch (_: Exception) { "UNAVAILABLE" }
    }

    private fun begin() {
        watching = false
        main.removeCallbacks(poll)
        previousSizes.clear()
        entries = JSONArray()
        sessionStart = System.currentTimeMillis()
        recordingUiConfirmed = false
        duringCallReadable = false
        duringCallSizeGrew = false
        mediaSeenDuringCall = false
        lastIdleAtMillis = 0L
        watching = true
        printStatus("파일 검사 시작. 사용자께서 실제 삼성 전화 화면을 여시기 바랍니다.")
        main.post(poll)
    }

    private fun appendSample(media: JSONObject, control: JSONObject, telephony: String) {
        if (telephony == "IDLE") lastIdleAtMillis = System.currentTimeMillis()
        val isDuringCall = CallRecordingEvidence.isRecordingDuringProbe(
            callState = telephony,
            uiState = control.optString("state"),
            uiPackage = control.optString("phoneWindow"),
            confirmedAtMillis = control.optLong("lastRecordingConfirmedEpochMs", 0),
            observedAtMillis = control.optLong("lastObservedEpochMs", 0),
            probeStartMillis = sessionStart,
            lastIdleAtMillis = lastIdleAtMillis
        )
        recordingUiConfirmed = recordingUiConfirmed || isDuringCall
        val sources = listOfNotNull(media.optJSONArray("files"), media.optJSONArray("filesystemFiles"))
        var recentFiles = 0
        var readable = 0
        var grew = 0
        for (files in sources) for (i in 0 until files.length()) {
            val file = files.optJSONObject(i) ?: continue
            if (!file.optBoolean("modifiedAfterTestStart", false)) continue
            recentFiles++
            val uri = file.optString("uri")
            val size = file.optLong("sizeBytes")
            if (isDuringCall) {
                mediaSeenDuringCall = true
                if (file.optString("readStatus") == "READ_OK") {
                    readable++
                    duringCallReadable = true
                }
                val last = previousSizes[uri]
                if (last != null && size > last) {
                    grew++
                    duringCallSizeGrew = true
                }
            }
            previousSizes[uri] = size
        }
        val record = JSONObject()
            .put("timestampEpochMs", System.currentTimeMillis())
            .put("callState", telephony)
            .put("recordingUiState", control)
            .put("mediaQuery", media)
            .put("candidateDuringCall", isDuringCall)
            .put("evidenceWindow", "CONFIRMED_WITHIN_120S_BEFORE_PROBE_START")
            .put("newOrModifiedFiles", recentFiles)
            .put("readableWhileUiRecording", readable)
            .put("growingFilesWhileUiRecording", grew)
        entries.put(record)
        printStatus("회차 ${entries.length()} / 전화=$telephony / UI=${control.optString("state")} / " +
            "조회=${media.optString("status")} / 최근파일=$recentFiles / 통화중 읽음=$readable / 크기증가=$grew")
    }

    private fun finishProbe() {
        watching = false
        main.removeCallbacks(poll)
        SamsungCallRecordingController.disarm()
        printStatus("검사 종료. 아래 '진단 결과 저장'을 눌러 기록을 보관하실 수 있습니다.")
    }

    private fun report(): JSONObject {
        val judgement = when {
            duringCallReadable && duringCallSizeGrew -> "READABLE_GROWING_DURING_CALL"
            duringCallReadable -> "READABLE_DURING_CALL_SIZE_GROWTH_UNVERIFIED"
            mediaSeenDuringCall -> "VISIBLE_DURING_CALL_READ_NOT_CONFIRMED"
            recordingUiConfirmed -> "UI_RECORDING_CONFIRMED_MEDIA_NOT_VERIFIED"
            else -> "RECORDING_NOT_CONFIRMED"
        }
        return JSONObject()
            .put("test", "Samsung call recording read-only accessibility and file probe")
            .put("startedAtEpochMs", sessionStart)
            .put("endedAtEpochMs", System.currentTimeMillis())
            .put("assessment", judgement)
            .put("recordingUiConfirmed", recordingUiConfirmed)
            .put("mediaSeenDuringCall", mediaSeenDuringCall)
            .put("duringCallReadable", duringCallReadable)
            .put("duringCallSizeGrew", duringCallSizeGrew)
            .put("observations", entries)
            .put("limitations", "OFFHOOK and accessibility labels are indirect evidence; this test does not transcribe audio.")
    }

    private fun saveReport() {
        val data = report().toString(2).toByteArray(Charsets.UTF_8)
        if (Build.VERSION.SDK_INT < 29) {
            printStatus("Android 10 미만에서는 Download 내보내기를 지원하지 않습니다.")
            return
        }
        try {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, "HITEL_CALL_RECORDING_PROBE_${System.currentTimeMillis()}.json")
                put(MediaStore.Downloads.MIME_TYPE, "application/json")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Download MediaStore insert returned null")
            resolver.openOutputStream(uri)?.use { it.write(data) }
                ?: throw IllegalStateException("Could not open report output stream")
            printStatus("기기 Download 폴더에 진단 JSON 저장 완료: $uri")
        } catch (e: Exception) {
            printStatus("내보내기 실패: ${e.javaClass.simpleName}: ${e.message}")
        }
    }

    private fun printStatus(message: String) {
        if (!::output.isInitialized) return
        val verdict = if (sessionStart == 0L) "NOT_STARTED" else when {
            duringCallReadable && duringCallSizeGrew -> "녹음 중 읽기·크기 증가 관측"
            duringCallReadable -> "녹음 중 읽기 관측 / 크기 증가 미확인"
            mediaSeenDuringCall -> "녹음 중 파일 표시 / 읽기 미확인"
            recordingUiConfirmed -> "녹음 UI 확인 / 파일은 미검증"
            else -> "미검증"
        }
        val lines = message + "\n\n상태: " + verdict + "\n\n" + output.text.toString().take(4_800)
        output.text = lines
    }

    override fun onDestroy() {
        watching = false
        main.removeCallbacks(poll)
        worker.shutdownNow()
        super.onDestroy()
    }
}
