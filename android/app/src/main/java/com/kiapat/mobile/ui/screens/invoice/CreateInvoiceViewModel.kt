package com.kiapat.mobile.ui.screens.invoice

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.util.Base64
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.IntSize
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kiapat.mobile.data.model.ClassificationOut
import com.kiapat.mobile.data.model.InvoiceCreate
import com.kiapat.mobile.data.model.InvoiceItemCreate
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.model.PriceOut
import com.kiapat.mobile.data.repository.InvoiceRepository
import java.io.ByteArrayOutputStream
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val VAT_RATE = 0.12

data class PricedClassification(
    val priceId: Int,
    val classification: ClassificationOut,
    val price: PriceOut,
) {
    val label: String
        get() {
            val size = classification.size.name
            val color = classification.color.name.lowercase().replaceFirstChar { it.titlecase(Locale.getDefault()) }
            val unit = price.unit.name.lowercase().replaceFirstChar { it.titlecase(Locale.getDefault()) }
            return "$size • $color • $unit"
        }
}

data class InvoiceLineInput(
    val selectedPriceId: Int? = null,
    val quantity: String = "1",
)

data class CreateInvoiceState(
    val pricedClassifications: List<PricedClassification> = emptyList(),
    val items: List<InvoiceLineInput> = emptyList(),
    val customerName: String = "",
    val customerPhone: String = "",
    val gpsCoordinates: String = "",
    val isFetchingLocation: Boolean = false,
    val locationError: String? = null,
    val signatureStrokes: List<List<Offset>> = emptyList(),
    val signaturePadSize: IntSize = IntSize.Zero,
    val tenderedAmount: String = "",
    val subtotal: Double = 0.0,
    val vatAmount: Double = 0.0,
    val grandTotal: Double = 0.0,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val createdInvoice: InvoiceOut? = null,
    val step: InvoiceStep = InvoiceStep.Details,
)

enum class InvoiceStep { Details, Preview }

class CreateInvoiceViewModel(private val repository: InvoiceRepository) : ViewModel() {
    private val _state = MutableStateFlow(CreateInvoiceState())
    val state: StateFlow<CreateInvoiceState> = _state

