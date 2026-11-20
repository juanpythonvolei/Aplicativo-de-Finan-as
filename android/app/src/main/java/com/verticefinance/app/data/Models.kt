package com.verticefinance.app.data

data class AccountDoc(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val type: String = "checking", // checking | savings | wallet | investment | credit
    val institution: String = "",
    val balance: Double = 0.0,
    val creditLimit: Double = 0.0,
    val closingDay: Int = 0,
    val dueDay: Int = 0,
    val color: String = "#0F766E",
    val archived: Boolean = false
)

data class CategoryDoc(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val type: String = "expense", // income | expense
    val icon: String = "Tag",
    val color: String = "#0F766E"
)

data class TransactionDoc(
    val id: String = "",
    val userId: String = "",
    val type: String = "expense", // income | expense | transfer
    val amount: Double = 0.0,
    val description: String = "",
    val categoryId: String = "",
    val accountId: String = "",
    val toAccountId: String = "",
    val date: String = "", // YYYY-MM-DD
    val status: String = "paid", // paid | pending
    val isRecurring: Boolean = false,
    val recurrenceFrequency: String = "none",
    val installmentGroupId: String = "",
    val installmentNumber: Int = 0,
    val installmentTotal: Int = 0,
    val notes: String = ""
)

data class BudgetDoc(
    val id: String = "",
    val userId: String = "",
    val categoryId: String = "",
    val month: String = "", // YYYY-MM
    val amount: Double = 0.0
)

data class GoalDoc(
    val id: String = "",
    val userId: String = "",
    val name: String = "",
    val targetAmount: Double = 0.0,
    val currentAmount: Double = 0.0,
    val deadline: String = "",
    val color: String = "#0F766E",
    val status: String = "active"
)

data class AIConversationDoc(
    val id: String = "",
    val userId: String = "",
    val title: String = "Nova conversa",
    val preview: String = "",
    val messageCount: Int = 0,
    val lastMessageAtMillis: Long = 0L
)

data class AIMessageDoc(
    val id: String = "",
    val userId: String = "",
    val conversationId: String = "",
    val role: String = "user", // user | assistant
    val text: String = "",
    val actionsSummary: List<String> = emptyList(),
    val modelProfileId: String = "",
    val hasImage: Boolean = false,
    val createdAtMillis: Long = 0L
)
