package com.kiapat.mobile.ui.screens.invoice

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.kiapat.mobile.data.model.InvoiceOut
import java.text.NumberFormat
import java.util.Locale
import com.kiapat.mobile.R
import com.kiapat.mobile.data.model.InvoiceItemOut
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.widget.Toast

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverInvoiceScreen(
    viewModel: DriverInvoiceViewModel,
    onCreateInvoice: () -> Unit,
    onViewReceipt: (Int) -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val formatter = rememberCurrencyFormatter()
    val bottomSheetState: SheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
    )

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    val shouldShowSheet =
        state.isDetailLoading || state.detailError != null || state.selectedInvoice != null

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Delivery slips", style = MaterialTheme.typography.titleLarge) },
                actions = {
                    IconButton(onClick = { viewModel.load() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    actionIconContentColor = MaterialTheme.colorScheme.onSurface,
                ),
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState()),
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateInvoice,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                shape = RoundedCornerShape(16.dp),
                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp),
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "New invoice")
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .background(MaterialTheme.colorScheme.background),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Latest deliveries", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

            when {
                state.isLoading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Fetching invoices…", style = MaterialTheme.typography.bodyMedium)
                    }
                }

                state.error != null -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            state.error ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Card(
                            onClick = { viewModel.load() },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = "Retry")
                                Text("Retry", style = MaterialTheme.typography.labelLarge)
                            }
                        }
                    }
                }

                state.invoices?.items.isNullOrEmpty() -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("No invoices assigned yet.", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Tap the + button to issue a new delivery slip.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                else -> {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.invoices?.items.orEmpty()) { invoice ->
                            InvoiceCard(invoice = invoice, formatter = formatter) {
                                viewModel.openInvoice(invoice.id)
                            }
                        }
                    }
                }
            }
        }
    }

    if (shouldShowSheet) {
        ModalBottomSheet(
            onDismissRequest = { viewModel.closeInvoice() },
            sheetState = bottomSheetState,
            containerColor = MaterialTheme.colorScheme.surface,
        ) {
            when {
                state.isDetailLoading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = stringResource(R.string.invoice_loading_details),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }

                state.detailError != null -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = stringResource(R.string.invoice_detail_error_title),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            text = state.detailError ?: "",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(onClick = { viewModel.closeInvoice() }) {
                                Text(stringResource(R.string.close))
                            }
                            TextButton(onClick = {
                                state.selectedInvoiceId?.let { viewModel.openInvoice(it) }
                            }) {
                                Text(stringResource(R.string.try_again))
                            }
                        }
                    }
                }

                state.selectedInvoice != null -> {
                    InvoiceDetailContent(
                        invoice = state.selectedInvoice,
                        formatter = formatter,
                        onViewReceipt = onViewReceipt,
                        onDismiss = { viewModel.closeInvoice() },
                    )
                }
            }
        }
    }
}

@Composable
private fun InvoiceCard(invoice: InvoiceOut, formatter: NumberFormat, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Invoice #${invoice.id}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(invoice.customerName ?: "Walk-in", style = MaterialTheme.typography.bodyMedium)
                }
                Text(formatter.format(invoice.totalAmount), style = MaterialTheme.typography.titleMedium)
            }
            Text(
                "Status: ${invoice.status}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun InvoiceDetailContent(
    invoice: InvoiceOut,
    formatter: NumberFormat,
    onViewReceipt: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val statusText = invoice.status.name
        .replace('_', ' ')
        .lowercase(Locale.getDefault())
        .replaceFirstChar { it.titlecase(Locale.getDefault()) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = stringResource(R.string.invoice_details_title, invoice.id),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = stringResource(R.string.invoice_status_value, statusText),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { onViewReceipt(invoice.id) }) {
                Icon(
                    imageVector = Icons.Default.Visibility,
                    contentDescription = stringResource(R.string.view_receipt),
                )
            }
        }

        InfoRow(
            label = stringResource(R.string.invoice_customer_label),
            value = invoice.customerName ?: stringResource(R.string.invoice_walk_in_placeholder),
        )
        invoice.customerPhone?.takeIf { it.isNotBlank() }?.let { phone ->
            InfoRow(label = stringResource(R.string.invoice_phone_label), value = phone)
        }

        invoice.gpsCoordinates?.takeIf { it.isNotBlank() }?.let { coords ->
            InfoRow(label = stringResource(R.string.invoice_gps_label), value = coords)
        }

        InfoRow(
            label = stringResource(R.string.invoice_total_label),
            value = formatter.format(invoice.totalAmount),
        )

        Text(
            text = stringResource(R.string.invoice_items_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        if (invoice.items.isEmpty()) {
            Text(
                text = stringResource(R.string.invoice_items_empty),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                invoice.items.forEach { item ->
                    InvoiceLineItem(item = item, formatter = formatter)
                    HorizontalDivider()
                }
            }
        }

        Text(
            text = stringResource(R.string.invoice_signature_title),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )

        if (invoice.signatureUrl != null) {
            AsyncImage(
                model = invoice.signatureUrl,
                contentDescription = stringResource(R.string.invoice_signature_content_description),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TextButton(onClick = { downloadSignature(context, invoice.signatureUrl, invoice.id) }) {
                    Text(stringResource(R.string.invoice_signature_download))
                }
                TextButton(onClick = onDismiss) {
                    Text(stringResource(R.string.close))
                }
            }
        } else {
            Text(
                text = stringResource(R.string.invoice_signature_missing),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
        }
    }
}

@Composable
private fun InvoiceLineItem(item: InvoiceItemOut, formatter: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = item.classification?.name ?: stringResource(R.string.invoice_item_unknown),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = stringResource(R.string.invoice_item_qty_label, item.qty, item.unit.name.lowercase()),
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = stringResource(
                R.string.invoice_item_price_label,
                formatter.format(item.unitPrice),
                formatter.format(item.lineTotal),
            ),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

private fun downloadSignature(context: Context, signatureUrl: String, invoiceId: Int) {
    val request = DownloadManager.Request(Uri.parse(signatureUrl))
        .setTitle("invoice_${invoiceId}_signature.png")
        .setDescription(context.getString(R.string.invoice_signature_download_description))
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(
            Environment.DIRECTORY_DOWNLOADS,
            "invoice_${invoiceId}_signature.png",
        )
        .setAllowedOverMetered(true)

    val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
    if (downloadManager != null) {
        downloadManager.enqueue(request)
        Toast.makeText(context, R.string.signature_download_started, Toast.LENGTH_SHORT).show()
    } else {
        Toast.makeText(context, R.string.invoice_signature_download_unavailable, Toast.LENGTH_SHORT).show()
    }
}

@Composable
private fun rememberCurrencyFormatter(): NumberFormat {
    val locale = java.util.Locale.getDefault()
    return androidx.compose.runtime.remember(locale) { NumberFormat.getCurrencyInstance(locale) }
}
