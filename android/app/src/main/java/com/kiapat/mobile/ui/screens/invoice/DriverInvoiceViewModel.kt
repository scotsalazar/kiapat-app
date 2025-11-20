package com.kiapat.mobile.ui.screens.invoice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kiapat.mobile.data.model.InvoiceListResponse
import com.kiapat.mobile.data.repository.InvoiceRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DriverInvoiceState(
    val invoices: InvoiceListResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

class DriverInvoiceViewModel(private val repository: InvoiceRepository) : ViewModel() {
    private val _state = MutableStateFlow(DriverInvoiceState())
    val state: StateFlow<DriverInvoiceState> = _state

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
