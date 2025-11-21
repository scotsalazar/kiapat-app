package com.kiapat.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.kiapat.mobile.data.model.RoleEnum
import com.kiapat.mobile.ui.screens.dashboard.DashboardScreen
import com.kiapat.mobile.ui.screens.dashboard.DashboardViewModel
import com.kiapat.mobile.ui.screens.dashboard.DashboardViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.CreateInvoiceScreen
import com.kiapat.mobile.ui.screens.invoice.CreateInvoiceViewModel
import com.kiapat.mobile.ui.screens.invoice.CreateInvoiceViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceScreen
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceViewModel
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.InvoiceOutWithTender
import com.kiapat.mobile.ui.screens.invoice.ReceiptScreen
import com.kiapat.mobile.ui.screens.invoice.ReceiptViewModel
import com.kiapat.mobile.ui.screens.invoice.ReceiptViewModelFactory
import com.kiapat.mobile.ui.screens.login.LoginScreen
import com.kiapat.mobile.ui.screens.login.LoginViewModel
import com.kiapat.mobile.ui.screens.login.LoginViewModelFactory

@Composable
fun AppNavHost(
    navController: NavHostController,
    startDestination: AppDestination,
    loginFactory: LoginViewModelFactory,
    dashboardFactory: DashboardViewModelFactory,
    driverInvoiceFactory: DriverInvoiceViewModelFactory,
    createInvoiceFactory: CreateInvoiceViewModelFactory,
    receiptFactory: ReceiptViewModelFactory,
    onRoleRouted: (RoleEnum) -> Unit,
    modifier: Modifier = Modifier,
) {
    NavHost(navController = navController, startDestination = startDestination.route, modifier = modifier) {
        composable(AppDestination.Login.route) {
            val vm: LoginViewModel = viewModel(factory = loginFactory)
            LoginScreen(viewModel = vm) { result ->
                onRoleRouted(result.role)
            }
        }
        composable(AppDestination.Dashboard.route) {
            val vm: DashboardViewModel = viewModel(factory = dashboardFactory)
            DashboardScreen(viewModel = vm)
        }
        composable(AppDestination.DriverInvoices.route) {
            val vm: DriverInvoiceViewModel = viewModel(factory = driverInvoiceFactory)
            DriverInvoiceScreen(
                viewModel = vm,
                onCreateInvoice = { navController.navigate(AppDestination.CreateInvoice.route) },
                onInvoiceSelected = { invoiceId ->
                    navController.navigate(AppDestination.DriverInvoiceReceipt.createRoute(invoiceId, null))
                },
            )
        }
        composable(AppDestination.CreateInvoice.route) {
            val vm: CreateInvoiceViewModel = viewModel(factory = createInvoiceFactory)
            CreateInvoiceScreen(
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onInvoiceCreated = { result: InvoiceOutWithTender ->
                    navController.navigate(AppDestination.DriverInvoiceReceipt.createRoute(result.invoice.id, result.tendered)) {
                        popUpTo(AppDestination.DriverInvoices.route)
                    }
                },
            )
        }
        composable(
            route = AppDestination.DriverInvoiceReceipt.route + "?tendered={tendered}",
            arguments = listOf(
                navArgument("invoiceId") { type = androidx.navigation.NavType.IntType },
                navArgument("tendered") { type = androidx.navigation.NavType.StringType; nullable = true; defaultValue = null },
            ),
        ) { backStack ->
            val invoiceId = backStack.arguments?.getInt("invoiceId") ?: return@composable
            val tendered = backStack.arguments?.getString("tendered")?.toDoubleOrNull()
            val vm: ReceiptViewModel = viewModel(factory = receiptFactory)
            ReceiptScreen(
                viewModel = vm,
                invoiceId = invoiceId,
                tenderedAmount = tendered,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
