package app.hitel.nativebridge

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.util.ArrayDeque

/**
 * User-armed experiment: click the existing Samsung call recording START control
 * ONCE; never press STOP. Click success is not recording confirmation.
 */
internal object SamsungCallRecordingController {
    private val phoneUis = setOf("com.samsung.android.incallui", "com.android.incallui")
    @Volatile private var armedUntilUptime = 0L
    @Volatile private var state = "NOT_OBSERVED"
    @Volatile private var lastAction = "NONE"
    @Volatile private var phoneWindow = ""
    @Volatile private var lastObservedEpochMs = 0L
    @Volatile private var lastRecordingConfirmedEpochMs = 0L
    @Volatile private var attempted = false
    @Volatile private var lastViewId = ""

    fun armForNextCall() {
        armedUntilUptime = SystemClock.elapsedRealtime() + 20L * 60_000L
        attempted = false
        lastAction = "USER_ARMED_ONE_CLICK"
    }

    fun disarm() {
        armedUntilUptime = 0L
        lastAction = "USER_DISARMED"
    }

    fun status(): JSONObject = JSONObject()
        .put("state", state)
        .put("lastAction", lastAction)
        .put("phoneWindow", phoneWindow)
        .put("lastObservedEpochMs", lastObservedEpochMs)
        .put("lastRecordingConfirmedEpochMs", lastRecordingConfirmedEpochMs)
        .put("lastViewId", lastViewId)
        .put("armed", !attempted && SystemClock.elapsedRealtime() < armedUntilUptime)
        .put("clickAttempted", attempted)
        .put("evidence", "ACCESSIBILITY_NODE_ONLY")

    private fun labels(node: AccessibilityNodeInfo): List<String> = listOfNotNull(
        node.text?.toString(), node.contentDescription?.toString()
    ).filter(String::isNotBlank)

    private fun scan(root: AccessibilityNodeInfo): List<AccessibilityNodeInfo> {
        val nodes = ArrayList<AccessibilityNodeInfo>()
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty() && nodes.size < 500) {
            val node = queue.removeFirst()
            if (!node.isVisibleToUser || node.isPassword) continue
            nodes.add(node)
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
        return nodes
    }

    private fun clickable(start: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var current: AccessibilityNodeInfo? = start
        repeat(7) {
            val node = current ?: return null
            if (node.isClickable && node.isEnabled && node.isVisibleToUser) return node
            current = node.parent
        }
        return null
    }

    /** Called by AccessibilityService on its main thread, never by a background worker. */
    fun onEvent(service: AccessibilityService, event: AccessibilityEvent?) {
        if (event == null || event.eventType !in setOf(
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
            )) return
        if (event.packageName?.toString() !in phoneUis) return
        val root = service.rootInActiveWindow ?: return
        val rootPackage = root.packageName?.toString() ?: return
        if (rootPackage !in phoneUis) return
        phoneWindow = rootPackage
        lastObservedEpochMs = System.currentTimeMillis()
        val nodes = scan(root)
        state = CallRecordingLabels.classify(nodes.flatMap(::labels))
        if (state == "RECORDING_ACTIVE") {
            lastRecordingConfirmedEpochMs = System.currentTimeMillis()
            armedUntilUptime = 0L
            lastAction = "STOP_LABEL_CONFIRMED_NO_CLICK"
            return
        }
        if (state != "RECORDING_START_AVAILABLE") return
        if (attempted || SystemClock.elapsedRealtime() >= armedUntilUptime) return
        val start = nodes.firstOrNull { n -> labels(n).any(CallRecordingLabels::isStart) }
            ?: return
        val target = clickable(start) ?: run {
            lastAction = "START_CONTROL_NOT_CLICKABLE"
            return
        }
        // The explicit user authorization applies to one click, never retries silently.
        attempted = true
        armedUntilUptime = 0L
        lastViewId = start.viewIdResourceName ?: ""
        val accepted = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        lastAction = if (accepted) "START_CLICK_ACCEPTED_NOT_CONFIRMED" else "START_CLICK_REJECTED"
        Log.i("HITEL_CALL_REC", "$lastAction package=$phoneWindow viewId=$lastViewId")
    }
}
