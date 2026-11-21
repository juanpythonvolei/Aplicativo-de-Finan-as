package com.verticefinance.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class LocalVaultSnapshot(
    val currency: String = "BRL",
    val theme: String = "light",
    val localMode: Boolean = false,
    val biometricEnabled: Boolean = false,
    val lastUserEmail: String = "",
    val lastUserName: String = "",
    val hasUnsyncedLocalData: Boolean = false,
    val lastSyncedAtMillis: Long = 0L,
    val accounts: List<AccountDoc> = emptyList(),
    val categories: List<CategoryDoc> = emptyList(),
    val transactions: List<TransactionDoc> = emptyList(),
    val budgets: List<BudgetDoc> = emptyList(),
    val goals: List<GoalDoc> = emptyList(),
    val aiConversations: List<AIConversationDoc> = emptyList(),
    val aiMessagesByConv: Map<String, List<AIMessageDoc>> = emptyMap()
)

class LocalFinanceStore(context: Context) {
    private val vaultFile = File(context.filesDir, "vertice_local_vault.json")
    private val tempFile = File(context.filesDir, "vertice_local_vault.json.tmp")
    private val lock = Any()

    fun exists(): Boolean = synchronized(lock) {
        vaultFile.exists() && vaultFile.length() > 0L
    }

    fun defaultCategories(ownerId: String = "local"): List<CategoryDoc> = listOf(
        CategoryDoc("cat_salario", ownerId, "Salário", "income", "Tag", "#16A34A"),
        CategoryDoc("cat_freelance", ownerId, "Freelance & Extras", "income", "Tag", "#0D9488"),
        CategoryDoc("cat_moradia", ownerId, "Moradia & Contas", "expense", "Tag", "#475569"),
        CategoryDoc("cat_alimentacao", ownerId, "Alimentação", "expense", "Tag", "#EA580C"),
        CategoryDoc("cat_transporte", ownerId, "Transporte", "expense", "Tag", "#2563EB"),
        CategoryDoc("cat_saude", ownerId, "Saúde", "expense", "Tag", "#DC2626"),
        CategoryDoc("cat_lazer", ownerId, "Lazer & Viagens", "expense", "Tag", "#D97706")
    )

    fun defaultLocalAccount(ownerId: String = "local"): AccountDoc = AccountDoc(
        id = "acc_local_main",
        userId = ownerId,
        name = "Carteira Principal",
        type = "checking",
        institution = "Local",
        balance = 0.0,
        creditLimit = 0.0,
        closingDay = 0,
        dueDay = 0,
        color = "#0F766E",
        archived = false
    )

