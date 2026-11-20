package com.verticefinance.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class AssistantApiCall(
    val id: String,
    val name: String,
    val args: JSONObject
)

data class AssistantApiResult(
    val text: String,
    val functionCalls: List<AssistantApiCall>,
    val modelContent: JSONObject?,
    val profileId: String
)

class AssistantClient(private val baseUrl: String) {

    suspend fun chat(
        idToken: String,
        contents: JSONArray,
        financialSnapshot: String
    ): AssistantApiResult = withContext(Dispatchers.IO) {
        val endpoint = baseUrl.trimEnd('/') + "/api/assistant/chat"
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 20_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            if (idToken.isNotBlank()) {
                setRequestProperty("Authorization", "Bearer $idToken")
            }
        }

        val payload = JSONObject().apply {
            put("contents", contents)
            put("financialSnapshot", financialSnapshot)
        }

        OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
            writer.write(payload.toString())
            writer.flush()
        }

        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val body = stream?.let {
            BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader -> reader.readText() }
        } ?: ""
        conn.disconnect()

        val json = runCatching { JSONObject(body) }.getOrNull()
        if (status !in 200..299) {
            val errMsg = json?.optString("error")?.takeIf { it.isNotBlank() }
                ?: "Falha na comunicação com o Assistente IA (HTTP $status)."
            throw IllegalStateException(errMsg)
        }

        val root = json ?: JSONObject()
        val callsArr = root.optJSONArray("functionCalls") ?: JSONArray()
        val calls = mutableListOf<AssistantApiCall>()
        for (i in 0 until callsArr.length()) {
            val obj = callsArr.optJSONObject(i) ?: continue
            calls += AssistantApiCall(
                id = obj.optString("id", "call_$i"),
                name = obj.optString("name", ""),
                args = obj.optJSONObject("args") ?: JSONObject()
            )
        }

        AssistantApiResult(
            text = root.optString("text", ""),
            functionCalls = calls,
            modelContent = root.optJSONObject("modelContent"),
            profileId = root.optString("profileId", "economic_smart")
        )
    }
}
