package com.kiapat.mobile.ui.screens.invoice

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberTopAppBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.ui.components.PrimaryButton
import java.text.NumberFormat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateInvoiceScreen(
    viewModel: CreateInvoiceViewModel,
    onBack: () -> Unit,
    onInvoiceCreated: (InvoiceOutWithTender) -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val numberFormatter = remember { NumberFormat.getCurrencyInstance() }

    LaunchedEffect(Unit) {
        viewModel.loadCatalog()
    }

    LaunchedEffect(state.createdInvoice) {
        val invoice = state.createdInvoice ?: return@LaunchedEffect
        onInvoiceCreated(InvoiceOutWithTender(invoice, state.tenderedAmount.toDoubleOrNull()))
        viewModel.consumeCreatedInvoice()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("New Invoice", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
                },
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState()),
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.isLoading) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Loading prices and classifications…", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Text(
                            "Build invoice",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        Text(
                            "Add customer details and select egg packs to create a polished receipt.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    item {
                        Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors()) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedTextField(
                                    value = state.customerName,
                                    onValueChange = viewModel::updateCustomerName,
                                    label = { Text("Customer name") },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                OutlinedTextField(
                                    value = state.customerPhone,
                                    onValueChange = viewModel::updateCustomerPhone,
                                    label = { Text("Contact number") },
                                    modifier = Modifier.fillMaxWidth(),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                )
                            }
                        }
                    }

                    if (state.pricedClassifications.isEmpty()) {
                        item {
                            Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors()) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text("No active prices", style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        "Add price records from the admin console before creating an invoice.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    } else {
                        itemsIndexed(state.items) { index, line ->
                            InvoiceLineCard(
                                index = index,
                                line = line,
                                pricedClassifications = state.pricedClassifications,
                                onSelect = { priceId -> viewModel.updateLineSelection(index, priceId) },
                                onQuantityChange = { qty -> viewModel.updateLineQuantity(index, qty) },
                                onRemove = { if (state.items.size > 1) viewModel.removeLine(index) },
                                currencyFormatter = numberFormatter,
                            )
                        }
                    }

                    item {
                        OutlinedButton(
                            onClick = viewModel::addLine,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null)
                            Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                            Text("Add another item")
                        }
                    }

                    item {
                        SummarySection(
                            subtotal = state.subtotal,
                            vat = state.vatAmount,
                            total = state.grandTotal,
                            numberFormatter = numberFormatter,
                        )
                    }

                    item {
                        OutlinedTextField(
                            value = state.tenderedAmount,
                            onValueChange = viewModel::updateTenderedAmount,
                            label = { Text("Amount tendered (for change)") },
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        )
                    }

                    item {
                        PrimaryButton(
                            text = "Create invoice",
                            onClick = viewModel::submit,
                            modifier = Modifier.fillMaxWidth(),
                            loading = state.isSubmitting,
                        )
                        if (state.error != null) {
                            Text(
                                state.error ?: "",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvoiceLineCard(
    index: Int,
    line: InvoiceLineInput,
    pricedClassifications: List<PricedClassification>,
    onSelect: (Int) -> Unit,
    onQuantityChange: (String) -> Unit,
    onRemove: () -> Unit,
    currencyFormatter: NumberFormat,
) {
    val expanded = remember { mutableStateOf(false) }
    val selected = pricedClassifications.find { it.priceId == line.selectedPriceId }
    val lineTotal = selected?.let { (line.quantity.toIntOrNull() ?: 0) * it.price.pricePerUnit } ?: 0.0

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Item ${index + 1}", style = MaterialTheme.typography.titleMedium)
                    Text(
                        selected?.label ?: "Select a classification",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (pricedClassifications.size > 1) {
                    IconButton(onClick = onRemove) {
                        Icon(Icons.Default.Delete, contentDescription = "Remove")
                    }
                }
            }

            ExposedDropdownMenuBox(
                expanded = expanded.value,
                onExpandedChange = { expanded.value = !expanded.value },
            ) {
                OutlinedTextField(
                    value = selected?.label ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Egg classification") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded.value) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                DropdownMenu(
                    expanded = expanded.value,
                    onDismissRequest = { expanded.value = false },
                ) {
                    pricedClassifications.forEach { priced ->
                        DropdownMenuItem(
                            text = { Text(priced.label) },
                            onClick = {
                                onSelect(priced.priceId)
                                expanded.value = false
                            },
                            contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                        )
                    }
                }
            }

            OutlinedTextField(
                value = line.quantity,
                onValueChange = onQuantityChange,
                label = { Text("Quantity") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Unit price", style = MaterialTheme.typography.labelLarge)
                Text(selected?.let { currencyFormatter.format(it.price.pricePerUnit) } ?: "-", style = MaterialTheme.typography.bodyLarge)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Line total", style = MaterialTheme.typography.labelLarge)
                Text(currencyFormatter.format(lineTotal), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

@Composable
private fun SummarySection(subtotal: Double, vat: Double, total: Double, numberFormatter: NumberFormat) {
    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Summary", style = MaterialTheme.typography.titleMedium)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Subtotal", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(numberFormatter.format(subtotal))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("VAT (12%)", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(numberFormatter.format(vat))
            }
            Divider()
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(numberFormatter.format(total), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }
    }
}


data class InvoiceOutWithTender(val invoice: InvoiceOut, val tendered: Double?)
