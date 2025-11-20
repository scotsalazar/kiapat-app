package com.kiapat.mobile.data.repository

import com.kiapat.mobile.data.api.KiapatApi
import com.kiapat.mobile.data.model.InventorySummary
import com.kiapat.mobile.data.model.InvoiceListResponse
import com.kiapat.mobile.data.model.ProductOut
import com.kiapat.mobile.data.model.UserOut

class DashboardRepository(private val api: KiapatApi) {
    suspend fun loadInventorySummary(): InventorySummary = api.inventorySummary()

    suspend fun loadRecentInvoices(): InvoiceListResponse = api.listInvoices(pageSize = 10)

    suspend fun listProducts(): List<ProductOut> = api.listProducts()

    suspend fun listUsers(): List<UserOut> = api.listUsers()
}
