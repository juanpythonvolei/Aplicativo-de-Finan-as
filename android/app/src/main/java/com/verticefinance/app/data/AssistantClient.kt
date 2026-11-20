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

data class AssistantRoutingInfo(
    val complexity: String,
    val complexityLabel: String,
    val selectedModel: String,
    val selectedThinkingLevel: String,
    val reason: String,
    val isDynamic: Boolean
)

data class AssistantApiResult(
    val text: String,
    val functionCalls: List<AssistantApiCall>,
    val modelContent: JSONObject?,
    val profileId: String,
    val routing: AssistantRoutingInfo?
)

data class ModelApiUsageItem(
    val modelId: String,
    val label: String,
    val requests: Int,
    val inputTokens: Long,
    val outputTokens: Long,
    val thinkingTokens: Long,
    val totalTokens: Long,
    val avgLatencyMs: Int,
    val estimatedCostUsd: Double
)

data class ApiUsageSummary(
    val scope: String,
    val totalRequests: Int,
    val totalTokens: Long,
    val estimatedCostUsd: Double,
    val models: List<ModelApiUsageItem>
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

        val routingObj = root.optJSONObject("routing")
        val routingInfo = routingObj?.let { r ->
            AssistantRoutingInfo(
                complexity = r.optString("complexity", "moderate"),
                complexityLabel = r.optString("complexityLabel", "Moderada"),
                selectedModel = r.optString("selectedModel", "gemini-4-hydrogen"),
                selectedThinkingLevel = r.optString("selectedThinkingLevel", "LOW"),
                reason = r.optString("reason", ""),
                isDynamic = r.optBoolean("isDynamic", false)
            )
        }

        AssistantApiResult(
            text = root.optString("text", ""),
            functionCalls = calls,
            modelContent = root.optJSONObject("modelContent"),
            profileId = root.optString("profileId", "auto_dynamic"),
            routing = routingInfo
        )
    }

    suspend fun fetchApiUsage(idToken: String): ApiUsageSummary = withContext(Dispatchers.IO) {
        val endpoint = baseUrl.trimEnd('/') + "/api/assistant/usage"
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15_000
            readTimeout = 30_000
            if (idToken.isNotBlank()) {
                setRequestProperty("Authorization", "Bearer $idToken")
            }
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
                ?: "Não foi possível carregar o uso da API (HTTP $status)."
            throw IllegalStateException(errMsg)
        }

        val root = json ?: JSONObject()
        val totals = root.optJSONObject("totals") ?: JSONObject()
        val modelsArr = root.optJSONArray("models") ?: JSONArray()
        val models = mutableListOf<ModelApiUsageItem>()
        for (i in 0 until modelsArr.length()) {
            val m = modelsArr.optJSONObject(i) ?: continue
            models += ModelApiUsageItem(
                modelId = m.optString("modelId", ""),
                label = m.optString("label", m.optString("modelId", "")),
                requests = m.optInt("requests", 0),
                inputTokens = m.optLong("inputTokens", 0L),
                outputTokens = m.optLong("outputTokens", 0L),
                thinkingTokens = m.optLong("thinkingTokens", 0L),
                totalTokens = m.optLong("totalTokens", 0L),
                avgLatencyMs = m.optInt("avgLatencyMs", 0),
                estimatedCostUsd = m.optDouble("estimatedCostUsd", 0.0)
            )
        }

        ApiUsageSummary(
            scope = root.optString("scope", "user"),
            totalRequests = totals.optInt("requests", 0),
            totalTokens = totals.optLong("totalTokens", 0L),
            estimatedCostUsd = totals.optDouble("estimatedCostUsd", 0.0),
            models = models
        )
    }
}
