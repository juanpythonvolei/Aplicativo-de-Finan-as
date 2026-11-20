package com.verticefinance.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.verticefinance.app.data.Formatters
import com.verticefinance.app.ui.*

class MainActivity : ComponentActivity() {
    private val viewModel: FinanceViewModel by viewModels()

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

                if (state.loading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (state.user == null) {
                    AuthScreen(
                        onGoogleSignIn = { viewModel.signInWithGoogle(this@MainActivity) },
                        errorMessage = state.message
                    )
                } else {
                    var currentTab by remember { mutableIntStateOf(0) }
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
                                        Text(
                                            text = Formatters.formatMonthLabel(state.selectedMonth),
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
                                    IconButton(onClick = { showSettings = true }) {
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
                            when (currentTab) {
                                0 -> AssistantScreen(
                                    state = state,
                                    onSendMessage = { viewModel.sendAIMessage(it) },
                                    onNewConversation = { viewModel.startNewConversation() },
                                    onSelectConversation = { viewModel.selectConversation(it) },
                                    onDeleteConversation = { viewModel.deleteConversation(it) },
                                    onOpenDashboard = { currentTab = 1 }
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
