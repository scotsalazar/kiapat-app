package com.kiapat.mobile.data.repository

import com.kiapat.mobile.data.api.KiapatApi
import com.kiapat.mobile.data.model.ClassificationOut
import com.kiapat.mobile.data.model.InvoiceCreate
import com.kiapat.mobile.data.model.InvoiceListResponse
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.data.model.PriceOut
import com.kiapat.mobile.data.repository.ApiErrorMapper.safeApiCall

class InvoiceRepository(private val api: KiapatApi) {
    suspend fun listInvoicesForDriver(page: Int = 1, pageSize: Int = 20): InvoiceListResponse =
        safeApiCall { api.listInvoices(page = page, pageSize = pageSize) }

    suspend fun createInvoice(payload: InvoiceCreate): InvoiceOut = safeApiCall { api.createInvoice(payload) }

    suspend fun getInvoice(id: Int): InvoiceOut = safeApiCall { api.getInvoice(id) }

    suspend fun listPrices(): List<PriceOut> = safeApiCall { api.getPrices() }

    suspend fun listClassifications(): List<ClassificationOut> = safeApiCall { api.getClassifications() }
}
