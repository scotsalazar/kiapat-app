package com.kiapat.mobile.ui.screens.invoice

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.location.Location
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntSize
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Task
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.ui.components.PrimaryButton
import com.kiapat.mobile.ui.components.SignaturePad
import java.text.NumberFormat
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateInvoiceScreen(
    viewModel: CreateInvoiceViewModel,
    onBack: () -> Unit,
    onInvoiceCreated: (InvoiceOutWithTender) -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val numberFormatter = remember { NumberFormat.getCurrencyInstance() }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val locationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    val requestLocationPermissions = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        val granted = permissions.values.any { it }
        if (granted) {
            coroutineScope.launch { fetchAndSetLocation(locationClient, viewModel) }
        } else {
            viewModel.setLocationError("Location permission is required to attach GPS coordinates.")
        }
    }

    val refreshLocation: () -> Unit = remember(viewModel, context) {
        {
            val hasFine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
            val hasCoarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

            if (hasFine || hasCoarse) {
                coroutineScope.launch { fetchAndSetLocation(locationClient, viewModel) }
            } else {
                requestLocationPermissions.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                )
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadCatalog()
        refreshLocation()
    }

    LaunchedEffect(state.createdInvoice) {
        val invoice = state.createdInvoice ?: return@LaunchedEffect
        onInvoiceCreated(InvoiceOutWithTender(invoice, state.tenderedAmount.toDoubleOrNull()))
        viewModel.consumeCreatedInvoice()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("New Invoice", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                ),
                scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior(rememberTopAppBarState()),
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background),
        ) {
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
                when (state.step) {
                    InvoiceStep.Details -> InvoiceDetailsPage(
                        state = state,
                        numberFormatter = numberFormatter,
                        onAddLine = viewModel::addLine,
                        onRemoveLine = viewModel::removeLine,
                        onUpdateLineSelection = viewModel::updateLineSelection,
                        onUpdateLineQuantity = viewModel::updateLineQuantity,
                        onUpdateCustomerName = viewModel::updateCustomerName,
                        onUpdateCustomerPhone = viewModel::updateCustomerPhone,
                        onProceed = viewModel::proceedToPreview,
                        refreshLocation = refreshLocation,
                    )

                    InvoiceStep.Preview -> InvoicePreviewPage(
                        state = state,
                        numberFormatter = numberFormatter,
                        onEditDetails = viewModel::editDetails,
                        onRecordSignatureStroke = viewModel::recordSignatureStroke,
                        onUpdatePadSize = viewModel::updateSignaturePadSize,
                        onClearSignature = viewModel::clearSignature,
                        onSubmit = viewModel::submit,
                        onUpdateTender = viewModel::updateTenderedAmount,
                    )
                }
            }
        }
    }
}

