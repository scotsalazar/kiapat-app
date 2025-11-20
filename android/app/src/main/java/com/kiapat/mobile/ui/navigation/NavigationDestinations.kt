package com.kiapat.mobile.ui.navigation

sealed class AppDestination(val route: String) {
    object Login : AppDestination("login")
    object Dashboard : AppDestination("dashboard")
    object DriverInvoices : AppDestination("driver_invoices")
}
