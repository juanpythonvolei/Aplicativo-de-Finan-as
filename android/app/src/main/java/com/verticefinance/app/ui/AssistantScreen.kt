package com.verticefinance.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.verticefinance.app.data.AIConversationDoc
import com.verticefinance.app.data.Formatters

private val ANDROID_QUICK_PROMPTS = listOf(
    "Faça um resumo completo do meu mês atual",
    "Registre uma despesa de R$ 85 em Alimentação hoje",
    "Quais lançamentos estão pendentes e precisam de atenção?",
    "Crie orçamentos equilibrados para minhas despesas deste mês"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssistantScreen(
    state: FinanceUiState,
    onSendMessage: (String) -> Unit,
    onNewConversation: () -> Unit,
    onSelectConversation: (String) -> Unit,
    onDeleteConversation: (String) -> Unit,
    onOpenDashboard: () -> Unit
) {
    var input by remember { mutableStateOf("") }
    var showHistorySheet by remember { mutableStateOf(false) }
    var historySearch by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    val activeAccounts = remember(state.accounts) { state.accounts.filter { !it.archived } }
    val consolidated = remember(activeAccounts) { activeAccounts.sumOf { it.balance } }
    val monthTxs = remember(state.transactions, state.selectedMonth) {
        state.transactions.filter { it.date.startsWith(state.selectedMonth) }
    }
    val monthIncome = remember(monthTxs) { monthTxs.filter { it.type == "income" }.sumOf { it.amount } }
    val monthExpense = remember(monthTxs) { monthTxs.filter { it.type == "expense" }.sumOf { it.amount } }
    val activeConv = remember(state.aiConversations, state.activeConversationId) {
        state.aiConversations.firstOrNull { it.id == state.activeConversationId }
    }

    LaunchedEffect(state.activeMessages.size, state.aiSending) {
        if (state.activeMessages.isNotEmpty()) {
            listState.animateScrollToItem(state.activeMessages.size - 1)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Compact Financial Summary Strip
        Surface(
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Saldo Consolidado",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = Formatters.currency(consolidated, state.currency),
                        style = MaterialTheme.typography.titleSmall,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "+${Formatters.currency(monthIncome, state.currency)}",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = EmeraldPositive
                    )
                    Text(
                        text = "-${Formatters.currency(monthExpense, state.currency)}",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = CrimsonNegative
                    )
                }
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = onOpenDashboard) {
                    Icon(Icons.Outlined.BarChart, contentDescription = "Ver resumo financeiro")
                }
            }
        }

        // Active Conversation Header Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clickable { showHistorySheet = true },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Outlined.History,
                    contentDescription = "Histórico de conversas",
                    tint = MaterialTheme.colorScheme.primary
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = activeConv?.title ?: "Nova conversa",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${state.aiConversations.size} conversa(s) salva(s)",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            TextButton(onClick = onNewConversation) {
                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Nova")
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline)

        // Messages Area
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (state.activeMessages.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Assistente Financeiro IA",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = "Diga o que deseja analisar ou executar: lançar receitas e despesas, criar contas, ajustar orçamentos, aportar em metas ou alterar configurações.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                items(ANDROID_QUICK_PROMPTS) { prompt ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = !state.aiSending) { onSendMessage(prompt) }
                    ) {
                        Text(
                            text = prompt,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }
            } else {
                items(state.activeMessages, key = { it.id }) { msg ->
                    val isUser = msg.role == "user"
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
                    ) {
                        if (!isUser && msg.actionsSummary.isNotEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                msg.actionsSummary.forEach { act ->
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = MaterialTheme.colorScheme.surfaceVariant,
                                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                Icons.Outlined.CheckCircle,
                                                contentDescription = null,
                                                tint = EmeraldPositive,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                text = act,
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
                            contentColor = if (isUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                            border = if (isUser) null else BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                            modifier = Modifier.widthIn(max = 320.dp)
                        ) {
                            Text(
                                text = msg.text,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                            )
                        }
                    }
                }
            }

            if (state.aiSending) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Text(
                            text = "Processando no Vértice IA...",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Composer
        Surface(
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text("Peça uma análise ou ação no sistema...") },
                    modifier = Modifier.weight(1f),
                    maxLines = 3,
                    enabled = !state.aiSending
                )
                FilledIconButton(
                    onClick = {
                        val trimmed = input.trim()
                        if (trimmed.isNotEmpty() && !state.aiSending) {
                            input = ""
                            onSendMessage(trimmed)
                        }
                    },
                    enabled = !state.aiSending && input.isNotBlank()
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Enviar")
                }
            }
        }
    }

    if (showHistorySheet) {
        ModalBottomSheet(onDismissRequest = { showHistorySheet = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Conversas Salvas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = {
                        onNewConversation()
                        showHistorySheet = false
                    }) {
                        Text("Nova conversa")
                    }
                }

                OutlinedTextField(
                    value = historySearch,
                    onValueChange = { historySearch = it },
                    placeholder = { Text("Buscar conversa...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                val filtered = remember(state.aiConversations, historySearch) {
                    val q = historySearch.trim().lowercase()
                    if (q.isEmpty()) state.aiConversations
                    else state.aiConversations.filter {
                        it.title.lowercase().contains(q) || it.preview.lowercase().contains(q)
                    }
                }

                if (filtered.isEmpty()) {
                    Text(
                        text = "Nenhuma conversa encontrada.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 360.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filtered, key = { it.id }) { conv: AIConversationDoc ->
                            val selected = conv.id == state.activeConversationId
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (selected) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface,
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onSelectConversation(conv.id)
                                        showHistorySheet = false
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = conv.title,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (conv.preview.isNotBlank()) {
                                            Text(
                                                text = conv.preview,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                    IconButton(onClick = { onDeleteConversation(conv.id) }) {
                                        Icon(
                                            Icons.Outlined.DeleteOutline,
                                            contentDescription = "Excluir conversa"
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun SettingsDialog(
    currency: String,
    theme: String,
    userEmail: String,
    onSelectCurrency: (String) -> Unit,
    onSelectTheme: (String) -> Unit,
    onSignOut: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text("Configurações e Conta", fontWeight = FontWeight.Bold)
                if (userEmail.isNotBlank()) {
                    Text(
                        text = userEmail,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Moeda Principal",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("BRL", "USD", "EUR").forEach { code ->
                            FilterChip(
                                selected = currency == code,
                                onClick = { onSelectCurrency(code) },
                                label = { Text(code, fontFamily = FontFamily.Monospace) }
                            )
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Tema da Interface",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = theme != "dark",
                            onClick = { onSelectTheme("light") },
                            label = { Text("Claro") }
                        )
                        FilterChip(
                            selected = theme == "dark",
                            onClick = { onSelectTheme("dark") },
                            label = { Text("Escuro") }
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Concluir")
            }
        },
        dismissButton = {
            TextButton(onClick = {
                onDismiss()
                onSignOut()
            }) {
                Text("Sair da conta", color = CrimsonNegative)
            }
        }
    )
}
