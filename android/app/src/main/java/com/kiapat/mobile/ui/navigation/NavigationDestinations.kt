package com.kiapat.mobile.ui.navigation

sealed class AppDestination(val route: String) {
    object Login : AppDestination("login")
    object Dashboard : AppDestination("dashboard")
    object DriverInvoices : AppDestination("driver_invoices")
    object CreateInvoice : AppDestination("driver_invoices/create")
    object DriverInvoiceReceipt : AppDestination("driver_invoices/{invoiceId}/receipt") {
        fun createRoute(invoiceId: Int, tendered: Double?): String {
            val tenderedQuery = tendered?.let { "?tendered=$it" } ?: ""
            return "driver_invoices/$invoiceId/receipt$tenderedQuery"
        }
    }
}
