package com.kiapat.mobile.ui.screens.invoice

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DriverInvoiceScreen(viewModel: DriverInvoiceViewModel) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(text = "Delivery Slips", style = MaterialTheme.typography.headlineSmall)
        val invoices = state.invoices?.items.orEmpty()
        if (invoices.isEmpty()) {
            Text("No invoices assigned yet.")
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(invoices) { invoice ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Invoice #${invoice.id}", style = MaterialTheme.typography.titleMedium)
                            Text(invoice.customerName ?: "Walk-in", style = MaterialTheme.typography.bodyMedium)
                            Text("Total: ${invoice.totalAmount}")
                            Text("Status: ${invoice.status}")
                        }
                    }
                }
            }
        }
        if (state.error != null) {
            Text(state.error ?: "", color = MaterialTheme.colorScheme.error)
        }
    }
}
