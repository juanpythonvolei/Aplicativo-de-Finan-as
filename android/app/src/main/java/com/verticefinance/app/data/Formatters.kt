package com.verticefinance.app.data

import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

object Formatters {
    private val ptBr = Locale("pt", "BR")

    fun currency(value: Double, code: String = "BRL"): String {
        val locale = when (code) {
            "USD" -> Locale.US
            "EUR" -> Locale.GERMANY
            else -> ptBr
        }
        return NumberFormat.getCurrencyInstance(locale).format(value)
    }

    fun currentMonthKey(): String = YearMonth.now().toString()

    fun todayIso(): String = LocalDate.now().toString()

    fun shiftMonth(monthKey: String, delta: Long): String {
        return YearMonth.parse(monthKey).plusMonths(delta).toString()
    }

    fun formatMonthLabel(monthKey: String): String {
        val ym = YearMonth.parse(monthKey)
        val raw = ym.format(DateTimeFormatter.ofPattern("MMMM yyyy", ptBr))
        return raw.replaceFirstChar { it.uppercase() }
    }

    fun formatShortDate(isoDate: String): String {
        return try {
            val d = LocalDate.parse(isoDate)
            d.format(DateTimeFormatter.ofPattern("dd MMM", ptBr))
        } catch (_: Exception) {
            isoDate
        }
    }

    fun addMonthsToIso(isoDate: String, months: Long): String {
        return LocalDate.parse(isoDate).plusMonths(months).toString()
    }

    fun safeId(prefix: String): String {
        val token = UUID.randomUUID().toString().replace("-", "").take(12)
        return "${prefix}_${System.currentTimeMillis()}_$token"
    }
}
