package com.verticefinance.app.data

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.verticefinance.app.R
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import kotlin.math.abs
import kotlin.math.roundToLong

class FinanceRepository(context: Context) {

    val auth: FirebaseAuth
    val db: FirebaseFirestore

    init {
        val app = if (FirebaseApp.getApps(context).isEmpty()) {
            val options = FirebaseOptions.Builder()
                .setProjectId(context.getString(R.string.firebase_project_id))
                .setApplicationId(context.getString(R.string.firebase_app_id))
                .setApiKey(context.getString(R.string.firebase_api_key))
                .setStorageBucket(context.getString(R.string.firebase_storage_bucket))
                .setGcmSenderId(context.getString(R.string.firebase_messaging_sender_id))
                .build()
            FirebaseApp.initializeApp(context, options)
        } else {
            FirebaseApp.getInstance()
        }
        auth = FirebaseAuth.getInstance(app)
        val databaseId = context.getString(R.string.firebase_database_id)
        db = FirebaseFirestore.getInstance(app, databaseId)
    }

    suspend fun ensureWorkspaceInitialized(user: FirebaseUser) {
        val uid = user.uid
        val userRef = db.collection("users").document(uid)
        val snap = userRef.get().await()
        if (!snap.exists()) {
            val batch = db.batch()
            val now = FieldValue.serverTimestamp()

            batch.set(
                userRef,
                mapOf(
                    "userId" to uid,
                    "currency" to "BRL",
                    "theme" to "light",
                    "seededSample" to false,
                    "createdAt" to now,
                    "updatedAt" to now
                )
            )

            val displayName = (user.displayName ?: user.email?.substringBefore("@") ?: "Usuário")
                .take(120)
            batch.set(
                userRef.collection("private").document("profile"),
                mapOf(
                    "userId" to uid,
                    "email" to (user.email ?: "usuario@local").take(254),
                    "displayName" to displayName,
                    "photoURL" to (user.photoUrl?.toString() ?: "").take(500),
                    "createdAt" to now,
                    "updatedAt" to now
                )
            )

            val defaults = listOf(
                Triple("cat_salario", "Salário", "income" to "#16A34A"),
                Triple("cat_freelance", "Freelance & Extras", "income" to "#0D9488"),
                Triple("cat_moradia", "Moradia & Contas", "expense" to "#475569"),
                Triple("cat_alimentacao", "Alimentação", "expense" to "#EA580C"),
                Triple("cat_transporte", "Transporte", "expense" to "#2563EB"),
                Triple("cat_saude", "Saúde", "expense" to "#DC2626"),
                Triple("cat_lazer", "Lazer & Viagens", "expense" to "#D97706")
            )
            for ((id, name, pair) in defaults) {
                batch.set(
                    userRef.collection("categories").document(id),
                    mapOf(
                        "userId" to uid,
                        "name" to name,
                        "type" to pair.first,
                        "icon" to "Tag",
                        "color" to pair.second,
                        "createdAt" to now,
                        "updatedAt" to now
                    )
                )
            }
            batch.commit().await()
        }
    }

