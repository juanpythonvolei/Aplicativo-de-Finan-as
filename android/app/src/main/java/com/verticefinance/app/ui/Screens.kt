package com.verticefinance.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.verticefinance.app.data.AccountDoc
import com.verticefinance.app.data.Formatters
import com.verticefinance.app.data.TransactionDoc
import kotlin.math.max

@Composable
fun AuthScreen(onGoogleSignIn: () -> Unit, errorMessage: String?) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = "Vértice Finance",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Controle financeiro pessoal sincronizado em tempo real com sua conta web.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(28.dp))
            Button(
                onClick = onGoogleSignIn,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Entrar com Google", fontWeight = FontWeight.SemiBold)
            }
            if (!errorMessage.isNullOrBlank()) {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = errorMessage,
                    color = CrimsonNegative,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
fun DashboardScreen(
    state: FinanceUiState,
    onTogglePaid: (TransactionDoc) -> Unit
) {
    val activeAccounts = remember(state.accounts) { state.accounts.filter { !it.archived } }
    val consolidated = remember(activeAccounts) { activeAccounts.sumOf { it.balance } }
    val monthTxs = remember(state.transactions, state.selectedMonth) {
        state.transactions.filter { it.date.startsWith(state.selectedMonth) }
    }
    val monthIncome = remember(monthTxs) { monthTxs.filter { it.type == "income" }.sumOf { it.amount } }
    val monthExpense = remember(monthTxs) { monthTxs.filter { it.type == "expense" }.sumOf { it.amount } }
    val net = monthIncome - monthExpense
    val pending = remember(state.transactions) {
        state.transactions.filter { it.status == "pending" }.sortedBy { it.date }.take(5)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Patrimônio Líquido Consolidado",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = Formatters.currency(consolidated, state.currency),
                        style = MaterialTheme.typography.headlineMedium,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                MetricCard(
                    title = "Receitas",
                    value = Formatters.currency(monthIncome, state.currency),
                    valueColor = EmeraldPositive,
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    title = "Despesas",
                    value = Formatters.currency(monthExpense, state.currency),
                    valueColor = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            MetricCard(
                title = "Balanço do Mês",
                value = Formatters.currency(net, state.currency),
                valueColor = if (net >= 0) TealPrimary else CrimsonNegative,
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (pending.isNotEmpty()) {
            item {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Pendentes e Próximos Vencimentos",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            items(pending, key = { it.id }) { tx ->
                TransactionRowCard(
                    tx = tx,
                    currency = state.currency,
                    categoryName = state.categories.find { it.id == tx.categoryId }?.name ?: "Transferência",
                    accountName = state.accounts.find { it.id == tx.accountId }?.name ?: "-",
                    onToggleStatus = { onTogglePaid(tx) },
                    onDelete = null
                )
            }
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold,
                color = valueColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun TransactionsScreen(
    state: FinanceUiState,
    onToggleStatus: (TransactionDoc) -> Unit,
    onDelete: (TransactionDoc) -> Unit
) {
    var filterType by remember { mutableStateOf("all") }
    val filtered = remember(state.transactions, state.selectedMonth, filterType) {
        state.transactions.filter { tx ->
            tx.date.startsWith(state.selectedMonth) &&
                (filterType == "all" || tx.type == filterType)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(
                "all" to "Todos",
                "expense" to "Despesas",
                "income" to "Receitas",
                "transfer" to "Transf."
            ).forEach { (id, label) ->
                FilterChip(
                    selected = filterType == id,
                    onClick = { filterType = id },
                    label = { Text(label, maxLines = 1) }
                )
            }
        }

        if (filtered.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = "Nenhum lançamento neste mês.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filtered, key = { it.id }) { tx ->
                    TransactionRowCard(
                        tx = tx,
                        currency = state.currency,
                        categoryName = if (tx.type == "transfer") "Transferência" else
                            state.categories.find { it.id == tx.categoryId }?.name ?: "Outros",
                        accountName = state.accounts.find { it.id == tx.accountId }?.name ?: "-",
                        onToggleStatus = { onToggleStatus(tx) },
                        onDelete = { onDelete(tx) }
                    )
                }
            }
        }
    }
}

@Composable
fun TransactionRowCard(
    tx: TransactionDoc,
    currency: String,
    categoryName: String,
    accountName: String,
    onToggleStatus: () -> Unit,
    onDelete: (() -> Unit)?
) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (tx.installmentTotal > 1)
                        "${tx.description} (${tx.installmentNumber}/${tx.installmentTotal})"
                    else tx.description,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${Formatters.formatShortDate(tx.date)} · $categoryName · $accountName",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(Modifier.width(10.dp))

            Column(horizontalAlignment = Alignment.End) {
                val prefix = when (tx.type) {
                    "income" -> "+"
                    "expense" -> "-"
                    else -> ""
                }
                Text(
                    text = prefix + Formatters.currency(tx.amount, currency),
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    color = when (tx.type) {
                        "income" -> EmeraldPositive
                        "transfer" -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurface
                    }
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = onToggleStatus,
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 0.dp)
                    ) {
                        Text(
                            text = if (tx.status == "paid") "Efetivado" else "Pendente",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (tx.status == "paid") EmeraldPositive else AmberWarning
                        )
                    }
                    if (onDelete != null) {
                        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                            Icon(
                                imageVector = Icons.Outlined.Delete,
                                contentDescription = "Excluir",
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AccountsScreen(
    state: FinanceUiState,
    onCreateAccount: (String, String, String, Double, Double, Int, Int) -> Unit
) {
    var showNewAccount by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Contas e Cartões",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                OutlinedButton(onClick = { showNewAccount = true }) {
                    Text("Nova Conta")
                }
            }
        }

        items(state.accounts.filter { !it.archived }, key = { it.id }) { acc ->
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(acc.name, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = acc.institution.ifBlank { acc.type },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (acc.type == "credit") {
                            val invoice = max(0.0, -acc.balance)
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "Fatura",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = Formatters.currency(invoice, state.currency),
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        } else {
                            Text(
                                text = Formatters.currency(acc.balance, state.currency),
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = if (acc.balance >= 0) MaterialTheme.colorScheme.onSurface else CrimsonNegative
                            )
                        }
                    }
                    if (acc.type == "credit" && acc.creditLimit > 0) {
                        val invoice = max(0.0, -acc.balance)
                        val pct = (invoice / acc.creditLimit).toFloat().coerceIn(0f, 1f)
                        Spacer(Modifier.height(10.dp))
                        LinearProgressIndicator(
                            progress = { pct },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Limite ${Formatters.currency(acc.creditLimit, state.currency)} · Vence dia ${acc.dueDay}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }

    if (showNewAccount) {
        NewAccountDialog(
            onDismiss = { showNewAccount = false },
            onSave = { name, type, inst, bal, limit, closeDay, dueDay ->
                onCreateAccount(name, type, inst, bal, limit, closeDay, dueDay)
                showNewAccount = false
            }
        )
    }
}

@Composable
fun BudgetsGoalsScreen(
    state: FinanceUiState,
    onContributeGoal: (com.verticefinance.app.data.GoalDoc, Double) -> Unit
) {
    val monthBudgets = remember(state.budgets, state.selectedMonth) {
        state.budgets.filter { it.month == state.selectedMonth }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Orçamentos de ${Formatters.formatMonthLabel(state.selectedMonth)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        if (monthBudgets.isEmpty()) {
            item {
                Text(
                    text = "Nenhum orçamento definido para este mês.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            items(monthBudgets, key = { it.id }) { b ->
                val catName = state.categories.find { it.id == b.categoryId }?.name ?: "Categoria"
                val spent = state.transactions
                    .filter {
                        it.type == "expense" &&
                            it.date.startsWith(state.selectedMonth) &&
                            it.categoryId == b.categoryId
                    }
                    .sumOf { it.amount }
                val pct = if (b.amount > 0) (spent / b.amount).toFloat().coerceIn(0f, 1f) else 0f

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(catName, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "${Formatters.currency(spent, state.currency)} / ${Formatters.currency(b.amount, state.currency)}",
                                fontFamily = FontFamily.Monospace,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        LinearProgressIndicator(
                            progress = { pct },
                            color = if (spent > b.amount) CrimsonNegative else TealPrimary,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Metas Financeiras",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        items(state.goals, key = { it.id }) { goal ->
            val pct = if (goal.targetAmount > 0)
                (goal.currentAmount / goal.targetAmount).toFloat().coerceIn(0f, 1f) else 0f
            var showContrib by remember { mutableStateOf(false) }

            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(goal.name, fontWeight = FontWeight.SemiBold)
                            Text(
                                text = "${Formatters.currency(goal.currentAmount, state.currency)} de ${Formatters.currency(goal.targetAmount, state.currency)}",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        if (goal.status == "active") {
                            FilledTonalButton(onClick = { showContrib = true }) {
                                Text("Aportar")
                            }
                        } else {
                            Text("Concluída", color = EmeraldPositive, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(progress = { pct }, modifier = Modifier.fillMaxWidth())
                }
            }

            if (showContrib) {
                var amtText by remember { mutableStateOf("") }
                AlertDialog(
                    onDismissRequest = { showContrib = false },
                    title = { Text("Aportar em ${goal.name}") },
                    text = {
                        OutlinedTextField(
                            value = amtText,
                            onValueChange = { amtText = it },
                            label = { Text("Valor") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            singleLine = true
                        )
                    },
                    confirmButton = {
                        Button(onClick = {
                            val v = amtText.replace(",", ".").toDoubleOrNull() ?: 0.0
                            if (v > 0) {
                                onContributeGoal(goal, v)
                                showContrib = false
                            }
                        }) { Text("Confirmar") }
                    },
                    dismissButton = {
                        TextButton(onClick = { showContrib = false }) { Text("Cancelar") }
                    }
                )
            }
        }
    }
}

@Composable
fun NewTransactionDialog(
    accounts: List<AccountDoc>,
    categories: List<com.verticefinance.app.data.CategoryDoc>,
    onDismiss: () -> Unit,
    onSave: (String, Double, String, String, String, String, String, String, Int, String) -> Unit
) {
    val activeAccounts = remember(accounts) { accounts.filter { !it.archived } }
    var type by remember { mutableStateOf("expense") }
    var amountText by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("paid") }
    var installmentsText by remember { mutableStateOf("1") }
    var selectedAccountId by remember { mutableStateOf(activeAccounts.firstOrNull()?.id ?: "") }
    var toAccountId by remember {
        mutableStateOf(activeAccounts.drop(1).firstOrNull()?.id ?: "")
    }
    val matchingCats = remember(categories, type) {
        categories.filter { it.type == if (type == "income") "income" else "expense" }
    }
    var selectedCategoryId by remember(matchingCats) {
        mutableStateOf(matchingCats.firstOrNull()?.id ?: "")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Novo Lançamento") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("expense" to "Despesa", "income" to "Receita", "transfer" to "Transf.").forEach { (id, lbl) ->
                        FilterChip(
                            selected = type == id,
                            onClick = { type = id },
                            label = { Text(lbl) }
                        )
                    }
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Valor") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Descrição") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (activeAccounts.isNotEmpty()) {
                    Text("Conta: ${activeAccounts.find { it.id == selectedAccountId }?.name ?: "-"}", style = MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        activeAccounts.take(3).forEach { acc ->
                            FilterChip(
                                selected = selectedAccountId == acc.id,
                                onClick = { selectedAccountId = acc.id },
                                label = { Text(acc.name, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            )
                        }
                    }
                }
                if (type != "transfer" && matchingCats.isNotEmpty()) {
                    Text("Categoria: ${matchingCats.find { it.id == selectedCategoryId }?.name ?: "-"}", style = MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        matchingCats.take(3).forEach { cat ->
                            FilterChip(
                                selected = selectedCategoryId == cat.id,
                                onClick = { selectedCategoryId = cat.id },
                                label = { Text(cat.name, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                            )
                        }
                    }
                }
                if (type == "transfer" && activeAccounts.size > 1) {
                    val destOptions = activeAccounts.filter { it.id != selectedAccountId }
                    if (toAccountId.isEmpty() || toAccountId == selectedAccountId) {
                        toAccountId = destOptions.firstOrNull()?.id ?: ""
                    }
                    Text("Destino: ${destOptions.find { it.id == toAccountId }?.name ?: "-"}", style = MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        destOptions.take(2).forEach { acc ->
                            FilterChip(
                                selected = toAccountId == acc.id,
                                onClick = { toAccountId = acc.id },
                                label = { Text(acc.name, maxLines = 1) }
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = status == "paid",
                        onClick = { status = "paid" },
                        label = { Text("Efetivado") }
                    )
                    FilterChip(
                        selected = status == "pending",
                        onClick = { status = "pending" },
                        label = { Text("Pendente") }
                    )
                }
                if (type != "transfer") {
                    OutlinedTextField(
                        value = installmentsText,
                        onValueChange = { installmentsText = it },
                        label = { Text("Parcelas") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                enabled = activeAccounts.isNotEmpty(),
                onClick = {
                    val amt = amountText.replace(",", ".").toDoubleOrNull() ?: 0.0
                    val inst = (installmentsText.toIntOrNull() ?: 1).coerceIn(1, 48)
                    if (amt > 0 && description.isNotBlank() && selectedAccountId.isNotBlank()) {
                        onSave(
                            type, amt, description, selectedCategoryId, selectedAccountId,
                            toAccountId, Formatters.todayIso(), status, inst, ""
                        )
                    }
                }
            ) { Text("Salvar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

@Composable
private fun NewAccountDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, Double, Double, Int, Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("checking") }
    var institution by remember { mutableStateOf("") }
    var balanceText by remember { mutableStateOf("0") }
    var limitText by remember { mutableStateOf("5000") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nova Conta / Cartão") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("checking" to "Corrente", "investment" to "Invest.", "credit" to "Cartão").forEach { (id, lbl) ->
                        FilterChip(selected = type == id, onClick = { type = id }, label = { Text(lbl) })
                    }
                }
                OutlinedTextField(
                    value = institution,
                    onValueChange = { institution = it },
                    label = { Text("Instituição") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = balanceText,
                    onValueChange = { balanceText = it },
                    label = { Text(if (type == "credit") "Fatura Atual" else "Saldo Atual") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                if (type == "credit") {
                    OutlinedTextField(
                        value = limitText,
                        onValueChange = { limitText = it },
                        label = { Text("Limite Total") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                if (name.isNotBlank()) {
                    val bal = balanceText.replace(",", ".").toDoubleOrNull() ?: 0.0
                    val lim = limitText.replace(",", ".").toDoubleOrNull() ?: 0.0
                    onSave(name, type, institution, bal, lim, 3, 10)
                }
            }) { Text("Salvar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}
