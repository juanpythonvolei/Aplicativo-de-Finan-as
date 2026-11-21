package com.verticefinance.app.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.verticefinance.app.R
import com.verticefinance.app.data.AIConversationDoc
import com.verticefinance.app.data.AIMessageDoc
import com.verticefinance.app.data.AccountDoc
import com.verticefinance.app.data.ApiUsageSummary
import com.verticefinance.app.data.AssistantApiCall
import com.verticefinance.app.data.AssistantClient
import com.verticefinance.app.data.AssistantRoutingInfo
import com.verticefinance.app.data.BiometricAuthHelper
import com.verticefinance.app.data.BudgetDoc
import com.verticefinance.app.data.CategoryDoc
import com.verticefinance.app.data.FinanceRepository
import com.verticefinance.app.data.Formatters
import com.verticefinance.app.data.GoalDoc
import com.verticefinance.app.data.LocalFinanceStore
import com.verticefinance.app.data.LocalVaultSnapshot
import com.verticefinance.app.data.TransactionDoc
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLDecoder
import java.util.UUID
import kotlin.math.abs
import kotlin.math.roundToLong

data class FinanceUiState(
    val user: FirebaseUser? = null,
    val isLocalMode: Boolean = false,
    val biometricAvailable: Boolean = false,
    val biometricEnabled: Boolean = false,
    val biometricLocked: Boolean = false,
    val hasLocalVaultData: Boolean = false,
    val lastKnownEmail: String = "",
    val lastKnownName: String = "",
    val loading: Boolean = true,
    val syncing: Boolean = false,
    val lastSyncedAtMillis: Long = 0L,
    val hasPendingLocalSync: Boolean = false,
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
    val lastRouting: AssistantRoutingInfo? = null,
    val apiUsage: ApiUsageSummary? = null,
    val apiUsageLoading: Boolean = false,
    val requestedTab: Int? = null,
    val message: String? = null
)

class FinanceViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = FinanceRepository(application)
    private val localStore = LocalFinanceStore(application)
    private val apiBaseUrl = application.getString(R.string.api_base_url).trimEnd('/')
    private val assistantClient = AssistantClient(apiBaseUrl)
    private val _uiState = MutableStateFlow(FinanceUiState())
    val uiState: StateFlow<FinanceUiState> = _uiState.asStateFlow()

    private var listenerJobs = mutableListOf<Job>()
    private var messagesJob: Job? = null
    private var pendingAuthState: String? = null
    private var localMessagesByConv = mutableMapOf<String, List<AIMessageDoc>>()

    init {
        hydrateFromLocalVault()
    }

    private fun hydrateFromLocalVault() {
        viewModelScope.launch {
            val bioAvailable = BiometricAuthHelper.isBiometricAvailable(getApplication())
            val vault = withContext(Dispatchers.IO) { localStore.load() }
            localMessagesByConv = vault.aiMessagesByConv.toMutableMap()
            val hasVaultData = vault.accounts.isNotEmpty() || vault.transactions.isNotEmpty() || vault.localMode

            val current = repo.auth.currentUser
            if (current != null) {
                val shouldLock = vault.biometricEnabled && bioAvailable
                _uiState.update {
                    it.copy(
                        user = current,
                        isLocalMode = false,
                        biometricAvailable = bioAvailable,
                        biometricEnabled = vault.biometricEnabled,
                        biometricLocked = shouldLock,
                        hasLocalVaultData = hasVaultData,
                        lastKnownEmail = current.email ?: vault.lastUserEmail,
                        lastKnownName = current.displayName ?: vault.lastUserName,
                        currency = vault.currency,
                        theme = vault.theme,
                        lastSyncedAtMillis = vault.lastSyncedAtMillis,
                        hasPendingLocalSync = vault.hasUnsyncedLocalData,
                        accounts = vault.accounts,
                        categories = vault.categories,
                        transactions = vault.transactions,
                        budgets = vault.budgets,
                        goals = vault.goals,
                        aiConversations = vault.aiConversations,
                        activeConversationId = vault.aiConversations.firstOrNull()?.id,
                        activeMessages = vault.aiConversations.firstOrNull()?.id?.let { id ->
                            vault.aiMessagesByConv[id].orEmpty()
                        }.orEmpty(),
                        loading = false
                    )
                }
                onAuthenticated(current, vault, preserveBiometricLock = shouldLock)
            } else if (vault.localMode) {
                val categories = vault.categories.ifEmpty { localStore.defaultCategories("local") }
                val accounts = vault.accounts.ifEmpty { listOf(localStore.defaultLocalAccount("local")) }
                val shouldLock = vault.biometricEnabled && bioAvailable
                _uiState.update {
                    it.copy(
                        user = null,
                        isLocalMode = true,
                        biometricAvailable = bioAvailable,
                        biometricEnabled = vault.biometricEnabled,
                        biometricLocked = shouldLock,
                        hasLocalVaultData = true,
                        lastKnownEmail = vault.lastUserEmail,
                        lastKnownName = vault.lastUserName,
                        loading = false,
                        currency = vault.currency,
                        theme = vault.theme,
                        lastSyncedAtMillis = vault.lastSyncedAtMillis,
                        hasPendingLocalSync = vault.hasUnsyncedLocalData,
                        accounts = accounts,
                        categories = categories,
                        transactions = vault.transactions,
                        budgets = vault.budgets,
                        goals = vault.goals,
                        aiConversations = vault.aiConversations,
                        activeConversationId = vault.aiConversations.firstOrNull()?.id,
                        activeMessages = vault.aiConversations.firstOrNull()?.id?.let { id ->
                            vault.aiMessagesByConv[id].orEmpty()
                        }.orEmpty()
                    )
                }
                persistCurrentStateToLocal()
            } else {
                _uiState.update {
                    it.copy(
                        biometricAvailable = bioAvailable,
                        biometricEnabled = vault.biometricEnabled,
                        biometricLocked = false,
                        hasLocalVaultData = hasVaultData,
                        lastKnownEmail = vault.lastUserEmail,
                        lastKnownName = vault.lastUserName,
                        currency = vault.currency,
                        theme = vault.theme,
                        lastSyncedAtMillis = vault.lastSyncedAtMillis,
                        hasPendingLocalSync = vault.hasUnsyncedLocalData,
                        loading = false
                    )
                }
            }
        }
    }

    private fun buildVaultSnapshot(state: FinanceUiState): LocalVaultSnapshot {
        val convId = state.activeConversationId
        if (convId != null && state.activeMessages.isNotEmpty()) {
            localMessagesByConv[convId] = state.activeMessages
        }
        return LocalVaultSnapshot(
            currency = state.currency,
            theme = state.theme,
            localMode = state.isLocalMode,
            biometricEnabled = state.biometricEnabled,
            lastUserEmail = state.user?.email ?: state.lastKnownEmail,
            lastUserName = state.user?.displayName ?: state.lastKnownName,
            hasUnsyncedLocalData = state.hasPendingLocalSync,
            lastSyncedAtMillis = state.lastSyncedAtMillis,
            accounts = state.accounts,
            categories = state.categories,
            transactions = state.transactions,
            budgets = state.budgets,
            goals = state.goals,
            aiConversations = state.aiConversations,
            aiMessagesByConv = localMessagesByConv.toMap()
        )
    }

    private fun persistCurrentStateToLocal() {
        val snapshot = buildVaultSnapshot(_uiState.value)
        viewModelScope.launch(Dispatchers.IO) {
            localStore.save(snapshot)
        }
    }

    fun onBiometricUnlockSuccess() {
        val st = _uiState.value
        if (st.user != null || st.isLocalMode) {
            _uiState.update { it.copy(biometricLocked = false) }
            return
        }
        // Signed out but local vault exists: unlock directly into local-first mode
        enterLocalMode(fromBiometric = true)
    }

    fun showBiometricError(msg: String) {
        _uiState.update { it.copy(message = msg) }
    }

    fun setBiometricEnabled(enabled: Boolean) {
        _uiState.update {
            it.copy(
                biometricEnabled = enabled,
                biometricLocked = if (!enabled) false else it.biometricLocked,
                message = if (enabled) {
                    "Desbloqueio biométrico ativado neste aparelho."
                } else {
                    "Desbloqueio biométrico desativado."
                }
            )
        }
        persistCurrentStateToLocal()
    }

    fun lockWithBiometric() {
        val st = _uiState.value
        if (!st.biometricEnabled || !st.biometricAvailable) {
            _uiState.update { it.copy(message = "Ative a biometria nas configurações primeiro.") }
            return
        }
        _uiState.update { it.copy(biometricLocked = true) }
    }

    private suspend fun getBestLocalVaultForMerge(): LocalVaultSnapshot {
        val current = _uiState.value
        return if (current.isLocalMode) {
            buildVaultSnapshot(current)
        } else {
            withContext(Dispatchers.IO) { localStore.load() }
        }
    }

    /**
     * 3-Tier resilient Google Sign-In:
     * 1) Interactive Google Picker (GetSignInWithGoogleOption) via Credential Manager.
     * 2) Automatic fallback to SHA-1-free Web Google Auth Bridge (system browser -> deep link callback)
     *    whenever Credential Manager reports "No credentials available" or SHA-1 mismatch.
     */
    fun signInWithGoogle(activityContext: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            try {
                val credentialManager = CredentialManager.create(activityContext)
                val signInOption = GetSignInWithGoogleOption.Builder(
                    activityContext.getString(R.string.default_web_client_id)
                ).build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(signInOption)
                    .build()

                val result = credentialManager.getCredential(activityContext, request)
                val googleCred = GoogleIdTokenCredential.createFrom(result.credential.data)
                val firebaseCred = GoogleAuthProvider.getCredential(googleCred.idToken, null)
                val authResult = repo.auth.signInWithCredential(firebaseCred).await()
                val firebaseUser = authResult.user
                if (firebaseUser != null) {
                    val currentVault = getBestLocalVaultForMerge()
                    onAuthenticated(firebaseUser, currentVault)
                } else {
                    _uiState.update { it.copy(loading = false, message = "Falha ao autenticar.") }
                }
            } catch (e: GetCredentialCancellationException) {
                _uiState.update { it.copy(loading = false) }
            } catch (_: Exception) {
                // Credential Manager failed (e.g. NoCredentialException / SHA-1 mismatch on debug APK).
                // Automatically launch the authorized Web Google Auth Bridge.
                _uiState.update { it.copy(loading = false) }
                launchWebGoogleSignIn(activityContext)
            }
        }
    }

    fun launchWebGoogleSignIn(activityContext: Context) {
        try {
            val stateNonce = UUID.randomUUID().toString().replace("-", "").take(24)
            pendingAuthState = stateNonce
            val url = "$apiBaseUrl/?androidAuth=1&state=$stateNonce"
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activityContext.startActivity(intent)
            _uiState.update {
                it.copy(
                    loading = false,
                    message = "Complete o login Google no navegador para voltar ao app e sincronizar."
                )
            }
        } catch (e: Exception) {
            _uiState.update {
                it.copy(
                    loading = false,
                    message = e.localizedMessage ?: "Não foi possível abrir o navegador para login Google."
                )
            }
        }
    }

    fun handleAuthCallbackUri(uri: Uri) {
        if (uri.scheme != "verticefinance" || uri.host != "auth-callback") return
        val fragment = uri.encodedFragment.orEmpty()
        val params = parseUrlEncodedParams(fragment.ifBlank { uri.encodedQuery.orEmpty() })
        val idToken = params["idToken"]
        val accessToken = params["accessToken"]
        val returnedState = params["state"]
        val error = params["error"]

        if (!error.isNullOrBlank()) {
            _uiState.update { it.copy(loading = false, message = "Login Google cancelado: $error") }
            return
        }

        if (pendingAuthState != null && returnedState != pendingAuthState) {
            _uiState.update {
                it.copy(loading = false, message = "Sessão de retorno inválida. Tente entrar novamente.")
            }
            return
        }
        pendingAuthState = null

        if (idToken.isNullOrBlank() && accessToken.isNullOrBlank()) {
            _uiState.update {
                it.copy(loading = false, message = "Token Google não recebido. Tente novamente.")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            try {
                val firebaseUser = repo.signInWithGoogleTokens(idToken, accessToken)
                if (firebaseUser != null) {
                    val currentVault = getBestLocalVaultForMerge()
                    onAuthenticated(firebaseUser, currentVault)
                } else {
                    _uiState.update {
                        it.copy(loading = false, message = "Não foi possível concluir a autenticação Google.")
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        message = e.localizedMessage ?: "Erro ao validar credencial Google."
                    )
                }
            }
        }
    }

    private fun parseUrlEncodedParams(raw: String): Map<String, String> {
        if (raw.isBlank()) return emptyMap()
        val map = mutableMapOf<String, String>()
        raw.split("&").forEach { pair ->
            val idx = pair.indexOf('=')
            if (idx > 0) {
                val key = runCatching { URLDecoder.decode(pair.substring(0, idx), "UTF-8") }.getOrDefault("")
                val value = runCatching { URLDecoder.decode(pair.substring(idx + 1), "UTF-8") }.getOrDefault("")
                if (key.isNotBlank()) map[key] = value
            }
        }
        return map
    }

    fun signInWithEmail(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(message = "Informe e-mail e senha.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            try {
                val user = repo.signInWithEmail(email, password)
                if (user != null) {
                    if (!user.isEmailVerified) {
                        runCatching { user.sendEmailVerification().await() }
                        repo.auth.signOut()
                        _uiState.update {
                            it.copy(
                                loading = false,
                                message = "Verifique seu e-mail antes de sincronizar na nuvem. Reenviamos o link de confirmação."
                            )
                        }
                        return@launch
                    }
                    val currentVault = getBestLocalVaultForMerge()
                    onAuthenticated(user, currentVault)
                } else {
                    _uiState.update { it.copy(loading = false, message = "Falha no login.") }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        message = e.localizedMessage ?: "E-mail ou senha inválidos."
                    )
                }
            }
        }
    }

    fun signUpWithEmail(name: String, email: String, password: String) {
        if (name.trim().length < 2 || email.isBlank() || password.length < 8) {
            _uiState.update {
                it.copy(message = "Informe nome, e-mail válido e senha com no mínimo 8 caracteres.")
            }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, message = null) }
            try {
                repo.signUpWithEmail(name, email, password)
                repo.auth.signOut()
                _uiState.update {
                    it.copy(
                        loading = false,
                        message = "Conta criada! Confirme o link enviado ao seu e-mail e depois faça login."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        message = e.localizedMessage ?: "Não foi possível criar a conta."
                    )
                }
            }
        }
    }

    fun enterLocalMode(fromBiometric: Boolean = false) {
        viewModelScope.launch {
            val vault = withContext(Dispatchers.IO) { localStore.load() }
            val categories = vault.categories.ifEmpty { localStore.defaultCategories("local") }
            val accounts = vault.accounts.ifEmpty { listOf(localStore.defaultLocalAccount("local")) }
            _uiState.update {
                it.copy(
                    user = null,
                    isLocalMode = true,
                    biometricLocked = false,
                    hasLocalVaultData = true,
                    loading = false,
                    currency = vault.currency,
                    theme = vault.theme,
                    accounts = accounts,
                    categories = categories,
                    transactions = vault.transactions,
                    budgets = vault.budgets,
                    goals = vault.goals,
                    aiConversations = vault.aiConversations,
                    hasPendingLocalSync = vault.hasUnsyncedLocalData || vault.transactions.isNotEmpty() || vault.accounts.isNotEmpty(),
                    message = if (fromBiometric) {
                        "Cofre local desbloqueado por biometria."
                    } else {
                        "Modo Local ativo: dados salvos no dispositivo. Conecte sua conta Google quando quiser sincronizar com a nuvem."
                    }
                )
            }
            persistCurrentStateToLocal()
        }
    }

    private fun onAuthenticated(
        user: FirebaseUser,
        localVaultBeforeAuth: LocalVaultSnapshot,
        preserveBiometricLock: Boolean = false
    ) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    user = user,
                    isLocalMode = false,
                    biometricLocked = if (preserveBiometricLock) it.biometricLocked else false,
                    lastKnownEmail = user.email ?: it.lastKnownEmail,
                    lastKnownName = user.displayName ?: it.lastKnownName,
                    loading = false,
                    syncing = true
                )
            }
            try {
                val shouldMergeLocal = localVaultBeforeAuth.hasUnsyncedLocalData ||
                    localVaultBeforeAuth.localMode ||
                    localVaultBeforeAuth.accounts.any { it.userId == "local" } ||
                    localVaultBeforeAuth.transactions.any { it.userId == "local" }

                var mergedCount = 0
                if (shouldMergeLocal) {
                    mergedCount = repo.uploadLocalVaultToCloud(user, localVaultBeforeAuth)
                } else {
                    repo.ensureWorkspaceInitialized(user)
                }

                val now = System.currentTimeMillis()
                _uiState.update {
                    it.copy(
                        user = user,
                        isLocalMode = false,
                        loading = false,
                        syncing = false,
                        hasPendingLocalSync = false,
                        lastSyncedAtMillis = now,
                        message = if (mergedCount > 0) {
                            "Conta Google conectada! $mergedCount registro(s) local(is) sincronizado(s) com a nuvem."
                        } else {
                            it.message
                        }
                    )
                }
                persistCurrentStateToLocal()
                attachRealtimeListeners(user.uid)
            } catch (e: Exception) {
                // Even if offline right now, attach listeners so Firestore local cache serves cached data!
                attachRealtimeListeners(user.uid)
                _uiState.update {
                    it.copy(
                        user = user,
                        isLocalMode = false,
                        loading = false,
                        syncing = false,
                        message = "Modo offline ativo com cache local. Sincronização automática assim que houver internet."
                    )
                }
            }
        }
    }

    fun syncNow() {
        val user = _uiState.value.user ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(syncing = true) }
            try {
                val snapshot = buildVaultSnapshot(_uiState.value)
                var merged = 0
                if (_uiState.value.hasPendingLocalSync) {
                    merged = repo.uploadLocalVaultToCloud(user, snapshot)
                }
                repo.waitForCloudSync()
                val now = System.currentTimeMillis()
                _uiState.update {
                    it.copy(
                        syncing = false,
                        hasPendingLocalSync = false,
                        lastSyncedAtMillis = now,
                        message = if (merged > 0) {
                            "Sincronizado! $merged registro(s) enviado(s) para a nuvem Google."
                        } else {
                            "Dados locais e nuvem Google 100% sincronizados."
                        }
                    )
                }
                persistCurrentStateToLocal()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        syncing = false,
                        message = "Sem conexão no momento. Seus dados continuam salvos localmente e serão enviados automaticamente."
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
            repo.observeCurrency(uid).collect { c ->
                _uiState.update { it.copy(currency = c, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeTheme(uid).collect { t ->
                _uiState.update { it.copy(theme = t, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeAccounts(uid).collect { list ->
                _uiState.update { it.copy(accounts = list, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeCategories(uid).collect { list ->
                _uiState.update { it.copy(categories = list, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeTransactions(uid).collect { list ->
                _uiState.update { it.copy(transactions = list, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeBudgets(uid).collect { list ->
                _uiState.update { it.copy(budgets = list, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeGoals(uid).collect { list ->
                _uiState.update { it.copy(goals = list, lastSyncedAtMillis = System.currentTimeMillis()) }
                persistCurrentStateToLocal()
            }
        }
        listenerJobs += viewModelScope.launch {
            repo.observeAIConversations(uid).collect { list ->
                val currentId = _uiState.value.activeConversationId
                val nextId = if (currentId != null && list.any { it.id == currentId }) {
                    currentId
                } else {
                    list.firstOrNull()?.id
                }
                _uiState.update {
                    it.copy(
                        aiConversations = list,
                        activeConversationId = nextId,
                        lastSyncedAtMillis = System.currentTimeMillis()
                    )
                }
                persistCurrentStateToLocal()
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
                localMessagesByConv[conversationId] = msgs
                _uiState.update { it.copy(activeMessages = msgs) }
                persistCurrentStateToLocal()
            }
        }
    }

    fun selectConversation(conversationId: String) {
        val uid = _uiState.value.user?.uid
        _uiState.update { it.copy(activeConversationId = conversationId) }
        if (uid != null) {
            observeMessagesFor(uid, conversationId)
        } else {
            _uiState.update { it.copy(activeMessages = localMessagesByConv[conversationId].orEmpty()) }
        }
    }

    fun startNewConversation() {
        messagesJob?.cancel()
        _uiState.update { it.copy(activeConversationId = null, activeMessages = emptyList()) }
    }

    fun deleteConversation(conversationId: String) {
        val uid = _uiState.value.user?.uid
        if (uid == null) {
            localMessagesByConv.remove(conversationId)
            _uiState.update { st ->
                val remaining = st.aiConversations.filterNot { it.id == conversationId }
                st.copy(
                    aiConversations = remaining,
                    activeConversationId = if (st.activeConversationId == conversationId) remaining.firstOrNull()?.id else st.activeConversationId,
                    activeMessages = if (st.activeConversationId == conversationId) emptyList() else st.activeMessages
                )
            }
            persistCurrentStateToLocal()
            return
        }
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
        val safe = if (currency in listOf("BRL", "USD", "EUR")) currency else "BRL"
        val uid = _uiState.value.user?.uid
        _uiState.update {
            it.copy(
                currency = safe,
                hasPendingLocalSync = if (uid == null) true else it.hasPendingLocalSync,
                message = "Moeda alterada para $safe."
            )
        }
        persistCurrentStateToLocal()
        if (uid != null) {
            viewModelScope.launch {
                runCatching { repo.updateCurrency(uid, safe) }
            }
        }
    }

    fun setTheme(theme: String) {
        val safe = if (theme == "dark") "dark" else "light"
        val uid = _uiState.value.user?.uid
        _uiState.update {
            it.copy(
                theme = safe,
                hasPendingLocalSync = if (uid == null) true else it.hasPendingLocalSync
            )
        }
        persistCurrentStateToLocal()
        if (uid != null) {
            viewModelScope.launch {
                runCatching { repo.updateTheme(uid, safe) }
            }
        }
    }

    fun consumeRequestedTab() {
        _uiState.update { it.copy(requestedTab = null) }
    }

    fun refreshApiUsage() {
        val user = _uiState.value.user ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(apiUsageLoading = true) }
            try {
                val idToken = user.getIdToken(false).await().token ?: ""
                val summary = assistantClient.fetchApiUsage(idToken)
                _uiState.update { it.copy(apiUsage = summary, apiUsageLoading = false) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        apiUsageLoading = false,
                        message = e.localizedMessage ?: "Não foi possível carregar o uso da API."
                    )
                }
            }
        }
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
        val user = _uiState.value.user
        if (user == null) {
            _uiState.update {
                it.copy(message = "Conecte sua conta Google em Configurações para usar o Assistente IA na nuvem.")
            }
            return
        }
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
                var profileId = "auto_dynamic"

                for (step in 0 until 6) {
                    val snapshot = buildCompactSnapshot(_uiState.value)
                    val res = assistantClient.chat(idToken, contents, snapshot)
                    profileId = res.profileId
                    if (res.routing != null) {
                        _uiState.update { it.copy(lastRouting = res.routing) }
                    }
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
        val prev = _uiState.value
        val hasVault = prev.accounts.isNotEmpty() || prev.transactions.isNotEmpty() || prev.hasLocalVaultData
        _uiState.value = FinanceUiState(
            loading = false,
            isLocalMode = false,
            biometricAvailable = prev.biometricAvailable,
            biometricEnabled = prev.biometricEnabled,
            biometricLocked = false,
            hasLocalVaultData = hasVault,
            lastKnownEmail = prev.lastKnownEmail,
            lastKnownName = prev.lastKnownName,
            currency = prev.currency,
            theme = prev.theme
        )
        // Mark localMode = false while keeping local vault backup & biometric config safe on disk
        viewModelScope.launch(Dispatchers.IO) {
            val current = localStore.load()
            localStore.save(current.copy(localMode = false))
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    // --- Local-First + Cloud CRUD Operations ---

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
        val uid = _uiState.value.user?.uid
        val accounts = _uiState.value.accounts
        if (uid == null) {
            // Local-first offline mode
            val total = installments.coerceIn(1, 48)
            val groupId = if (total > 1) Formatters.safeId("grp") else ""
            val roundedAmount = (amount * 100.0).roundToLong() / 100.0
            val newTxs = mutableListOf<TransactionDoc>()
            val deltas = mutableMapOf<String, Double>()

            for (i in 0 until total) {
                val txId = Formatters.safeId("tx")
                val txDate = if (i == 0) date else Formatters.addMonthsToIso(date, i.toLong())
                val txStatus = if (i == 0) status else "pending"
                val effectiveCat = if (type == "transfer") "transfer" else categoryId
                val effectiveTo = if (type == "transfer") toAccountId else ""
                newTxs += TransactionDoc(
                    id = txId,
                    userId = "local",
                    type = type,
                    amount = roundedAmount,
                    description = description.trim().take(140),
                    categoryId = effectiveCat,
                    accountId = accountId,
                    toAccountId = effectiveTo,
                    date = txDate,
                    status = txStatus,
                    installmentGroupId = groupId,
                    installmentNumber = if (total > 1) i + 1 else 0,
                    installmentTotal = if (total > 1) total else 0,
                    notes = notes.trim().take(500)
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

            _uiState.update { st ->
                val updatedAccounts = st.accounts.map { acc ->
                    val d = deltas[acc.id] ?: 0.0
                    if (abs(d) > 0.0001) {
                        acc.copy(balance = ((acc.balance + d) * 100.0).roundToLong() / 100.0)
                    } else acc
                }
                val updatedTxs = (newTxs + st.transactions)
                    .sortedWith(compareByDescending<TransactionDoc> { it.date }.thenByDescending { it.id })
                st.copy(
                    accounts = updatedAccounts,
                    transactions = updatedTxs,
                    hasPendingLocalSync = true,
                    message = "Lançamento salvo localmente."
                )
            }
            persistCurrentStateToLocal()
            return
        }

        viewModelScope.launch {
            try {
                repo.createTransaction(
                    uid, accounts, type, amount, description, categoryId,
                    accountId, toAccountId, date, status, installments, notes
                )
                _uiState.update { it.copy(message = "Lançamento salvo (local + nuvem).") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao salvar.") }
            }
        }
    }

    fun toggleTransactionStatus(tx: TransactionDoc) {
        val uid = _uiState.value.user?.uid
        val accounts = _uiState.value.accounts
        if (uid == null) {
            val nextStatus = if (tx.status == "paid") "pending" else "paid"
            val direction = if (nextStatus == "paid") 1.0 else -1.0
            val deltas = mutableMapOf<String, Double>()
            when (tx.type) {
                "income" -> deltas[tx.accountId] = tx.amount * direction
                "expense" -> deltas[tx.accountId] = -tx.amount * direction
                "transfer" -> if (tx.toAccountId.isNotEmpty()) {
                    deltas[tx.accountId] = -tx.amount * direction
                    deltas[tx.toAccountId] = tx.amount * direction
                }
            }
            _uiState.update { st ->
                val updatedTxs = st.transactions.map { if (it.id == tx.id) it.copy(status = nextStatus) else it }
                val updatedAccs = st.accounts.map { acc ->
                    val d = deltas[acc.id] ?: 0.0
                    if (abs(d) > 0.0001) {
                        acc.copy(balance = ((acc.balance + d) * 100.0).roundToLong() / 100.0)
                    } else acc
                }
                st.copy(accounts = updatedAccs, transactions = updatedTxs, hasPendingLocalSync = true)
            }
            persistCurrentStateToLocal()
            return
        }

        viewModelScope.launch {
            try {
                repo.toggleTransactionStatus(uid, tx, accounts)
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao atualizar.") }
            }
        }
    }

    fun deleteTransaction(tx: TransactionDoc) {
        val uid = _uiState.value.user?.uid
        val accounts = _uiState.value.accounts
        if (uid == null) {
            val deltas = mutableMapOf<String, Double>()
            if (tx.status == "paid") {
                when (tx.type) {
                    "income" -> deltas[tx.accountId] = -tx.amount
                    "expense" -> deltas[tx.accountId] = tx.amount
                    "transfer" -> if (tx.toAccountId.isNotEmpty()) {
                        deltas[tx.accountId] = tx.amount
                        deltas[tx.toAccountId] = -tx.amount
                    }
                }
            }
            _uiState.update { st ->
                val updatedAccs = st.accounts.map { acc ->
                    val d = deltas[acc.id] ?: 0.0
                    if (abs(d) > 0.0001) {
                        acc.copy(balance = ((acc.balance + d) * 100.0).roundToLong() / 100.0)
                    } else acc
                }
                st.copy(
                    accounts = updatedAccs,
                    transactions = st.transactions.filterNot { it.id == tx.id },
                    hasPendingLocalSync = true,
                    message = "Lançamento removido localmente."
                )
            }
            persistCurrentStateToLocal()
            return
        }

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
        val uid = _uiState.value.user?.uid
        if (uid == null) {
            val normalizedBal = if (type == "credit") -abs(balance) else balance
            val acc = AccountDoc(
                id = Formatters.safeId("acc"),
                userId = "local",
                name = name.trim().take(80),
                type = type,
                institution = institution.trim().take(80),
                balance = ((normalizedBal * 100.0).roundToLong() / 100.0),
                creditLimit = if (type == "credit") creditLimit.coerceAtLeast(0.0) else 0.0,
                closingDay = if (type == "credit") closingDay.coerceIn(1, 31) else 0,
                dueDay = if (type == "credit") dueDay.coerceIn(1, 31) else 0,
                color = if (type == "credit") "#1E293B" else "#0F766E",
                archived = false
            )
            _uiState.update { st ->
                st.copy(
                    accounts = (st.accounts + acc).sortedBy { it.name },
                    hasPendingLocalSync = true,
                    message = "Conta salva localmente."
                )
            }
            persistCurrentStateToLocal()
            return
        }

        viewModelScope.launch {
            try {
                repo.createAccount(uid, name, type, institution, balance, creditLimit, closingDay, dueDay)
                _uiState.update { it.copy(message = "Conta cadastrada (local + nuvem).") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro ao criar conta.") }
            }
        }
    }

    fun contributeToGoal(goal: GoalDoc, amount: Double) {
        val uid = _uiState.value.user?.uid
        if (uid == null) {
            val nextAmount = ((goal.currentAmount + amount) * 100.0).roundToLong() / 100.0
            val nextStatus = if (nextAmount >= goal.targetAmount) "completed" else "active"
            _uiState.update { st ->
                st.copy(
                    goals = st.goals.map {
                        if (it.id == goal.id) it.copy(currentAmount = nextAmount, status = nextStatus) else it
                    },
                    hasPendingLocalSync = true,
                    message = "Aporte salvo localmente."
                )
            }
            persistCurrentStateToLocal()
            return
        }

        viewModelScope.launch {
            try {
                repo.contributeToGoal(uid, goal, amount)
                _uiState.update { it.copy(message = "Aporte registrado (local + nuvem).") }
            } catch (e: Exception) {
                _uiState.update { it.copy(message = e.localizedMessage ?: "Erro no aporte.") }
            }
        }
    }
}
