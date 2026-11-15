package com.example.x2hello

import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.Closeable
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Localhost-only CI fixture copied into an isolated *test* APK.
 * It cannot authenticate vendor accounts or replace licensed production
 * metering. No secrets or vendor credentials are stored.
 */
internal class LoopbackAuthFixture(private val log: (String) -> Unit) : Closeable {
    private val running = AtomicBoolean(true)
    private val server = ServerSocket(18762, 16, InetAddress.getByName("127.0.0.1"))
    private val worker = Thread({
        while (running.get()) {
            try {
                val client = server.accept()
                Thread({ handle(client) }, "expr2-test-http-client").apply {
                    isDaemon = true
                    start()
                }
            } catch (error: Throwable) {
                if (running.get()) {
                    Log.e("EXPR2_LOCAL_FIXTURE", "accept failed", error)
                }
            }
        }
    }, "expr2-test-http-listener").apply {
        isDaemon = true
        start()
    }

    init {
        log("TEST_LOCAL_AUTH_READY http://127.0.0.1:18762")
    }

    private fun handle(socket: Socket) {
        try {
            socket.use { client ->
                client.soTimeout = 15000
                val reader = BufferedReader(InputStreamReader(
                    client.getInputStream(), StandardCharsets.UTF_8
                ))
                val requestLine = reader.readLine() ?: return
                val segments = requestLine.split(' ')
                if (segments.size < 2 || segments[0] != "POST") {
                    reply(client, 405, """{"error":"method_not_allowed"}""")
                    return
                }
                val path = segments[1]
                val headers = HashMap<String, String>()
                while (true) {
                    val line = reader.readLine() ?: return
                    if (line.isEmpty()) break
                    val colon = line.indexOf(':')
                    if (colon > 0) {
                        headers[line.substring(0, colon).trim().lowercase()] =
                            line.substring(colon + 1).trim()
                    }
                }
                val size = headers["content-length"]?.toIntOrNull() ?: -1
                if (size !in 2..65536) {
                    reply(client, 413, """{"error":"invalid_content_length"}""")
                    return
                }
                val chars = CharArray(size)
                var read = 0
                while (read < chars.size) {
                    val n = reader.read(chars, read, chars.size - read)
                    if (n <= 0) return
                    read += n
                }
                val body = try {
                    JSONObject(String(chars))
                } catch (error: Throwable) {
                    reply(client, 400, """{"error":"invalid_json"}""")
                    return
                }
                val tokenValid = headers["authorization"] ==
                    "Bearer " + TEST_CREDENTIAL
                val mediaType = headers["content-type"].orEmpty().substringBefore(';').trim()
                if (!tokenValid) {
                    log("TEST_AUTH_REJECTED path=" + path + " reason=token")
                    reply(client, 401, """{"valid":false,"code":"CI_TEST_CREDENTIAL_MISMATCH"}""")
                    return
                }
                if (mediaType != "application/json") {
                    reply(client, 415, """{"error":"invalid_content_type"}""")
                    return
                }
                when (path) {
                    "/v1/auth/validate" -> {
                        if (body.optString("product") != "expression-2") {
                            reply(client, 422, """{"error":"invalid_product"}""")
                            return
                        }
                        // The ORIGINAL validateBody(null) omits agent_code.
                        if (body.has("agent_code") &&
                            body.opt("agent_code") !is String) {
                            reply(client, 422, """{"error":"invalid_agent_code"}""")
                            return
                        }
                        log("TEST_AUTH_VALIDATE_ACCEPTED product=expression-2")
                        reply(client, 200, """{"valid":true,"meter_tail":true}""")
                    }
                    "/v1/meter/beats" -> {
                        val required = listOf(
                            "session_id", "seq", "served_s", "talking_s",
                            "install_id", "product", "billing_type", "deployment"
                        )
                        if (required.any { !body.has(it) }) {
                            reply(client, 422, """{"error":"missing_beat_field"}""")
                            return
                        }
                        log("TEST_METER_BEAT_ACCEPTED seq=" + body.optInt("seq"))
                        reply(client, 200, """{"meter_tail":true}""")
                    }
                    else -> {
                        log("TEST_HTTP_UNKNOWN path=" + path)
                        reply(client, 404, """{"error":"not_found"}""")
                    }
                }
            }
        } catch (error: Throwable) {
            Log.e("EXPR2_LOCAL_FIXTURE", "request handling failed", error)
        }
    }

    private fun reply(socket: Socket, code: Int, json: String) {
        val payload = json.toByteArray(StandardCharsets.UTF_8)
        val label = when (code) {
            200 -> "OK"
            400 -> "Bad Request"
            401 -> "Unauthorized"
            404 -> "Not Found"
            405 -> "Method Not Allowed"
            413 -> "Payload Too Large"
            415 -> "Unsupported Media Type"
            422 -> "Unprocessable Entity"
            else -> "Error"
        }
        val header = (
            "HTTP/1.1 " + code + " " + label + "\r\n" +
            "Content-Type: application/json\r\n" +
            "Content-Length: " + payload.size + "\r\n" +
            "Connection: close\r\n\r\n"
        ).toByteArray(StandardCharsets.US_ASCII)
        socket.getOutputStream().write(header)
        socket.getOutputStream().write(payload)
        socket.getOutputStream().flush()
    }

    override fun close() {
        running.set(false)
        server.close()
    }

    companion object {
        // Public synthetic marker. It is deliberately NOT a license or a secret.
        const val TEST_CREDENTIAL = "EXPR2_PHYSICAL_DEVICE_LOCAL_FIXTURE_NOT_VENDOR_SECRET"
    }
}
