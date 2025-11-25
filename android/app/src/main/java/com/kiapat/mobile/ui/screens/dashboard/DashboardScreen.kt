package com.kiapat.mobile.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.model.InvoiceStatus
import com.kiapat.mobile.data.model.RoleEnum
import com.kiapat.mobile.data.model.UserOut
import com.kiapat.mobile.ui.components.StatusBanner
import com.kiapat.mobile.ui.components.StatusBannerType
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: DashboardViewModel, onLogout: () -> Unit) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.load()
    }

    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "PH"))
    val numberFormatter = NumberFormat.getIntegerInstance()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Admin Dashboard", style = MaterialTheme.typography.titleLarge)
                        Text(
                            text = "Aligned with Kiapat Web",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
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
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(text = "Welcome back", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        text = "Stay on top of sales, inventory, and users at a glance.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    state.error?.let { error ->
                        StatusBanner(
                            message = error,
                            type = StatusBannerType.Error,
                            modifier = Modifier.padding(top = 10.dp),
                        )
                    }
                }
            }

            state.inventory?.let { inventory ->
                item {
                    DashboardCard(title = "Inventory Snapshot") {
                        Text(
                            text = "Updated: ${inventory.timestamp}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            StatBlock(
                                label = "Total stocks",
                                value = numberFormatter.format(inventory.totals.qtyPcs),
                                modifier = Modifier.weight(1f)
                            )
                            StatBlock(
                                label = "Low stock items",
                                value = numberFormatter.format(inventory.cards.count { it.isLow }),
                                modifier = Modifier.weight(1f)
                            )
                            StatBlock(
                                label = "Stock value",
                                value = currencyFormatter.format(inventory.totals.stockValue ?: 0.0),
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item {
                DashboardCard(title = "Key Stats") {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        StatBlock(
                            label = "Total users",
                            value = numberFormatter.format(state.users.size),
                        )
                        StatBlock(
                            label = "Total products",
                            value = numberFormatter.format(state.products.size),
                        )
                        StatBlock(
                            label = "Total vehicles",
                            value = numberFormatter.format(state.users.count { it.role == RoleEnum.DRIVER }),
                        )
                    }
                }
            }

            item {
                DashboardCard(title = "Recent Invoices") {
                    Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                    val invoices = state.invoices?.items.orEmpty()
                    if (invoices.isEmpty()) {
                        Text(
                            "No invoices yet",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 12.dp)) {
                            invoices.take(6).forEach { invoice ->
                                InvoiceRow(invoice = invoice, formatter = currencyFormatter)
                            }
                        }
                    }
                }
            }

            item {
                DashboardCard(title = "Active Products") {
                    state.products.take(5).forEachIndexed { index, product ->
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "${product.size}-${product.color}",
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                product.pricePerTray?.let { "Tray ${currencyFormatter.format(it)}" } ?: "",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.End,
                            )
                        }
                        if (index < state.products.take(5).lastIndex) {
                            Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        }
                    }
                }
            }

            item {
                DashboardCard(title = "User Directory") {
                    state.users.forEachIndexed { index, user ->
                        UserRow(user = user)
                        if (index < state.users.lastIndex) {
                            Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            content()
        }
    }
}

@Composable
private fun StatBlock(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}


@Composable
private fun InvoiceRow(invoice: InvoiceOut, formatter: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Invoice #${invoice.id} - ${invoice.customerName ?: "Walk-in"}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = formatter.format(invoice.totalAmount),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            StatusPill(status = invoice.status)
        }
        Text(
            text = "Created ${invoice.createdAt}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StatusPill(status: InvoiceStatus) {
    val (label, color) = when (status) {
        InvoiceStatus.COMPLETED -> "Completed" to MaterialTheme.colorScheme.tertiary
        InvoiceStatus.PENDING_OVERRIDE -> "Pending" to MaterialTheme.colorScheme.primary
        InvoiceStatus.REJECTED -> "Rejected" to MaterialTheme.colorScheme.error
    }

    Row(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(50))
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, RoundedCornerShape(50)),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = color,
        )
    }
}

@Composable
private fun UserRow(user: UserOut) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(user.name, style = MaterialTheme.typography.bodyLarge)
            Text(user.username, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(user.role.name.lowercase().replaceFirstChar { it.uppercase() }, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
    }
}
