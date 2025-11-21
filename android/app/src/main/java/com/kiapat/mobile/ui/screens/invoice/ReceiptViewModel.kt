package com.kiapat.mobile.ui.screens.invoice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.repository.InvoiceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ReceiptState(
    val invoice: InvoiceOut? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val tenderedAmount: Double? = null,
)

class ReceiptViewModel(private val repository: InvoiceRepository) : ViewModel() {
    private val _state = MutableStateFlow(ReceiptState())
    val state: StateFlow<ReceiptState> = _state

    fun load(invoiceId: Int, tendered: Double?) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val invoice = repository.getInvoice(invoiceId)
                _state.value = _state.value.copy(
                    invoice = invoice,
                    tenderedAmount = tendered ?: _state.value.tenderedAmount,
                    isLoading = false,
                )
            } catch (ex: Exception) {
                _state.value = _state.value.copy(error = ex.message, isLoading = false)
            }
        }
    }

    fun refreshTenderedAmount(amount: Double?) {
        _state.value = _state.value.copy(tenderedAmount = amount)
    }
}

class ReceiptViewModelFactory(private val repository: InvoiceRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ReceiptViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ReceiptViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