    fun load(): LocalVaultSnapshot = synchronized(lock) {
        if (!vaultFile.exists()) return LocalVaultSnapshot()
        return runCatching {
            val raw = vaultFile.readText(Charsets.UTF_8)
            if (raw.isBlank()) return@runCatching LocalVaultSnapshot()
            val root = JSONObject(raw)

            val accounts = buildList {
                val arr = root.optJSONArray("accounts") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        AccountDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            name = o.optString("name", ""),
                            type = o.optString("type", "checking"),
                            institution = o.optString("institution", ""),
                            balance = o.optDouble("balance", 0.0),
                            creditLimit = o.optDouble("creditLimit", 0.0),
                            closingDay = o.optInt("closingDay", 0),
                            dueDay = o.optInt("dueDay", 0),
                            color = o.optString("color", "#0F766E"),
                            archived = o.optBoolean("archived", false)
                        )
                    )
                }
            }

            val categories = buildList {
                val arr = root.optJSONArray("categories") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        CategoryDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            name = o.optString("name", ""),
                            type = o.optString("type", "expense"),
                            icon = o.optString("icon", "Tag"),
                            color = o.optString("color", "#0F766E")
                        )
                    )
                }
            }

            val transactions = buildList {
                val arr = root.optJSONArray("transactions") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        TransactionDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            type = o.optString("type", "expense"),
                            amount = o.optDouble("amount", 0.0),
                            description = o.optString("description", ""),
                            categoryId = o.optString("categoryId", ""),
                            accountId = o.optString("accountId", ""),
                            toAccountId = o.optString("toAccountId", ""),
                            date = o.optString("date", ""),
                            status = o.optString("status", "paid"),
                            isRecurring = o.optBoolean("isRecurring", false),
                            recurrenceFrequency = o.optString("recurrenceFrequency", "none"),
                            installmentGroupId = o.optString("installmentGroupId", ""),
                            installmentNumber = o.optInt("installmentNumber", 0),
                            installmentTotal = o.optInt("installmentTotal", 0),
                            notes = o.optString("notes", "")
                        )
                    )
                }
            }

            val budgets = buildList {
                val arr = root.optJSONArray("budgets") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        BudgetDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            categoryId = o.optString("categoryId", ""),
                            month = o.optString("month", ""),
                            amount = o.optDouble("amount", 0.0)
                        )
                    )
                }
            }

            val goals = buildList {
                val arr = root.optJSONArray("goals") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        GoalDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            name = o.optString("name", ""),
                            targetAmount = o.optDouble("targetAmount", 0.0),
                            currentAmount = o.optDouble("currentAmount", 0.0),
                            deadline = o.optString("deadline", ""),
                            color = o.optString("color", "#0F766E"),
                            status = o.optString("status", "active")
                        )
                    )
                }
            }

            val aiConversations = buildList {
                val arr = root.optJSONArray("aiConversations") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        AIConversationDoc(
                            id = o.optString("id", ""),
                            userId = o.optString("userId", "local"),
                            title = o.optString("title", "Nova conversa"),
                            preview = o.optString("preview", ""),
                            messageCount = o.optInt("messageCount", 0),
                            lastMessageAtMillis = o.optLong("lastMessageAtMillis", 0L)
                        )
                    )
                }
            }

            val aiMessagesByConv = mutableMapOf<String, List<AIMessageDoc>>()
            val msgsRoot = root.optJSONObject("aiMessagesByConv")
            if (msgsRoot != null) {
                val keys = msgsRoot.keys()
                while (keys.hasNext()) {
                    val convId = keys.next()
                    val arr = msgsRoot.optJSONArray(convId) ?: continue
                    val list = buildList {
                        for (i in 0 until arr.length()) {
                            val o = arr.optJSONObject(i) ?: continue
                            val actArr = o.optJSONArray("actionsSummary") ?: JSONArray()
                            val actions = buildList {
                                for (j in 0 until actArr.length()) {
                                    add(actArr.optString(j, ""))
                                }
                            }
                            add(
                                AIMessageDoc(
                                    id = o.optString("id", ""),
                                    userId = o.optString("userId", "local"),
                                    conversationId = o.optString("conversationId", convId),
                                    role = o.optString("role", "user"),
                                    text = o.optString("text", ""),
                                    actionsSummary = actions,
                                    modelProfileId = o.optString("modelProfileId", ""),
                                    hasImage = o.optBoolean("hasImage", false),
                                    createdAtMillis = o.optLong("createdAtMillis", 0L)
                                )
                            )
                        }
                    }
                    aiMessagesByConv[convId] = list
                }
            }

            LocalVaultSnapshot(
                currency = root.optString("currency", "BRL"),
                theme = root.optString("theme", "light"),
                localMode = root.optBoolean("localMode", false),
                biometricEnabled = root.optBoolean("biometricEnabled", false),
                lastUserEmail = root.optString("lastUserEmail", ""),
                lastUserName = root.optString("lastUserName", ""),
                hasUnsyncedLocalData = root.optBoolean("hasUnsyncedLocalData", false),
                lastSyncedAtMillis = root.optLong("lastSyncedAtMillis", 0L),
                accounts = accounts,
                categories = categories,
                transactions = transactions,
                budgets = budgets,
                goals = goals,
                aiConversations = aiConversations,
                aiMessagesByConv = aiMessagesByConv
            )
        }.getOrElse { LocalVaultSnapshot() }
    }

    fun save(snapshot: LocalVaultSnapshot) = synchronized(lock) {
        runCatching {
            val root = JSONObject().apply {
                put("version", 1)
                put("currency", snapshot.currency)
                put("theme", snapshot.theme)
                put("localMode", snapshot.localMode)
                put("biometricEnabled", snapshot.biometricEnabled)
                put("lastUserEmail", snapshot.lastUserEmail)
                put("lastUserName", snapshot.lastUserName)
                put("hasUnsyncedLocalData", snapshot.hasUnsyncedLocalData)
                put("lastSyncedAtMillis", snapshot.lastSyncedAtMillis)

                put("accounts", JSONArray().apply {
                    snapshot.accounts.forEach { a ->
                        put(JSONObject().apply {
                            put("id", a.id)
                            put("userId", a.userId)
                            put("name", a.name)
                            put("type", a.type)
                            put("institution", a.institution)
                            put("balance", a.balance)
                            put("creditLimit", a.creditLimit)
                            put("closingDay", a.closingDay)
                            put("dueDay", a.dueDay)
                            put("color", a.color)
                            put("archived", a.archived)
                        })
                    }
                })

                put("categories", JSONArray().apply {
                    snapshot.categories.forEach { c ->
                        put(JSONObject().apply {
                            put("id", c.id)
                            put("userId", c.userId)
                            put("name", c.name)
                            put("type", c.type)
                            put("icon", c.icon)
                            put("color", c.color)
                        })
                    }
                })

                put("transactions", JSONArray().apply {
                    snapshot.transactions.forEach { t ->
                        put(JSONObject().apply {
                            put("id", t.id)
                            put("userId", t.userId)
                            put("type", t.type)
                            put("amount", t.amount)
                            put("description", t.description)
                            put("categoryId", t.categoryId)
                            put("accountId", t.accountId)
                            put("toAccountId", t.toAccountId)
                            put("date", t.date)
                            put("status", t.status)
                            put("isRecurring", t.isRecurring)
                            put("recurrenceFrequency", t.recurrenceFrequency)
                            put("installmentGroupId", t.installmentGroupId)
                            put("installmentNumber", t.installmentNumber)
                            put("installmentTotal", t.installmentTotal)
                            put("notes", t.notes)
                        })
                    }
                })

                put("budgets", JSONArray().apply {
                    snapshot.budgets.forEach { b ->
                        put(JSONObject().apply {
                            put("id", b.id)
                            put("userId", b.userId)
                            put("categoryId", b.categoryId)
                            put("month", b.month)
                            put("amount", b.amount)
                        })
                    }
                })

                put("goals", JSONArray().apply {
                    snapshot.goals.forEach { g ->
                        put(JSONObject().apply {
                            put("id", g.id)
                            put("userId", g.userId)
                            put("name", g.name)
                            put("targetAmount", g.targetAmount)
                            put("currentAmount", g.currentAmount)
                            put("deadline", g.deadline)
                            put("color", g.color)
                            put("status", g.status)
                        })
                    }
                })

                put("aiConversations", JSONArray().apply {
                    snapshot.aiConversations.forEach { c ->
                        put(JSONObject().apply {
                            put("id", c.id)
                            put("userId", c.userId)
                            put("title", c.title)
                            put("preview", c.preview)
                            put("messageCount", c.messageCount)
                            put("lastMessageAtMillis", c.lastMessageAtMillis)
                        })
                    }
                })

                put("aiMessagesByConv", JSONObject().apply {
                    snapshot.aiMessagesByConv.forEach { (convId, msgs) ->
                        put(convId, JSONArray().apply {
                            msgs.forEach { m ->
                                put(JSONObject().apply {
                                    put("id", m.id)
                                    put("userId", m.userId)
                                    put("conversationId", m.conversationId)
                                    put("role", m.role)
                                    put("text", m.text)
                                    put("actionsSummary", JSONArray(m.actionsSummary))
                                    put("modelProfileId", m.modelProfileId)
                                    put("hasImage", m.hasImage)
                                    put("createdAtMillis", m.createdAtMillis)
                                })
                            }
                        })
                    }
                })
            }

            tempFile.writeText(root.toString(), Charsets.UTF_8)
            if (vaultFile.exists()) {
                vaultFile.delete()
            }
            if (!tempFile.renameTo(vaultFile)) {
                vaultFile.writeText(root.toString(), Charsets.UTF_8)
                tempFile.delete()
            }
        }
    }
}
