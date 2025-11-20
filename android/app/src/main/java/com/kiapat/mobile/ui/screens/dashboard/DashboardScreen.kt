package com.kiapat.mobile.ui.screens.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun DashboardScreen(viewModel: DashboardViewModel) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = "Admin Dashboard", style = MaterialTheme.typography.headlineSmall)
        state.inventory?.let { inventory ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Inventory Snapshot", style = MaterialTheme.typography.titleMedium)
                    Text("Last updated: ${inventory.timestamp}")
                    Text("Total eggs (pcs): ${inventory.totals.qtyPcs}")
                    Text("Total stock value: ${inventory.totals.stockValue ?: 0.0}")
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Recent Invoices", style = MaterialTheme.typography.titleMedium)
                Divider(modifier = Modifier.padding(vertical = 8.dp))
                val invoices = state.invoices?.items.orEmpty()
                if (invoices.isEmpty()) {
                    Text("No invoices yet")
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(invoices) { invoice ->
                            Column {
                                Text("Invoice #${invoice.id} - ${invoice.customerName ?: "Walk-in"}")
                                Text("Total: ${invoice.totalAmount}", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Active Products", style = MaterialTheme.typography.titleMedium)
                state.products.take(5).forEach { product ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text("${product.size}-${product.color}")
                        Spacer(modifier = Modifier.weight(1f))
                        Text(product.pricePerTray?.let { "Tray $it" } ?: "")
                    }
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("User Directory", style = MaterialTheme.typography.titleMedium)
                Divider(modifier = Modifier.padding(vertical = 8.dp))
                state.users.forEach { user ->
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text(user.name)
                        Spacer(modifier = Modifier.weight(1f))
                        Text(user.role.name)
                    }
                }
            }
        }
        if (state.error != null) {
            Text(text = state.error ?: "", color = MaterialTheme.colorScheme.error)
        }
    }
}
