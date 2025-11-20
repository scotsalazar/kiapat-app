package com.kiapat.mobile.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.kiapat.mobile.data.model.RoleEnum
import com.kiapat.mobile.ui.screens.dashboard.DashboardScreen
import com.kiapat.mobile.ui.screens.dashboard.DashboardViewModel
import com.kiapat.mobile.ui.screens.dashboard.DashboardViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceScreen
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceViewModel
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceViewModelFactory
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
            DriverInvoiceScreen(viewModel = vm)
        }
    }
}
