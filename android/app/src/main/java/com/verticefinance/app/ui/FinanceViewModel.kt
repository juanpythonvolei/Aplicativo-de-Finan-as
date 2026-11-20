package com.verticefinance.app.ui

import android.app.Application
import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.verticefinance.app.R
import com.verticefinance.app.data.AIConversationDoc
import com.verticefinance.app.data.AIMessageDoc
import com.verticefinance.app.data.AccountDoc
import com.verticefinance.app.data.AssistantApiCall
import com.verticefinance.app.data.AssistantClient
import com.verticefinance.app.data.BudgetDoc
import com.verticefinance.app.data.CategoryDoc
import com.verticefinance.app.data.FinanceRepository
import com.verticefinance.app.data.Formatters
import com.verticefinance.app.data.GoalDoc
import com.verticefinance.app.data.TransactionDoc
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject

data class FinanceUiState(
    val user: FirebaseUser? = null,
    val loading: Boolean = true,
    val currency: String = "BRL",
    val theme: String = "light",
    val selectedMonth: String = Formatters.currentMonthKey(),
    val accounts: List<AccountDoc> = emptyList(),
    val categories: List<CategoryDoc> = emptyList(),
    val transactions: List<TransactionDoc> = emptyList(),
    val budgets: List<BudgetDoc> = emptyList(),
    val goals: List<GoalDoc> = emptyList(),
    val aiConversations: List<AIConversationDoc> = emptyList(),
    val activeConversationId: String? = null,
    val activeMessages: List<AIMessageDoc> = emptyList(),
    val aiSending: Boolean = false,
    val requestedTab: Int? = null,
    val message: String? = null
)

class FinanceViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = FinanceRepository(application)
    private val assistantClient = AssistantClient(application.getString(R.string.api_base_url))
    private val _uiState = MutableStateFlow(FinanceUiState())
    val uiState: StateFlow<FinanceUiState> = _uiState.asStateFlow()

    private var listenerJobs = mutableListOf<Job>()
    private var messagesJob: Job? = null

    init {
        val current = repo.auth.currentUser
        if (current != null) {
            onAuthenticated(current)
        } else {
            _uiState.update { it.copy(loading = false) }
        }
    }

    fun signInWithGoogle(activityContext: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            try {
                val credentialManager = CredentialManager.create(activityContext)
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(activityContext.getString(R.string.default_web_client_id))
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                val result = credentialManager.getCredential(activityContext, request)
                val googleCred = GoogleIdTokenCredential.createFrom(result.credential.data)
                val firebaseCred = GoogleAuthProvider.getCredential(googleCred.idToken, null)
                val authResult = repo.auth.signInWithCredential(firebaseCred).await()
                val firebaseUser = authResult.user
                if (firebaseUser != null) {
                    onAuthenticated(firebaseUser)
                } else {
                    _uiState.update { it.copy(loading = false, message = "Falha ao autenticar.") }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        message = e.localizedMessage ?: "Erro no login com Google."
                    )
                }
            }
        }
    }

    private fun onAuthenticated(user: FirebaseUser) {
        viewModelScope.launch {
            try {
                repo.ensureWorkspaceInitialized(user)
                _uiState.update { it.copy(user = user, loading = false) }
                attachRealtimeListeners(user.uid)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        user = user,
                        loading = false,
                        message = e.localizedMessage ?: "Erro ao conectar ao Firestore."
                    )
                }
            }
        }
    }

    private fun attachRealtimeListeners(uid: String) {
        listenerJobs.forEach { it.cancel() }
        listenerJobs.clear()
        messagesJob?.cancel()

        listenerJobs += viewModelScope.launch {
            repo.observeCurrency(uid).collect { c -> _uiState.update { it.copy(currency = c) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeTheme(uid).collect { t -> _uiState.update { it.copy(theme = t) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeAccounts(uid).collect { list -> _uiState.update { it.copy(accounts = list) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeCategories(uid).collect { list -> _uiState.update { it.copy(categories = list) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeTransactions(uid).collect { list -> _uiState.update { it.copy(transactions = list) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeBudgets(uid).collect { list -> _uiState.update { it.copy(budgets = list) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeGoals(uid).collect { list -> _uiState.update { it.copy(goals = list) } }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeAIConversations(uid).collect { list ->
                val currentId = _uiState.value.activeConversationId
                val nextId = if (currentId != null && list.any { it.id == currentId }) {
                    currentId
                } else {
                    list.firstOrNull()?.id
                }
                _uiState.update { it.copy(aiConversations = list, activeConversationId = nextId) }
                observeMessagesFor(uid, nextId)
            }
        }
    }

    private fun observeMessagesFor(uid: String, conversationId: String?) {
        messagesJob?.cancel()
        if (conversationId == null) {
            _uiState.update { it.copy(activeMessages = emptyList()) }
            return
        }
        messagesJob = viewModelScope.launch {
            repo.observeAIMessages(uid, conversationId).collect { msgs ->
                _uiState.update { it.copy(activeMessages = msgs) }
            }
        }
    }

    fun selectConversation(conversationId: String) {
        val uid = _uiState.value.user?.uid ?: return
        _uiState.update { it.copy(activeConversationId = conversationId) }
        observeMessagesFor(uid, conversationId)
    }

    fun startNewConversation() {
        messagesJob?.cancel()
        _uiState.update { it.copy(activeConversationId = null, activeMessages = emptyList()) }
    }

    fun deleteConversation(conversationId: String) {
        val uid = _uiState.value.user?.uid ?: return
        viewModelScope.launch {
            try {
                repo.deleteAIConversation(uid, conversationId)
                if (_uiState.value.activeConversationId == conversationId) {
                    startNewConversation()
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao excluir conversa.") }
            }
        }
    }

    fun setCurrency(currency: String) {
        val uid = _uiState.value.user?.uid ?: return
        viewModelScope.launch {
            try {
                repo.updateCurrency(uid, currency)
                _uiState.update { it.copy(message = "Moeda alterada para $currency.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao alterar moeda.") }
            }
        }
    }

    fun setTheme(theme: String) {
        val uid = _uiState.value.user?.uid ?: return
        viewModelScope.launch {
            try {
                repo.updateTheme(uid, theme)
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao alterar tema.") }
            }
        }
    }

    fun consumeRequestedTab() {
        _uiState.update { it.copy(requestedTab = null) }
    }

    private fun buildCompactSnapshot(state: FinanceUiState): String {
        val activeAccs = state.accounts.filter { !it.archived }
        val consolidated = activeAccs.sumOf { it.balance }
        val monthTxs = state.transactions.filter { it.date.startsWith(state.selectedMonth) }
        val income = monthTxs.filter { it.type == "income" }.sumOf { it.amount }
        val expense = monthTxs.filter { it.type == "expense" }.sumOf { it.amount }

        val root = JSONObject().apply {
            put("today", Formatters.todayIso())
            put("selectedMonth", state.selectedMonth)
            put("currency", state.currency)
            put("theme", state.theme)
            put("platform", "android-native")
            put("totals", JSONObject().apply {
                put("consolidatedBalance", consolidated)
                put("monthIncome", income)
                put("monthExpense", expense)
                put("transactionsCount", state.transactions.size)
            })
            put("accounts", JSONArray().apply {
                state.accounts.forEach { a ->
                    put(JSONObject().apply {
                        put("id", a.id)
                        put("name", a.name)
                        put("type", a.type)
                        put("balance", a.balance)
                    })
                }
            })
            put("categories", JSONArray().apply {
                state.categories.forEach { c ->
                    put(JSONObject().apply {
                        put("id", c.id)
                        put("name", c.name)
                        put("type", c.type)
                    })
                }
            })
            put("goals", JSONArray().apply {
                state.goals.forEach { g ->
                    put(JSONObject().apply {
                        put("id", g.id)
                        put("name", g.name)
                        put("currentAmount", g.currentAmount)
                        put("targetAmount", g.targetAmount)
                        put("deadline", g.deadline)
                        put("status", g.status)
                    })
                }
            })
            put("recentTransactions", JSONArray().apply {
                state.transactions.take(15).forEach { tx ->
                    put(JSONObject().apply {
                        put("id", tx.id)
                        put("date", tx.date)
                        put("type", tx.type)
                        put("amount", tx.amount)
                        put("description", tx.description)
                        put("status", tx.status)
                    })
                }
            })
        }
        return root.toString()
    }

    private suspend fun executeAndroidTool(
        uid: String,
        call: AssistantApiCall,
        actionsSummary: MutableList<String>
    ): JSONObject {
        val state = _uiState.value
        val args = call.args
        return when (call.name) {
            "create_transaction" -> {
                val type = args.optString("type", "expense")
                val amount = args.optDouble("amount", 0.0)
                val desc = args.optString("description", "").trim()
                if (desc.isEmpty() || amount <= 0.0) {
                    return JSONObject().put("ok", false).put("error", "Descrição e valor são obrigatórios.")
                }
                val accKey = args.optString("accountId", "")
                val account = state.accounts.firstOrNull {
                    it.id == accKey || it.name.equals(accKey, ignoreCase = true)
                } ?: state.accounts.firstOrNull { !it.archived }
                    ?: return JSONObject().put("ok", false).put("error", "Crie uma conta primeiro.")
                val catKey = args.optString("categoryId", "")
                val cat = state.categories.firstOrNull {
                    it.id == catKey || it.name.equals(catKey, ignoreCase = true)
                } ?: state.categories.firstOrNull { it.type == if (type == "income") "income" else "expense" }
                val date = args.optString("date", Formatters.todayIso()).ifBlank { Formatters.todayIso() }
                val status = if (args.optString("status") == "pending") "pending" else "paid"
                val installments = args.optInt("installments", 1).coerceIn(1, 48)
                repo.createTransaction(
                    uid, state.accounts, type, amount, desc,
                    cat?.id ?: "cat_alimentacao", account.id, "", date, status, installments,
                    args.optString("notes", "")
                )
                actionsSummary += "Lançamento criado: $desc (${Formatters.currency(amount, state.currency)})"
                JSONObject().put("ok", true).put("description", desc).put("amount", amount)
            }
            "delete_transaction" -> {
                val txId = args.optString("transactionId", "")
                val tx = state.transactions.firstOrNull { it.id == txId }
                    ?: return JSONObject().put("ok", false).put("error", "Lançamento não encontrado.")
                repo.deleteTransaction(uid, tx, state.accounts)
                actionsSummary += "Lançamento excluído: ${tx.description}"
                JSONObject().put("ok", true).put("deletedId", tx.id)
            }
            "toggle_transaction_status" -> {
                val txId = args.optString("transactionId", "")
                val tx = state.transactions.firstOrNull { it.id == txId }
                    ?: return JSONObject().put("ok", false).put("error", "Lançamento não encontrado.")
                repo.toggleTransactionStatus(uid, tx, state.accounts)
                actionsSummary += "Status alternado: ${tx.description}"
                JSONObject().put("ok", true)
            }
            "create_account" -> {
                val name = args.optString("name", "").trim()
                val type = args.optString("type", "checking")
                if (name.isEmpty()) return JSONObject().put("ok", false).put("error", "Nome obrigatório.")
                repo.createAccount(
                    uid, name, type, args.optString("institution", "Banco"),
                    args.optDouble("balance", 0.0), args.optDouble("creditLimit", 0.0),
                    args.optInt("closingDay", 3), args.optInt("dueDay", 10)
                )
                actionsSummary += "Conta criada: $name"
                JSONObject().put("ok", true).put("name", name)
            }
            "upsert_budget" -> {
                val catKey = args.optString("categoryId", "")
                val cat = state.categories.firstOrNull {
                    it.id == catKey || it.name.equals(catKey, ignoreCase = true)
                } ?: return JSONObject().put("ok", false).put("error", "Categoria não encontrada.")
                val month = args.optString("month", state.selectedMonth).ifBlank { state.selectedMonth }
                val amount = args.optDouble("amount", 0.0)
                if (amount <= 0.0) return JSONObject().put("ok", false).put("error", "Valor inválido.")
                repo.upsertBudget(uid, cat.id, month, amount)
                actionsSummary += "Orçamento salvo: ${cat.name} (${Formatters.currency(amount, state.currency)})"
                JSONObject().put("ok", true)
            }
            "create_goal" -> {
                val name = args.optString("name", "").trim()
                val target = args.optDouble("targetAmount", 0.0)
                val deadline = args.optString("deadline", Formatters.todayIso())
                if (name.isEmpty() || target <= 0.0) {
                    return JSONObject().put("ok", false).put("error", "Nome e valor alvo obrigatórios.")
                }
                repo.createGoal(uid, name, target, args.optDouble("currentAmount", 0.0), deadline)
                actionsSummary += "Meta criada: $name"
                JSONObject().put("ok", true)
            }
            "contribute_to_goal" -> {
                val key = args.optString("goalId", "")
                val goal = state.goals.firstOrNull { it.id == key || it.name.equals(key, ignoreCase = true) }
                    ?: return JSONObject().put("ok", false).put("error", "Meta não encontrada.")
                val amount = args.optDouble("amount", 0.0)
                if (amount <= 0.0) return JSONObject().put("ok", false).put("error", "Valor inválido.")
                repo.contributeToGoal(uid, goal, amount)
                actionsSummary += "Aporte em ${goal.name}: ${Formatters.currency(amount, state.currency)}"
                JSONObject().put("ok", true)
            }
            "set_currency" -> {
                val code = args.optString("currency", "BRL").uppercase()
                repo.updateCurrency(uid, code)
                actionsSummary += "Moeda alterada para $code"
                JSONObject().put("ok", true).put("currency", code)
            }
            "toggle_theme" -> {
                val target = args.optString("targetTheme", "").ifBlank {
                    if (state.theme == "dark") "light" else "dark"
                }
                repo.updateTheme(uid, target)
                actionsSummary += "Tema alterado para ${if (target == "dark") "Escuro" else "Claro"}"
                JSONObject().put("ok", true).put("theme", target)
            }
            "set_selected_month" -> {
                val month = args.optString("month", "")
                if (Regex("^\\d{4}-\\d{2}$").matches(month)) {
                    _uiState.update { it.copy(selectedMonth = month) }
                    actionsSummary += "Período alterado para $month"
                    JSONObject().put("ok", true)
                } else {
                    JSONObject().put("ok", false).put("error", "Formato de mês inválido.")
                }
            }
            "navigate_to_tab" -> {
                val tab = args.optString("tab", "")
                val idx = when (tab) {
                    "assistant" -> 0
                    "dashboard" -> 1
                    "transactions" -> 2
                    "accounts" -> 3
                    "budgets", "goals" -> 4
                    else -> null
                }
                if (idx != null) {
                    _uiState.update { it.copy(requestedTab = idx) }
                    actionsSummary += "Navegação para $tab"
                    JSONObject().put("ok", true)
                } else {
                    JSONObject().put("ok", true).put("note", "Módulo disponível na versão completa.")
                }
            }
            else -> JSONObject().put("ok", true).put("snapshotUsed", true)
        }
    }

    fun sendAIMessage(prompt: String) {
        val trimmed = prompt.trim()
        val user = _uiState.value.user ?: return
        if (trimmed.isEmpty() || _uiState.value.aiSending) return

        viewModelScope.launch {
            _uiState.update { it.copy(aiSending = true) }
            try {
                val existingConvId = _uiState.value.activeConversationId
                val isFirst = existingConvId == null || _uiState.value.activeMessages.isEmpty()
                val autoTitle = trimmed.replace("\n", " ").take(64)
                val convId = existingConvId ?: repo.createAIConversation(user.uid, autoTitle).also { newId ->
                    _uiState.update { it.copy(activeConversationId = newId) }
                    observeMessagesFor(user.uid, newId)
                }

                val prevMessages = _uiState.value.activeMessages
                val countAfterUser = prevMessages.size + 1
                repo.appendAIMessage(
                    uid = user.uid,
                    conversationId = convId,
                    role = "user",
                    text = trimmed,
                    actionsSummary = emptyList(),
                    modelProfileId = "",
                    nextMessageCount = countAfterUser,
                    autoTitle = if (isFirst) autoTitle else null
                )

                val contents = JSONArray()
                prevMessages.takeLast(12).forEach { msg ->
                    contents.put(JSONObject().apply {
                        put("role", if (msg.role == "user") "user" else "model")
                        put("parts", JSONArray().put(JSONObject().put("text", msg.text)))
                    })
                }
                contents.put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().put(JSONObject().put("text", trimmed)))
                })

                val idToken = user.getIdToken(false).await().token ?: ""
                val actionsSummary = mutableListOf<String>()
                var finalText = ""
                var profileId = "economic_smart"

                for (step in 0 until 6) {
                    val snapshot = buildCompactSnapshot(_uiState.value)
                    val res = assistantClient.chat(idToken, contents, snapshot)
                    profileId = res.profileId
                    if (res.modelContent != null) {
                        contents.put(res.modelContent)
                    }
                    if (res.functionCalls.isEmpty()) {
                        finalText = res.text.ifBlank { "Concluído." }
                        break
                    }
                    val respParts = JSONArray()
                    for (call in res.functionCalls) {
                        val toolResult = executeAndroidTool(user.uid, call, actionsSummary)
                        respParts.put(JSONObject().apply {
                            put("functionResponse", JSONObject().apply {
                                put("id", call.id)
                                put("name", call.name)
                                put("response", toolResult)
                            })
                        })
                    }
                    contents.put(JSONObject().apply {
                        put("role", "user")
                        put("parts", respParts)
                    })
                    if (step == 5 && finalText.isBlank()) {
                        finalText = res.text.ifBlank { "Operações concluídas." }
                    }
                }

                repo.appendAIMessage(
                    uid = user.uid,
                    conversationId = convId,
                    role = "assistant",
                    text = finalText.ifBlank { "Pronto!" },
                    actionsSummary = actionsSummary,
                    modelProfileId = profileId,
                    nextMessageCount = countAfterUser + 1
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(message = e.localizedMessage ?: "Erro ao conversar com o Assistente IA.")
                }
            } finally {
                _uiState.update { it.copy(aiSending = false) }
            }
        }
    }

    fun shiftMonth(delta: Long) {
        _uiState.update {
            it.copy(selectedMonth = Formatters.shiftMonth(it.selectedMonth, delta))
        }
    }

    fun signOut() {
        listenerJobs.forEach { it.cancel() }
        listenerJobs.clear()
        messagesJob?.cancel()
        repo.auth.signOut()
        _uiState.value = FinanceUiState(loading = false)
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    fun createTransaction(
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
        val uid = _uiState.value.user?.uid ?: return
        val accounts = _uiState.value.accounts
        viewModelScope.launch {
            try {
                repo.createTransaction(
                    uid, accounts, type, amount, description, categoryId,
                    accountId, toAccountId, date, status, installments, notes
                )
                _uiState.update { it.copy(message = "Lançamento salvo com sucesso.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao salvar.") }
            }
        }
    }

    fun toggleTransactionStatus(tx: TransactionDoc) {
        val uid = _uiState.value.user?.uid ?: return
        val accounts = _uiState.value.accounts
        viewModelScope.launch {
            try {
                repo.toggleTransactionStatus(uid, tx, accounts)
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao atualizar.") }
            }
        }
    }

    fun deleteTransaction(tx: TransactionDoc) {
        val uid = _uiState.value.user?.uid ?: return
        val accounts = _uiState.value.accounts
        viewModelScope.launch {
            try {
                repo.deleteTransaction(uid, tx, accounts)
                _uiState.update { it.copy(message = "Lançamento removido.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao excluir.") }
            }
        }
    }

    fun createAccount(
        name: String,
        type: String,
        institution: String,
        balance: Double,
        creditLimit: Double,
        closingDay: Int,
        dueDay: Int
    ) {
        val uid = _uiState.value.user?.uid ?: return
        viewModelScope.launch {
            try {
                repo.createAccount(uid, name, type, institution, balance, creditLimit, closingDay, dueDay)
                _uiState.update { it.copy(message = "Conta cadastrada.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao criar conta.") }
            }
        }
    }

    fun contributeToGoal(goal: GoalDoc, amount: Double) {
        val uid = _uiState.value.user?.uid ?: return
        viewModelScope.launch {
            try {
                repo.contributeToGoal(uid, goal, amount)
                _uiState.update { it.copy(message = "Aporte registrado.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro no aporte.") }
            }
        }
    }
}
