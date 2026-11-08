package app.hitel.nativebridge

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.util.ArrayDeque

/**
 * Operates Samsung's existing, visible in-call recording button through a
 * user-enabled AccessibilityService. It does not capture phone audio itself.
 * ACTION_CLICK accepted != recording confirmed: require the STOP label.
 */
internal object SamsungCallRecordingController {
    private val phoneUis = setOf("com.samsung.android.incallui", "com.android.incallui")
    private var lastAttemptMillis = 0L
    private var attemptsWithoutConfirmation = 0
    private var state = "NOT_OBSERVED"
    private var lastAction = "NONE"
    private var phoneWindow = ""

    fun status(): JSONObject = JSONObject()
        .put("state", state).put("lastAction", lastAction)
        .put("phoneWindow", phoneWindow)
        .put("attemptsWithoutConfirmation", attemptsWithoutConfirmation)

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
            val n = current ?: return null
            if (n.isClickable && n.isEnabled && n.isVisibleToUser) return n
            current = n.parent
        }
        return null
    }

    /** Call only from AccessibilityService.onAccessibilityEvent (main thread). */
    fun onEvent(service: AccessibilityService, event: AccessibilityEvent?) {
        if (event == null || event.eventType !in setOf(
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
            AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED
        )) return
        val eventPackage = event.packageName?.toString() ?: return
        if (eventPackage !in phoneUis) return
        val root = service.rootInActiveWindow ?: return
        val rootPackage = root.packageName?.toString() ?: return
        if (rootPackage !in phoneUis) return
        phoneWindow = rootPackage
        val nodes = scan(root)
        state = CallRecordingLabels.classify(nodes.flatMap(::labels))
        if (state == "RECORDING_ACTIVE") {
            attemptsWithoutConfirmation = 0
            lastAction = "ALREADY_RECORDING_NO_CLICK"
            return
        }
        if (state != "RECORDING_START_AVAILABLE") return
        val now = SystemClock.elapsedRealtime()
        if (now - lastAttemptMillis < 5_000L || attemptsWithoutConfirmation >= 2) return
        val target = nodes.firstOrNull { n -> labels(n).any(CallRecordingLabels::isStart) }
            ?.let(::clickable)
        if (target == null) {
            lastAction = "NO_CLICKABLE_RECORDING_BUTTON"
            return
        }
        lastAttemptMillis = now
        attemptsWithoutConfirmation++
        val clicked = target.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        lastAction = if (clicked) "CLICK_ACCEPTED_AWAITING_STOP_LABEL" else "CLICK_REJECTED"
        Log.i("HITEL_CALL_RECORD", "$lastAction package=$phoneWindow")
    }
}