    fun observeCurrency(uid: String): Flow<String> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .addSnapshotListener { snap, err ->
                if (err != null) return@addSnapshotListener
                val currency = snap?.getString("currency") ?: "BRL"
                trySend(currency)
            }
        awaitClose { reg.remove() }
    }

    fun observeTheme(uid: String): Flow<String> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .addSnapshotListener { snap, err ->
                if (err != null) return@addSnapshotListener
                val theme = snap?.getString("theme") ?: "light"
                trySend(theme)
            }
        awaitClose { reg.remove() }
    }

    suspend fun updateCurrency(uid: String, currency: String) {
        val safe = if (currency in listOf("BRL", "USD", "EUR")) currency else "BRL"
        db.collection("users").document(uid)
            .update(mapOf("currency" to safe, "updatedAt" to FieldValue.serverTimestamp()))
            .await()
    }

    suspend fun updateTheme(uid: String, theme: String) {
        val safe = if (theme == "dark") "dark" else "light"
        db.collection("users").document(uid)
            .update(mapOf("theme" to safe, "updatedAt" to FieldValue.serverTimestamp()))
            .await()
    }

    fun observeAccounts(uid: String): Flow<List<AccountDoc>> = callbackFlow {
        val reg: ListenerRegistration = db.collection("users").document(uid)
            .collection("accounts")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    AccountDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        name = d.getString("name") ?: "",
                        type = d.getString("type") ?: "checking",
                        institution = d.getString("institution") ?: "",
                        balance = d.getDouble("balance") ?: 0.0,
                        creditLimit = d.getDouble("creditLimit") ?: 0.0,
                        closingDay = (d.getLong("closingDay") ?: 0L).toInt(),
                        dueDay = (d.getLong("dueDay") ?: 0L).toInt(),
                        color = d.getString("color") ?: "#0F766E",
                        archived = d.getBoolean("archived") ?: false
                    )
                }.sortedBy { it.name }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun observeCategories(uid: String): Flow<List<CategoryDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("categories")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    CategoryDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        name = d.getString("name") ?: "",
                        type = d.getString("type") ?: "expense",
                        icon = d.getString("icon") ?: "Tag",
                        color = d.getString("color") ?: "#0F766E"
                    )
                }.sortedBy { it.name }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun observeTransactions(uid: String): Flow<List<TransactionDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("transactions")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    TransactionDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        type = d.getString("type") ?: "expense",
                        amount = d.getDouble("amount") ?: 0.0,
                        description = d.getString("description") ?: "",
                        categoryId = d.getString("categoryId") ?: "",
                        accountId = d.getString("accountId") ?: "",
                        toAccountId = d.getString("toAccountId") ?: "",
                        date = d.getString("date") ?: "",
                        status = d.getString("status") ?: "paid",
                        isRecurring = d.getBoolean("isRecurring") ?: false,
                        recurrenceFrequency = d.getString("recurrenceFrequency") ?: "none",
                        installmentGroupId = d.getString("installmentGroupId") ?: "",
                        installmentNumber = (d.getLong("installmentNumber") ?: 0L).toInt(),
                        installmentTotal = (d.getLong("installmentTotal") ?: 0L).toInt(),
                        notes = d.getString("notes") ?: ""
                    )
                }.sortedWith(compareByDescending<TransactionDoc> { it.date }.thenByDescending { it.id })
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun observeBudgets(uid: String): Flow<List<BudgetDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("budgets")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    BudgetDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        categoryId = d.getString("categoryId") ?: "",
                        month = d.getString("month") ?: "",
                        amount = d.getDouble("amount") ?: 0.0
                    )
                }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun observeGoals(uid: String): Flow<List<GoalDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("goals")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    GoalDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        name = d.getString("name") ?: "",
                        targetAmount = d.getDouble("targetAmount") ?: 0.0,
                        currentAmount = d.getDouble("currentAmount") ?: 0.0,
                        deadline = d.getString("deadline") ?: "",
                        color = d.getString("color") ?: "#0F766E",
                        status = d.getString("status") ?: "active"
                    )
                }.sortedBy { it.deadline }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    suspend fun createTransaction(
        uid: String,
        accounts: List<AccountDoc>,
        type: String,
        amount: Double,
        description: String,
        categoryId: String,
        accountId: String,
        toAccountId: String,
        date: String,
        status: String,
        installments: Int,
        notes: String
    ) {
        val batch = db.batch()
        val now = FieldValue.serverTimestamp()
        val userRef = db.collection("users").document(uid)
        val deltas = mutableMapOf<String, Double>()
        val total = installments.coerceIn(1, 48)
        val groupId = if (total > 1) Formatters.safeId("grp") else ""
        val roundedAmount = (amount * 100.0).roundToLong() / 100.0

        for (i in 0 until total) {
            val txId = Formatters.safeId("tx")
            val txDate = if (i == 0) date else Formatters.addMonthsToIso(date, i.toLong())
            val txStatus = if (i == 0) status else "pending"
            val effectiveCat = if (type == "transfer") "transfer" else categoryId
            val effectiveTo = if (type == "transfer") toAccountId else ""

            batch.set(
                userRef.collection("transactions").document(txId),
                mapOf(
                    "userId" to uid,
                    "type" to type,
                    "amount" to roundedAmount,
                    "description" to description.trim().take(140),
                    "categoryId" to effectiveCat,
                    "accountId" to accountId,
                    "toAccountId" to effectiveTo,
                    "date" to txDate,
                    "status" to txStatus,
                    "isRecurring" to false,
                    "recurrenceFrequency" to "none",
                    "installmentGroupId" to groupId,
                    "installmentNumber" to if (total > 1) i + 1 else 0,
                    "installmentTotal" to if (total > 1) total else 0,
                    "notes" to notes.trim().take(500),
                    "createdAt" to now,
                    "updatedAt" to now
                )
            )

            if (txStatus == "paid") {
                when (type) {
                    "income" -> deltas[accountId] = (deltas[accountId] ?: 0.0) + roundedAmount
                    "expense" -> deltas[accountId] = (deltas[accountId] ?: 0.0) - roundedAmount
                    "transfer" -> if (effectiveTo.isNotEmpty()) {
                        deltas[accountId] = (deltas[accountId] ?: 0.0) - roundedAmount
                        deltas[effectiveTo] = (deltas[effectiveTo] ?: 0.0) + roundedAmount
                    }
                }
            }
        }

        val accMap = accounts.associateBy { it.id }
        for ((accId, delta) in deltas) {
            if (abs(delta) < 0.0001) continue
            val acc = accMap[accId] ?: continue
            val nextBal = ((acc.balance + delta) * 100.0).roundToLong() / 100.0
            batch.update(
                userRef.collection("accounts").document(accId),
                mapOf("balance" to nextBal, "updatedAt" to now)
            )
        }

        batch.commit().await()
    }

    suspend fun toggleTransactionStatus(
        uid: String,
        tx: TransactionDoc,
        accounts: List<AccountDoc>
    ) {
        val nextStatus = if (tx.status == "paid") "pending" else "paid"
        val direction = if (nextStatus == "paid") 1.0 else -1.0
        val batch = db.batch()
        val now = FieldValue.serverTimestamp()
        val userRef = db.collection("users").document(uid)

        batch.update(
            userRef.collection("transactions").document(tx.id),
            mapOf("status" to nextStatus, "updatedAt" to now)
        )

        val deltas = mutableMapOf<String, Double>()
        when (tx.type) {
            "income" -> deltas[tx.accountId] = tx.amount * direction
            "expense" -> deltas[tx.accountId] = -tx.amount * direction
            "transfer" -> if (tx.toAccountId.isNotEmpty()) {
                deltas[tx.accountId] = -tx.amount * direction
                deltas[tx.toAccountId] = tx.amount * direction
            }
        }

        val accMap = accounts.associateBy { it.id }
        for ((accId, delta) in deltas) {
            val acc = accMap[accId] ?: continue
            val nextBal = ((acc.balance + delta) * 100.0).roundToLong() / 100.0
            batch.update(
                userRef.collection("accounts").document(accId),
                mapOf("balance" to nextBal, "updatedAt" to now)
            )
        }

        batch.commit().await()
    }

    suspend fun deleteTransaction(uid: String, tx: TransactionDoc, accounts: List<AccountDoc>) {
        val batch = db.batch()
        val now = FieldValue.serverTimestamp()
        val userRef = db.collection("users").document(uid)

        batch.delete(userRef.collection("transactions").document(tx.id))

        if (tx.status == "paid") {
            val accMap = accounts.associateBy { it.id }
            val deltas = mutableMapOf<String, Double>()
            when (tx.type) {
                "income" -> deltas[tx.accountId] = -tx.amount
                "expense" -> deltas[tx.accountId] = tx.amount
                "transfer" -> if (tx.toAccountId.isNotEmpty()) {
                    deltas[tx.accountId] = tx.amount
                    deltas[tx.toAccountId] = -tx.amount
                }
            }
            for ((accId, delta) in deltas) {
                val acc = accMap[accId] ?: continue
                val nextBal = ((acc.balance + delta) * 100.0).roundToLong() / 100.0
                batch.update(
                    userRef.collection("accounts").document(accId),
                    mapOf("balance" to nextBal, "updatedAt" to now)
                )
            }
        }

        batch.commit().await()
    }

    suspend fun createAccount(
        uid: String,
        name: String,
        type: String,
        institution: String,
        balance: Double,
        creditLimit: Double,
        closingDay: Int,
        dueDay: Int
    ) {
        val id = Formatters.safeId("acc")
        val now = FieldValue.serverTimestamp()
        val normalizedBal = if (type == "credit") -abs(balance) else balance
        db.collection("users").document(uid)
            .collection("accounts").document(id)
            .set(
                mapOf(
                    "userId" to uid,
                    "name" to name.trim().take(80),
                    "type" to type,
                    "institution" to institution.trim().take(80),
                    "balance" to ((normalizedBal * 100.0).roundToLong() / 100.0),
                    "creditLimit" to if (type == "credit") creditLimit.coerceAtLeast(0.0) else 0.0,
                    "closingDay" to if (type == "credit") closingDay.coerceIn(1, 31) else 0,
                    "dueDay" to if (type == "credit") dueDay.coerceIn(1, 31) else 0,
                    "color" to if (type == "credit") "#1E293B" else "#0F766E",
                    "archived" to false,
                    "createdAt" to now,
                    "updatedAt" to now
                )
            ).await()
    }

    suspend fun contributeToGoal(
        uid: String,
        goal: GoalDoc,
        amount: Double
    ) {
        val nextAmount = ((goal.currentAmount + amount) * 100.0).roundToLong() / 100.0
        val nextStatus = if (nextAmount >= goal.targetAmount) "completed" else "active"
        db.collection("users").document(uid)
            .collection("goals").document(goal.id)
            .update(
                mapOf(
                    "currentAmount" to nextAmount,
                    "status" to nextStatus,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
    }

    suspend fun upsertBudget(uid: String, categoryId: String, month: String, amount: Double) {
        val id = "bud_${month}_${categoryId}".replace(Regex("[^a-zA-Z0-9_-]"), "").take(120)
        val ref = db.collection("users").document(uid).collection("budgets").document(id)
        val snap = ref.get().await()
        val rounded = (amount * 100.0).roundToLong() / 100.0
        val now = FieldValue.serverTimestamp()
        if (snap.exists()) {
            ref.update(mapOf("amount" to rounded, "updatedAt" to now)).await()
        } else {
            ref.set(
                mapOf(
                    "userId" to uid,
                    "categoryId" to categoryId,
                    "month" to month,
                    "amount" to rounded,
                    "createdAt" to now,
                    "updatedAt" to now
                )
            ).await()
        }
    }

    suspend fun createGoal(
        uid: String,
        name: String,
        targetAmount: Double,
        currentAmount: Double,
        deadline: String
    ) {
        val id = Formatters.safeId("goal")
        val now = FieldValue.serverTimestamp()
        val status = if (currentAmount >= targetAmount) "completed" else "active"
        db.collection("users").document(uid)
            .collection("goals").document(id)
            .set(
                mapOf(
                    "userId" to uid,
                    "name" to name.trim().take(80),
                    "targetAmount" to ((targetAmount * 100.0).roundToLong() / 100.0),
                    "currentAmount" to ((currentAmount * 100.0).roundToLong() / 100.0),
                    "deadline" to deadline,
                    "color" to "#0F766E",
                    "status" to status,
                    "createdAt" to now,
                    "updatedAt" to now
                )
            ).await()
    }

    fun observeAIConversations(uid: String): Flow<List<AIConversationDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("aiConversations")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    AIConversationDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        title = d.getString("title") ?: "Nova conversa",
                        preview = d.getString("preview") ?: "",
                        messageCount = (d.getLong("messageCount") ?: 0L).toInt(),
                        lastMessageAtMillis = d.getTimestamp("lastMessageAt")?.toDate()?.time ?: 0L
                    )
                }.sortedByDescending { it.lastMessageAtMillis }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun observeAIMessages(uid: String, conversationId: String): Flow<List<AIMessageDoc>> = callbackFlow {
        val reg = db.collection("users").document(uid)
            .collection("aiConversations").document(conversationId)
            .collection("messages")
            .whereEqualTo("userId", uid)
            .addSnapshotListener { snap, err ->
                if (err != null || snap == null) return@addSnapshotListener
                val list = snap.documents.map { d ->
                    val rawActions = d.get("actionsSummary") as? List<*> ?: emptyList<Any>()
                    AIMessageDoc(
                        id = d.id,
                        userId = d.getString("userId") ?: uid,
                        conversationId = d.getString("conversationId") ?: conversationId,
                        role = d.getString("role") ?: "user",
                        text = d.getString("text") ?: "",
                        actionsSummary = rawActions.mapNotNull { it as? String },
                        modelProfileId = d.getString("modelProfileId") ?: "",
                        hasImage = d.getBoolean("hasImage") ?: false,
                        createdAtMillis = d.getTimestamp("createdAt")?.toDate()?.time ?: 0L
                    )
                }.sortedWith(compareBy<AIMessageDoc> { it.createdAtMillis }.thenBy { it.id })
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    suspend fun createAIConversation(uid: String, title: String): String {
        val convId = Formatters.safeId("conv")
        val now = FieldValue.serverTimestamp()
        db.collection("users").document(uid)
            .collection("aiConversations").document(convId)
            .set(
                mapOf(
                    "userId" to uid,
                    "title" to title.trim().ifBlank { "Nova conversa" }.take(120),
                    "preview" to "",
                    "messageCount" to 0,
                    "lastMessageAt" to now,
                    "createdAt" to now,
                    "updatedAt" to now
                )
            ).await()
        return convId
    }

    suspend fun appendAIMessage(
        uid: String,
        conversationId: String,
        role: String,
        text: String,
        actionsSummary: List<String>,
        modelProfileId: String,
        nextMessageCount: Int,
        autoTitle: String? = null
    ) {
        val msgId = Formatters.safeId("msg")
        val now = FieldValue.serverTimestamp()
        val convRef = db.collection("users").document(uid)
            .collection("aiConversations").document(conversationId)
        val msgRef = convRef.collection("messages").document(msgId)
        val safeText = text.trim().ifBlank { "..." }.take(12000)
        val safePreview = safeText.replace("\n", " ").take(200)
        val batch = db.batch()
        batch.set(
            msgRef,
            mapOf(
                "userId" to uid,
                "conversationId" to conversationId,
                "role" to role,
                "text" to safeText,
                "actionsSummary" to actionsSummary.take(25).map { it.take(240) },
                "modelProfileId" to modelProfileId.take(40),
                "hasImage" to false,
                "createdAt" to now
            )
        )
        val convUpdate = mutableMapOf<String, Any>(
            "preview" to safePreview,
            "messageCount" to nextMessageCount,
            "lastMessageAt" to now,
            "updatedAt" to now
        )
        if (!autoTitle.isNullOrBlank()) {
            convUpdate["title"] = autoTitle.trim().take(120)
        }
        batch.update(convRef, convUpdate)
        batch.commit().await()
    }

    suspend fun deleteAIConversation(uid: String, conversationId: String) {
        val convRef = db.collection("users").document(uid)
            .collection("aiConversations").document(conversationId)
        val msgs = convRef.collection("messages").whereEqualTo("userId", uid).get().await()
        val batch = db.batch()
        for (doc in msgs.documents) {
            batch.delete(doc.reference)
        }
        batch.delete(convRef)
        batch.commit().await()
    }
}
