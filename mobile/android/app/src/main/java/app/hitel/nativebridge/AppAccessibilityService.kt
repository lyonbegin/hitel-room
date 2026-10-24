package app.hitel.nativebridge

import android.accessibilityservice.AccessibilityService
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

/**
 * Accessible, user-enabled controller for an explicitly opened app.
 * Adapted from the KtAuto NodeUtils + KtAccessibility accessibility-node approach.
 * Never performs transactions or installs APKs; a user must approve purchases.
 */
class AppAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile var instance: AppAccessibilityService? = null
        @Volatile var selectedPackage: String? = null

        private fun eachNode(root: AccessibilityNodeInfo, consumer: (AccessibilityNodeInfo) -> Unit) {
            val queue = ArrayDeque<AccessibilityNodeInfo>()
            queue.add(root)
            var count = 0
            while (queue.isNotEmpty() && count++ < 500) {
                val node = queue.removeFirst()
                consumer(node)
                for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
            }
        }

        fun status(): JSONObject = JSONObject().put("enabled", instance != null)
            .put("selectedPackage", selectedPackage ?: JSONObject.NULL)

        private fun root(): AccessibilityNodeInfo {
            val svc = instance ?: error("ACCESSIBILITY_NOT_ENABLED")
            val root = svc.rootInActiveWindow ?: error("NO_ACTIVE_WINDOW")
            val expected = selectedPackage ?: error("NO_SELECTED_APP")
            if (root.packageName?.toString() != expected) error("ACTIVE_APP_MISMATCH")
            return root
        }

        /** Returns only bounded accessibility metadata, not screenshots or passwords. */
        fun inspect(): JSONObject {
            val top = root()
            val nodes = JSONArray()
            eachNode(top) { n ->
                if (nodes.length() >= 100 || n.isPassword) return@eachNode
                val text = n.text?.toString()?.take(160) ?: ""
                val description = n.contentDescription?.toString()?.take(160) ?: ""
                val viewId = n.viewIdResourceName?.take(160) ?: ""
                if (text.isNotBlank() || description.isNotBlank() || n.isEditable) {
                    nodes.put(JSONObject().put("text", text).put("description", description)
                        .put("viewId", viewId).put("clickable", n.isClickable)
                        .put("editable", n.isEditable).put("scrollable", n.isScrollable))
                }
            }
            return JSONObject().put("packageName", top.packageName?.toString() ?: "")
                .put("nodes", nodes).put("count", nodes.length())
        }

        private fun match(node: AccessibilityNodeInfo, text: String): Boolean =
            node.text?.toString() == text || node.contentDescription?.toString() == text

        fun tapText(text: String): JSONObject {
            require(text.isNotBlank() && text.length <= 160) { "Invalid visible label" }
            val top = root()
            var target: AccessibilityNodeInfo? = null
            eachNode(top) { n ->
                if (target == null && !n.isPassword && match(n,text)) target = n
            }
            var current = target ?: error("LABEL_NOT_FOUND")
            var depth = 0
            while (!current.isClickable && depth++ < 8) {
                current = current.parent ?: error("NO_CLICKABLE_ANCESTOR")
            }
            val clicked = current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            if (!clicked) error("CLICK_REJECTED")
            return JSONObject().put("clicked", true).put("text", text)
        }

        fun setText(text: String): JSONObject {
            require(text.length <= 500) { "Text is too long" }
            val top = root()
            var edit: AccessibilityNodeInfo? = null
            eachNode(top) { n ->
                if (edit == null && n.isEditable && !n.isPassword && n.isFocused) edit = n
            }
            if (edit == null) eachNode(top) { n ->
                if (edit == null && n.isEditable && !n.isPassword) edit = n
            }
            val input = edit ?: error("NO_EDITABLE_FIELD")
            val args = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,text)
            }
            if (!input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,args)) error("TEXT_INPUT_REJECTED")
            return JSONObject().put("updated",true).put("length",text.length)
        }

        fun scroll(forward: Boolean): JSONObject {
            val top = root()
            var node: AccessibilityNodeInfo? = null
            eachNode(top) { n -> if (node == null && n.isScrollable) node = n }
            val target = node ?: error("NO_SCROLLABLE_NODE")
            val action = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                         else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            if (!target.performAction(action)) error("SCROLL_REJECTED")
            return JSONObject().put("scrolled",true).put("forward",forward)
        }

        fun back(): JSONObject {
            val svc = instance ?: error("ACCESSIBILITY_NOT_ENABLED")
            if (!svc.performGlobalAction(GLOBAL_ACTION_BACK)) error("BACK_REJECTED")
            return JSONObject().put("back",true)
        }
    }

    override fun onServiceConnected() { super.onServiceConnected(); instance = this }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* on-demand inspection */ }
    override fun onInterrupt() {}
    override fun onDestroy() { instance = null; super.onDestroy() }
}
