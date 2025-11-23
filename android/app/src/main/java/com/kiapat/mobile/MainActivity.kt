package com.kiapat.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.rememberNavController
import com.kiapat.mobile.BuildConfig
import com.kiapat.mobile.data.api.ApiClient
import com.kiapat.mobile.data.local.SessionPreferences
import com.kiapat.mobile.data.model.RoleEnum
import com.kiapat.mobile.data.repository.AuthRepository
import com.kiapat.mobile.data.repository.DashboardRepository
import com.kiapat.mobile.data.repository.InvoiceRepository
import com.kiapat.mobile.ui.navigation.AppDestination
import com.kiapat.mobile.ui.navigation.AppNavHost
import com.kiapat.mobile.ui.screens.dashboard.DashboardViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.CreateInvoiceViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.DriverInvoiceViewModelFactory
import com.kiapat.mobile.ui.screens.invoice.ReceiptViewModelFactory
import com.kiapat.mobile.ui.screens.login.LoginViewModelFactory
import com.kiapat.mobile.ui.theme.KiapatTheme
import kotlinx.coroutines.flow.MutableStateFlow

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionPreferences = SessionPreferences(applicationContext)
        val tokenState = MutableStateFlow<String?>(null)
        val api = ApiClient.build(BuildConfig.DEFAULT_BASE_URL) { tokenState.value }
        val authRepository = AuthRepository(api, sessionPreferences)
        val dashboardRepository = DashboardRepository(api)
        val invoiceRepository = InvoiceRepository(api)

        setContent {
            KiapatApp(
                authRepository = authRepository,
                dashboardRepository = dashboardRepository,
                invoiceRepository = invoiceRepository,
                tokenState = tokenState,
            )
        }
    }

}

@Composable
private fun KiapatApp(
    authRepository: AuthRepository,
    dashboardRepository: DashboardRepository,
    invoiceRepository: InvoiceRepository,
    tokenState: MutableStateFlow<String?>,
) {
    val session by authRepository.sessionFlow.collectAsState(initial = SessionPreferences.SessionState(null, null))
    val navController = rememberNavController()
    val currentRoute = navController.currentBackStackEntry?.destination?.route

    LaunchedEffect(session.accessToken) {
        tokenState.value = session.accessToken
    }

    val startDestination = when {
        session.accessToken == null -> AppDestination.Login
        session.role == RoleEnum.DRIVER -> AppDestination.DriverInvoices
        else -> AppDestination.Dashboard
    }

    KiapatTheme {
        AppNavHost(
            navController = navController,
            startDestination = startDestination,
            loginFactory = LoginViewModelFactory(authRepository),
            dashboardFactory = DashboardViewModelFactory(dashboardRepository),
            driverInvoiceFactory = DriverInvoiceViewModelFactory(invoiceRepository),
            createInvoiceFactory = CreateInvoiceViewModelFactory(invoiceRepository),
            receiptFactory = ReceiptViewModelFactory(invoiceRepository),
            onRoleRouted = { role ->
                val target = if (role == RoleEnum.DRIVER) AppDestination.DriverInvoices else AppDestination.Dashboard
                if (currentRoute != target.route) {
                    navController.navigate(target.route) {
                        popUpTo(AppDestination.Login.route) { inclusive = true }
                    }
                }
            },
        )
    }
}