    fun loadCatalog() {
        if (_state.value.isLoading || _state.value.pricedClassifications.isNotEmpty()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val classifications = repository.listClassifications()
                val prices = repository.listPrices()
                val priced = prices.mapNotNull { price ->
                    classifications.find { it.id == price.classificationId }?.let { classification ->
                        PricedClassification(price.id, classification, price)
                    }
                }.sortedBy { it.label }

                val initialItems = if (priced.isNotEmpty()) listOf(InvoiceLineInput(selectedPriceId = priced.first().priceId)) else emptyList()

                _state.value = _state.value.copy(
                    pricedClassifications = priced,
                    items = initialItems,
                    isLoading = false,
                    error = null,
                ).withTotals(priced)
            } catch (ex: Exception) {
                _state.value = _state.value.copy(error = ex.message, isLoading = false)
            }
        }
    }

    fun updateCustomerName(value: String) {
        _state.value = _state.value.copy(customerName = value)
    }

    fun updateCustomerPhone(value: String) {
        _state.value = _state.value.copy(customerPhone = value)
    }

    fun updateGpsCoordinates(value: String?) {
        _state.value = _state.value.copy(gpsCoordinates = value.orEmpty(), locationError = null)
    }

    fun setLocationLoading(loading: Boolean) {
        _state.value = _state.value.copy(isFetchingLocation = loading)
    }

    fun setLocationError(message: String?) {
        _state.value = _state.value.copy(locationError = message)
    }

    fun recordSignatureStroke(points: List<Offset>) {
        _state.value = _state.value.copy(
            signatureStrokes = _state.value.signatureStrokes + listOf(points),
            error = null,
        )
    }

    fun clearSignature() {
        _state.value = _state.value.copy(signatureStrokes = emptyList())
    }

    fun updateSignaturePadSize(size: IntSize) {
        if (size != _state.value.signaturePadSize) {
            _state.value = _state.value.copy(signaturePadSize = size)
        }
    }

    fun updateTenderedAmount(value: String) {
        _state.value = _state.value.copy(tenderedAmount = value)
    }

    fun proceedToPreview() {
        val pricedMap = _state.value.pricedClassifications.associateBy { it.priceId }
        val hasValidLine = _state.value.items.any { line ->
            val price = line.selectedPriceId?.let { pricedMap[it] }
            val qty = line.quantity.toIntOrNull() ?: 0
            price != null && qty > 0
        }

        if (!hasValidLine) {
            _state.value = _state.value.copy(
                error = "Add at least one item with a quantity greater than zero",
                step = InvoiceStep.Details,
            )
            return
        }

        _state.value = _state.value.copy(step = InvoiceStep.Preview, error = null)
    }

    fun editDetails() {
        _state.value = _state.value.copy(step = InvoiceStep.Details)
    }

    fun addLine() {
        val items = _state.value.items + InvoiceLineInput(selectedPriceId = _state.value.pricedClassifications.firstOrNull()?.priceId)
        _state.value = _state.value.copy(items = items).withTotals(_state.value.pricedClassifications)
    }

    fun removeLine(index: Int) {
        val updated = _state.value.items.toMutableList().apply { removeAt(index) }
        _state.value = _state.value.copy(items = updated).withTotals(_state.value.pricedClassifications)
    }

    fun updateLineSelection(index: Int, priceId: Int) {
        val updated = _state.value.items.toMutableList()
        updated[index] = updated[index].copy(selectedPriceId = priceId)
        _state.value = _state.value.copy(items = updated).withTotals(_state.value.pricedClassifications)
    }

    fun updateLineQuantity(index: Int, quantity: String) {
        val sanitized = quantity.filter { it.isDigit() }
        val updated = _state.value.items.toMutableList()
        updated[index] = updated[index].copy(quantity = sanitized.ifEmpty { "0" })
        _state.value = _state.value.copy(items = updated).withTotals(_state.value.pricedClassifications)
    }

    fun submit() {
        viewModelScope.launch {
            if (_state.value.isSubmitting) return@launch
            val pricedMap = _state.value.pricedClassifications.associateBy { it.priceId }
            val lineItems = _state.value.items.mapNotNull { line ->
                val price = line.selectedPriceId?.let { pricedMap[it] }
                val qty = line.quantity.toIntOrNull() ?: 0
                if (price != null && qty > 0) {
                    InvoiceItemCreate(
                        classificationId = price.price.classificationId,
                        qty = qty,
                        unit = price.price.unit,
                    )
                } else {
                    null
                }
            }

            if (lineItems.isEmpty()) {
                _state.value = _state.value.copy(error = "Add at least one item with a quantity greater than zero")
                return@launch
            }

            val signatureBase64 = encodeSignature()
            if (signatureBase64 == null) {
                _state.value = _state.value.copy(
                    error = "Please capture the customer's signature before creating an invoice.",
                    isSubmitting = false,
                )
                return@launch
            }

            _state.value = _state.value.copy(isSubmitting = true, error = null)
            try {
                val invoice = repository.createInvoice(
                    InvoiceCreate(
                        customerName = _state.value.customerName.ifBlank { null },
                        customerPhone = _state.value.customerPhone.ifBlank { null },
                        gpsCoordinates = _state.value.gpsCoordinates.ifBlank { null },
                        items = lineItems,
                        signaturePngBase64 = signatureBase64,
                    ),
                )
                _state.value = _state.value.copy(createdInvoice = invoice, isSubmitting = false)
            } catch (ex: Exception) {
                _state.value = _state.value.copy(error = ex.message, isSubmitting = false)
            }
        }
    }

    fun consumeCreatedInvoice() {
        _state.value = _state.value.copy(createdInvoice = null)
    }

    private fun CreateInvoiceState.withTotals(priced: List<PricedClassification>): CreateInvoiceState {
        val pricedMap = priced.associateBy { it.priceId }
        val subtotal = items.sumOf { line ->
            val qty = line.quantity.toIntOrNull() ?: 0
            val price = line.selectedPriceId?.let { pricedMap[it]?.price?.pricePerUnit } ?: 0.0
            qty * price
        }
        val vat = subtotal * VAT_RATE
        val total = subtotal + vat
        return copy(subtotal = subtotal, vatAmount = vat, grandTotal = total)
    }

    private fun encodeSignature(): String? {
        val strokes = _state.value.signatureStrokes
        val padSize = _state.value.signaturePadSize
        if (strokes.isEmpty()) return null

        val width = if (padSize.width > 0) padSize.width else 720
        val height = if (padSize.height > 0) padSize.height else 320

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(android.graphics.Color.WHITE)

        val paint = Paint().apply {
            color = android.graphics.Color.parseColor("#0F172A")
            strokeWidth = 8f
            isAntiAlias = true
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }

        strokes.forEach { stroke ->
            if (stroke.isNotEmpty()) {
                val path = android.graphics.Path().apply {
                    moveTo(stroke.first().x, stroke.first().y)
                    stroke.drop(1).forEach { point ->
                        lineTo(point.x, point.y)
                    }
                }
                canvas.drawPath(path, paint)
            }
        }

        return ByteArrayOutputStream().use { stream ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        }
    }
}

class CreateInvoiceViewModelFactory(private val repository: InvoiceRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(CreateInvoiceViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return CreateInvoiceViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
