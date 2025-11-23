package com.kiapat.mobile.ui.screens.invoice

import android.content.Context
import android.print.PrintManager
import android.print.PrintAttributes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Print
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kiapat.mobile.data.model.InvoiceItemOut
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.model.SizeEnum
import java.text.NumberFormat
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptScreen(
    viewModel: ReceiptViewModel,
    invoiceId: Int,
    tenderedAmount: Double?,
    onBack: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(invoiceId, tenderedAmount) {
        viewModel.load(invoiceId, tenderedAmount)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Receipt", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
                },
                actions = {
                    val invoice = state.invoice
                    if (invoice != null) {
                        IconButton(onClick = { triggerPrint(context, invoice, state.tenderedAmount) }) {
                            Icon(Icons.Default.Print, contentDescription = "Print receipt")
                        }
                    }
                },
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState()),
            )
        },
    ) { padding ->
        if (state.isLoading) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.padding(8.dp))
                Text("Loading receipt…", style = MaterialTheme.typography.bodyMedium)
            }
        } else if (state.error != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(state.error ?: "", color = MaterialTheme.colorScheme.error)
            }
        } else {
            state.invoice?.let { invoice ->
                ReceiptContent(
                    invoice = invoice,
                    tenderedAmount = state.tenderedAmount,
                    modifier = Modifier
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.background)
                        .padding(16.dp),
                )
            }
        }
    }
}

@Composable
fun ReceiptContent(invoice: InvoiceOut, tenderedAmount: Double?, modifier: Modifier = Modifier) {
    val currencyFormatter = rememberCurrencyFormatter()
    val tendered = tenderedAmount ?: invoice.totalAmount
    val subtotal = invoice.items.sumOf { it.lineTotal }
    val vatAmount = (invoice.totalAmount - subtotal).takeIf { it > 0 } ?: subtotal * 0.12
    val change = (tendered - invoice.totalAmount).coerceAtLeast(0.0)
    val dateText = formatDate(invoice.createdAt)

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Kiapat Poultry", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Official sale receipt", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Divider()

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Invoice #${invoice.id}", fontWeight = FontWeight.SemiBold)
                Text(dateText, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Customer", fontWeight = FontWeight.SemiBold)
                Text(invoice.customerName ?: "Walk-in", fontWeight = FontWeight.Medium)
            }
            invoice.customerPhone?.takeIf { it.isNotBlank() }?.let { phone ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Contact", fontWeight = FontWeight.SemiBold)
                    Text(phone)
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Status", fontWeight = FontWeight.SemiBold)
                Text(invoice.status.name.replace('_', ' '), fontWeight = FontWeight.Medium)
            }

            Divider()

            invoice.items.forEach { item ->
                LineItemRow(item = item, currencyFormatter = currencyFormatter)
            }

            Divider()

            TotalsRow(label = "Subtotal", value = currencyFormatter.format(subtotal))
            TotalsRow(label = "VAT", value = currencyFormatter.format(vatAmount))
            TotalsRow(label = "Total", value = currencyFormatter.format(invoice.totalAmount), emphasize = true)
            TotalsRow(label = "Tendered", value = currencyFormatter.format(tendered))
            TotalsRow(label = "Change", value = currencyFormatter.format(change), emphasize = true)
        }
    }
}

@Composable
private fun LineItemRow(item: InvoiceItemOut, currencyFormatter: NumberFormat) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                item.classification?.let { formatClassification(it.size, it.color.name) }
                    ?: "Classification ${item.classificationId}",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            Text(
                "${item.unit.name.lowercase().replaceFirstChar { it.titlecase(Locale.getDefault()) }} • Qty ${item.qty}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(currencyFormatter.format(item.unitPrice), style = MaterialTheme.typography.bodyMedium)
            Text(currencyFormatter.format(item.lineTotal), style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun TotalsRow(label: String, value: String, emphasize: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium)
        Text(value, style = if (emphasize) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium, fontWeight = if (emphasize) FontWeight.Bold else FontWeight.Normal)
    }
}

private fun triggerPrint(context: Context, invoice: InvoiceOut, tenderedAmount: Double?) {
    val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
    val adapter = ReceiptPrintAdapter(context, invoice, tenderedAmount)
    printManager.print("Invoice ${invoice.id}", adapter, PrintAttributes.Builder().build())
}

@Composable
private fun rememberCurrencyFormatter(): NumberFormat {
    val locale = Locale.getDefault()
    return remember(locale) { NumberFormat.getCurrencyInstance(locale) }
}

private fun formatDate(raw: String): String {
    return runCatching {
        OffsetDateTime.parse(raw).format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM))
    }.getOrElse { raw }
}

private fun formatClassification(size: SizeEnum, color: String): String {
    val colorName = color.lowercase().replaceFirstChar { it.titlecase(Locale.getDefault()) }
    return "${size.name} • $colorName"
}
