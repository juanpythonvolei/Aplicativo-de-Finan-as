package com.verticefinance.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.fragment.app.FragmentActivity
import com.verticefinance.app.data.BiometricAuthHelper
import com.verticefinance.app.data.Formatters
import com.verticefinance.app.ui.*

class MainActivity : FragmentActivity() {
    private val viewModel: FinanceViewModel by viewModels()

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "verticefinance" && data.host == "auth-callback") {
            viewModel.handleAuthCallbackUri(data)
        }
    }

    private fun promptBiometricUnlock(
        title: String = "Desbloquear Vértice Finance",
        subtitle: String = "Use Face ID, impressão digital ou credencial do dispositivo"
    ) {
        BiometricAuthHelper.authenticate(
            activity = this,
            title = title,
            subtitle = subtitle,
            onSuccess = { viewModel.onBiometricUnlockSuccess() },
            onError = { err -> viewModel.showBiometricError(err) }
        )
    }

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingIntent(intent)

        setContent {
            val state by viewModel.uiState.collectAsState()
            VerticeFinanceTheme(darkTheme = state.theme == "dark") {
                val snackbarHostState = remember { SnackbarHostState() }

                LaunchedEffect(state.message) {
                    state.message?.let { msg ->
                        snackbarHostState.showSnackbar(msg)
                        viewModel.clearMessage()
                    }
                }

                // Automatically trigger native biometric prompt once when opening a locked vault
                var autoPrompted by remember(state.biometricLocked) { mutableStateOf(false) }
                LaunchedEffect(state.loading, state.biometricLocked, state.biometricAvailable) {
                    if (!state.loading && state.biometricLocked && state.biometricAvailable && !autoPrompted) {
                        autoPrompted = true
                        promptBiometricUnlock()
                    }
                }

                if (state.loading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if ((state.user == null && !state.isLocalMode) || state.biometricLocked) {
                    val showBiometricOption = state.biometricAvailable &&
                        (state.biometricLocked || state.biometricEnabled || state.hasLocalVaultData)
                    AuthScreen(
                        biometricLocked = state.biometricLocked,
                        showBiometricButton = showBiometricOption,
                        recognizedAccountLabel = state.lastKnownEmail.ifBlank {
                            if (state.hasLocalVaultData) "Cofre Local no aparelho" else ""
                        },
                        onBiometricSignIn = { promptBiometricUnlock() },
                        onSwitchAccount = { viewModel.signOut() },
                        onGoogleSignIn = { viewModel.signInWithGoogle(this@MainActivity) },
                        onWebGoogleSignIn = { viewModel.launchWebGoogleSignIn(this@MainActivity) },
                        onEmailSignIn = { email, pass -> viewModel.signInWithEmail(email, pass) },
                        onEmailSignUp = { name, email, pass -> viewModel.signUpWithEmail(name, email, pass) },
                        onContinueLocal = { viewModel.enterLocalMode() },
                        errorMessage = state.message
                    )
                } else {
                    var currentTab by remember { mutableIntStateOf(if (state.isLocalMode) 1 else 0) }
                    var showNewTx by remember { mutableStateOf(false) }
                    var showSettings by remember { mutableStateOf(false) }

                    LaunchedEffect(state.requestedTab) {
                        state.requestedTab?.let { target ->
                            currentTab = target
                            viewModel.consumeRequestedTab()
                        }
                    }

                    Scaffold(
                        snackbarHost = { SnackbarHost(snackbarHostState) },
                        topBar = {
                            TopAppBar(
                                title = {
                                    Column {
                                        Text(
                                            text = "Vértice Finance",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        val subtitle = buildString {
                                            append(Formatters.formatMonthLabel(state.selectedMonth))
                                            append(" · ")
                                            append(if (state.isLocalMode) "Local (Offline)" else "Local + Nuvem")
                                        }
                                        Text(
                                            text = subtitle,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                },
                                actions = {
                                    IconButton(onClick = { viewModel.shiftMonth(-1) }) {
                                        Icon(Icons.Outlined.ChevronLeft, contentDescription = "Mês anterior")
                                    }
                                    IconButton(onClick = { viewModel.shiftMonth(1) }) {
                                        Icon(Icons.Outlined.ChevronRight, contentDescription = "Próximo mês")
                                    }
                                    IconButton(onClick = {
                                        showSettings = true
                                        if (state.user != null) {
                                            viewModel.refreshApiUsage()
                                        }
                                    }) {
                                        Icon(Icons.Outlined.Settings, contentDescription = "Configurações")
                                    }
                                }
                            )
                        },
                        floatingActionButton = {
                            if (currentTab != 0) {
                                FloatingActionButton(
                                    onClick = { showNewTx = true },
                                    containerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = MaterialTheme.colorScheme.onPrimary
                                ) {
                                    Icon(Icons.Outlined.Add, contentDescription = "Novo Lançamento")
                                }
                            }
                        },
                        bottomBar = {
                            NavigationBar {
                                NavigationBarItem(
                                    selected = currentTab == 0,
                                    onClick = { currentTab = 0 },
                                    icon = { Icon(Icons.Outlined.AutoAwesome, null) },
                                    label = { Text("IA") }
                                )
                                NavigationBarItem(
                                    selected = currentTab == 1,
                                    onClick = { currentTab = 1 },
                                    icon = { Icon(Icons.Outlined.Dashboard, null) },
                                    label = { Text("Resumo") }
                                )
                                NavigationBarItem(
                                    selected = currentTab == 2,
                                    onClick = { currentTab = 2 },
                                    icon = { Icon(Icons.Outlined.ReceiptLong, null) },
                                    label = { Text("Extrato") }
                                )
                                NavigationBarItem(
                                    selected = currentTab == 3,
                                    onClick = { currentTab = 3 },
                                    icon = { Icon(Icons.Outlined.AccountBalanceWallet, null) },
                                    label = { Text("Contas") }
                                )
                                NavigationBarItem(
                                    selected = currentTab == 4,
                                    onClick = { currentTab = 4 },
                                    icon = { Icon(Icons.Outlined.TrackChanges, null) },
                                    label = { Text("Metas") }
                                )
                            }
                        }
                    ) { innerPadding ->
                        Box(modifier = Modifier.padding(innerPadding)) {
                            AnimatedContent(
                                targetState = currentTab,
                                transitionSpec = {
                                    (fadeIn(tween(220)) + scaleIn(
                                        initialScale = 0.985f,
                                        animationSpec = tween(220)
                                    )).togetherWith(fadeOut(tween(150)))
                                },
                                label = "tabTransition"
                            ) { tab ->
                                when (tab) {
                                    0 -> AssistantScreen(
                                        state = state,
                                        onSendMessage = { viewModel.sendAIMessage(it) },
                                        onNewConversation = { viewModel.startNewConversation() },
                                        onSelectConversation = { viewModel.selectConversation(it) },
                                        onDeleteConversation = { viewModel.deleteConversation(it) },
                                        onOpenDashboard = { currentTab = 1 },
                                        onConnectGoogle = { viewModel.launchWebGoogleSignIn(this@MainActivity) }
                                    )
                                    1 -> DashboardScreen(
                                        state = state,
                                        onTogglePaid = { viewModel.toggleTransactionStatus(it) }
                                    )
                                    2 -> TransactionsScreen(
                                        state = state,
                                        onToggleStatus = { viewModel.toggleTransactionStatus(it) },
                                        onDelete = { viewModel.deleteTransaction(it) }
                                    )
                                    3 -> AccountsScreen(
                                        state = state,
                                        onCreateAccount = { n, t, i, b, l, c, d ->
                                            viewModel.createAccount(n, t, i, b, l, c, d)
                                        }
                                    )
                                    4 -> BudgetsGoalsScreen(
                                        state = state,
                                        onContributeGoal = { goal, amt ->
                                            viewModel.contributeToGoal(goal, amt)
                                        }
                                    )
                                }
                            }
                        }
                    }

                    if (showNewTx) {
                        NewTransactionDialog(
                            accounts = state.accounts,
                            categories = state.categories,
                            onDismiss = { showNewTx = false },
                            onSave = { type, amt, desc, catId, accId, toId, date, status, inst, notes ->
                                viewModel.createTransaction(
                                    type, amt, desc, catId, accId, toId, date, status, inst, notes
                                )
                                showNewTx = false
                            }
                        )
                    }

                    if (showSettings) {
                        SettingsDialog(
                            currency = state.currency,
                            theme = state.theme,
                            userEmail = state.user?.email ?: "",
                            isLocalMode = state.isLocalMode,
                            biometricAvailable = state.biometricAvailable,
                            biometricEnabled = state.biometricEnabled,
                            syncing = state.syncing,
                            lastSyncedAtMillis = state.lastSyncedAtMillis,
                            hasPendingLocalSync = state.hasPendingLocalSync,
                            localSummary = "${state.accounts.size} conta(s) · ${state.transactions.size} lançamento(s) · ${state.goals.size} meta(s)",
                            apiUsage = state.apiUsage,
                            apiUsageLoading = state.apiUsageLoading,
                            onRefreshApiUsage = { viewModel.refreshApiUsage() },
                            onSyncNow = { viewModel.syncNow() },
                            onConnectGoogle = {
                                showSettings = false
                                viewModel.launchWebGoogleSignIn(this@MainActivity)
                            },
                            onToggleBiometric = { enable ->
                                if (enable) {
                                    BiometricAuthHelper.authenticate(
                                        activity = this@MainActivity,
                                        title = "Ativar Biometria",
                                        subtitle = "Confirme sua digital ou rosto para proteger o cofre local",
                                        onSuccess = { viewModel.setBiometricEnabled(true) },
                                        onError = { err -> viewModel.showBiometricError(err) }
                                    )
                                } else {
                                    viewModel.setBiometricEnabled(false)
                                }
                            },
                            onLockNow = {
                                showSettings = false
                                viewModel.lockWithBiometric()
                            },
                            onSelectCurrency = { viewModel.setCurrency(it) },
                            onSelectTheme = { viewModel.setTheme(it) },
                            onSignOut = { viewModel.signOut() },
                            onDismiss = { showSettings = false }
                        )
                    }
                }
            }
        }
    }
}