@Composable
private fun InvoiceDetailsPage(
    state: CreateInvoiceState,
    numberFormatter: NumberFormat,
    onAddLine: () -> Unit,
    onRemoveLine: (Int) -> Unit,
    onUpdateLineSelection: (Int, Int) -> Unit,
    onUpdateLineQuantity: (Int, String) -> Unit,
    onUpdateCustomerName: (String) -> Unit,
    onUpdateCustomerPhone: (String) -> Unit,
    onProceed: () -> Unit,
    refreshLocation: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            StepHeader(currentStep = 1)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Customer & items",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Fill in customer info, location, and the items bought before previewing the receipt.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Customer", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = state.customerName,
                        onValueChange = onUpdateCustomerName,
                        label = { Text("Name (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = state.customerPhone,
                        onValueChange = onUpdateCustomerPhone,
                        label = { Text("Phone number") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = state.gpsCoordinates,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("GPS coordinates") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        trailingIcon = {
                            if (state.isFetchingLocation) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                IconButton(onClick = refreshLocation) {
                                    Icon(
                                        Icons.Default.MyLocation,
                                        contentDescription = "Refresh location",
                                    )
                                }
                            }
                        },
                        supportingText = {
                            val message = state.locationError
                                ?: "Location is auto-populated when permission is granted."
                            Text(
                                message,
                                color = if (state.locationError != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        shape = RoundedCornerShape(12.dp),
                    )
                }
            }
        }

        if (state.pricedClassifications.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                ) {
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
                    onSelect = { priceId -> onUpdateLineSelection(index, priceId) },
                    onQuantityChange = { qty -> onUpdateLineQuantity(index, qty) },
                    onRemove = { if (state.items.size > 1) onRemoveLine(index) },
                    currencyFormatter = numberFormatter,
                )
            }
        }

        item {
            OutlinedButton(
                onClick = onAddLine,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(
                    width = 1.dp,
                    color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                ),
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Add another item", style = MaterialTheme.typography.labelLarge)
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
            PrimaryButton(
                text = "Preview invoice",
                onClick = onProceed,
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.error != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    state.error ?: "",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun InvoicePreviewPage(
    state: CreateInvoiceState,
    numberFormatter: NumberFormat,
    onEditDetails: () -> Unit,
    onRecordSignatureStroke: (List<Offset>) -> Unit,
    onUpdatePadSize: (IntSize) -> Unit,
    onClearSignature: () -> Unit,
    onSubmit: () -> Unit,
    onUpdateTender: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            StepHeader(currentStep = 2)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "Preview & signature",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Confirm the items with the customer, capture their signature, and print the receipt.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            InvoicePreviewCard(
                items = state.items,
                pricedClassifications = state.pricedClassifications,
                numberFormatter = numberFormatter,
                grandTotal = state.grandTotal,
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Client signature", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Show this preview to the customer before they sign.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    SignaturePad(
                        strokes = state.signatureStrokes,
                        onStrokeCaptured = onRecordSignatureStroke,
                        onPadSizeChanged = onUpdatePadSize,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedButton(
                            onClick = onClearSignature,
                            enabled = state.signatureStrokes.isNotEmpty(),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Text("Clear signature")
                        }

                        val signatureStatus = if (state.signatureStrokes.isEmpty()) {
                            "Signature required"
                        } else {
                            "Signature captured"
                        }

                        Text(
                            signatureStatus,
                            color = if (state.signatureStrokes.isEmpty()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                            style = MaterialTheme.typography.labelLarge,
                        )
                    }
                }
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedTextField(
                        value = state.tenderedAmount,
                        onValueChange = onUpdateTender,
                        label = { Text("Amount tendered (for change)") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(12.dp),
                    )
                    PrimaryButton(
                        text = "Confirm & print receipt",
                        onClick = onSubmit,
                        modifier = Modifier.fillMaxWidth(),
                        loading = state.isSubmitting,
                    )
                    if (state.error != null) {
                        Text(
                            state.error ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        item {
            OutlinedButton(
                onClick = onEditDetails,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Text("Back to edit details")
            }
        }
    }
}

@Composable
private fun StepHeader(currentStep: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StepBadge(number = 1, active = currentStep == 1)
            StepBadge(number = 2, active = currentStep == 2)
        }
        Text(
            text = "Step $currentStep of 2",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.wrapContentWidth(),
        )
    }
}

@Composable
private fun StepBadge(number: Int, active: Boolean) {
    val background = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (active) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = Modifier
            .size(34.dp)
            .background(background, shape = RoundedCornerShape(10.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f), shape = RoundedCornerShape(10.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = "$number", color = contentColor, style = MaterialTheme.typography.labelLarge)
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
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                shape = RoundedCornerShape(16.dp),
            ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Item ${index + 1}", style = MaterialTheme.typography.titleMedium)
                    Text(
                        selected?.label ?: "Select a classification",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                    shape = RoundedCornerShape(12.dp),
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
                shape = RoundedCornerShape(12.dp),
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
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                shape = RoundedCornerShape(16.dp),
            ),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
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

@Composable
private fun InvoicePreviewCard(
    items: List<InvoiceLineInput>,
    pricedClassifications: List<PricedClassification>,
    numberFormatter: NumberFormat,
    grandTotal: Double,
) {
    val pricedMap = remember(pricedClassifications) { pricedClassifications.associateBy { it.priceId } }
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                shape = RoundedCornerShape(16.dp),
            ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Invoice preview", style = MaterialTheme.typography.titleMedium)
            Text(
                "Show this preview to the customer before capturing their signature.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (items.isEmpty()) {
                Text(
                    "Add items to see a preview of the invoice.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items.forEachIndexed { index, item ->
                        val priced = item.selectedPriceId?.let { pricedMap[it] }
                        val qty = item.quantity.toIntOrNull() ?: 0
                        val lineTotal = priced?.price?.pricePerUnit?.times(qty) ?: 0.0
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    priced?.label ?: "Item ${index + 1}",
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium,
                                )
                                Text(
                                    numberFormatter.format(lineTotal),
                                    style = MaterialTheme.typography.bodyLarge,
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(
                                    if (priced != null) "Qty $qty @ ${numberFormatter.format(priced.price.pricePerUnit)}" else "Pending selection",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (priced == null || qty <= 0) {
                                    Text(
                                        "Incomplete",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.error,
                                    )
                                }
                            }
                        }
                        if (index < items.lastIndex) {
                            Divider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        }
                    }

                    Divider()
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            "Total to collect",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            numberFormatter.format(grandTotal),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}


private suspend fun fetchAndSetLocation(
    locationClient: FusedLocationProviderClient,
    viewModel: CreateInvoiceViewModel,
) {
    viewModel.setLocationLoading(true)
    viewModel.setLocationError(null)
    try {
        val coordinates = resolveCoordinates(locationClient)
        if (coordinates != null) {
            viewModel.updateGpsCoordinates(coordinates)
        } else {
            viewModel.setLocationError("Unable to determine your location right now.")
        }
    } catch (ex: Exception) {
        viewModel.setLocationError(ex.message ?: "Unable to determine your location.")
    } finally {
        viewModel.setLocationLoading(false)
    }
}

private suspend fun resolveCoordinates(locationClient: FusedLocationProviderClient): String? {
    val lastLocation = locationClient.lastLocation.awaitNullableLocation()
    val location = lastLocation ?: locationClient
        .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
        .awaitNullableLocation()

    return location?.let { "${it.latitude},${it.longitude}" }
}

private suspend fun Task<Location?>.awaitNullableLocation(): Location? = suspendCancellableCoroutine { cont ->
    try {
        addOnSuccessListener { location -> cont.resume(location) }
        addOnFailureListener { cont.resume(null) }
        addOnCanceledListener { cont.cancel() }
    } catch (_: SecurityException) {
        cont.resume(null)
    }
}


data class InvoiceOutWithTender(val invoice: InvoiceOut, val tendered: Double?)
