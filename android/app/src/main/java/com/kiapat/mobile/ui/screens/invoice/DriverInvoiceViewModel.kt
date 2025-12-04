package com.kiapat.mobile.ui.screens.invoice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kiapat.mobile.data.model.InvoiceListResponse
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.repository.InvoiceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DriverInvoiceState(
    val invoices: InvoiceListResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedInvoiceId: Int? = null,
    val selectedInvoice: InvoiceOut? = null,
    val isDetailLoading: Boolean = false,
    val detailError: String? = null,
)

class DriverInvoiceViewModel(private val repository: InvoiceRepository) : ViewModel() {
    private val _state = MutableStateFlow(DriverInvoiceState())
    val state: StateFlow<DriverInvoiceState> = _state

    private val invoiceCache = mutableMapOf<Int, InvoiceOut>()

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val invoices = repository.listInvoicesForDriver()
                _state.value = _state.value.copy(invoices = invoices, isLoading = false)
            } catch (ex: Exception) {
                _state.value = _state.value.copy(error = ex.message, isLoading = false)
            }
        }
    }

    fun openInvoice(invoiceId: Int) {
        viewModelScope.launch {
            val cached = invoiceCache[invoiceId]
            if (cached != null) {
                _state.value = _state.value.copy(
                    selectedInvoiceId = invoiceId,
                    selectedInvoice = cached,
                    detailError = null,
                    isDetailLoading = false,
                )
                return@launch
            }

            _state.value = _state.value.copy(
                selectedInvoiceId = invoiceId,
                isDetailLoading = true,
                detailError = null,
                selectedInvoice = null,
            )

            try {
                val invoice = repository.getInvoice(invoiceId)
                invoiceCache[invoiceId] = invoice
                _state.value = _state.value.copy(
                    selectedInvoice = invoice,
                    isDetailLoading = false,
                )
            } catch (ex: Exception) {
                _state.value = _state.value.copy(
                    detailError = ex.message,
                    isDetailLoading = false,
                )
            }
        }
    }

    fun closeInvoice() {
        _state.value = _state.value.copy(
            selectedInvoiceId = null,
            selectedInvoice = null,
            detailError = null,
            isDetailLoading = false,
        )
    }
}

class DriverInvoiceViewModelFactory(private val repository: InvoiceRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(DriverInvoiceViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return DriverInvoiceViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
