package com.kiapat.mobile.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.kiapat.mobile.data.model.InventorySummary
import com.kiapat.mobile.data.model.InvoiceListResponse
import com.kiapat.mobile.data.model.ProductOut
import com.kiapat.mobile.data.model.UserOut
import com.kiapat.mobile.data.repository.DashboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class DashboardState(
    val inventory: InventorySummary? = null,
    val invoices: InvoiceListResponse? = null,
    val products: List<ProductOut> = emptyList(),
    val users: List<UserOut> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

class DashboardViewModel(private val repository: DashboardRepository) : ViewModel() {
    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val inventory = repository.loadInventorySummary()
                val invoices = repository.loadRecentInvoices()
                val products = repository.listProducts()
                val users = repository.listUsers()
                _state.value = _state.value.copy(
                    inventory = inventory,
                    invoices = invoices,
                    products = products,
                    users = users,
                    isLoading = false,
                )
            } catch (ex: Exception) {
                _state.value = _state.value.copy(error = ex.message, isLoading = false)
            }
        }
    }
}

class DashboardViewModelFactory(private val repository: DashboardRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(DashboardViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return DashboardViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
