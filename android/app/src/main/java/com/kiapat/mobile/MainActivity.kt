package com.kiapat.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import kotlinx.coroutines.launch

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
    var validatedSession by remember { mutableStateOf<SessionPreferences.SessionState?>(null) }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(session.accessToken) {
        tokenState.value = session.accessToken

        if (session.accessToken == null) {
            validatedSession = null
            navController.navigate(AppDestination.Login.route) {
                popUpTo(navController.graph.startDestinationId) { inclusive = true }
                launchSingleTop = true
            }
            return@LaunchedEffect
        }

        val result = authRepository.validateSession()
        validatedSession = result

        if (result == null) {
            tokenState.value = null
            navController.navigate(AppDestination.Login.route) {
                popUpTo(navController.graph.startDestinationId) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    val startDestination = when (validatedSession?.role) {
        RoleEnum.DRIVER -> AppDestination.DriverInvoices
        RoleEnum.ADMIN -> AppDestination.Dashboard
        else -> AppDestination.Login
    }

    LaunchedEffect(validatedSession?.role) {
        validatedSession?.role?.let { role ->
            val target = if (role == RoleEnum.DRIVER) AppDestination.DriverInvoices else AppDestination.Dashboard
            val currentRoute = navController.currentBackStackEntry?.destination?.route
            if (currentRoute != target.route) {
                navController.navigate(target.route) {
                    popUpTo(AppDestination.Login.route) { inclusive = true }
                }
            }
        }
    }

    val onLogout: () -> Unit = {
        coroutineScope.launch {
            validatedSession = null
            authRepository.logout()
            tokenState.value = null
            navController.navigate(AppDestination.Login.route) {
                popUpTo(navController.graph.startDestinationId) { inclusive = true }
                launchSingleTop = true
            }
        }
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
                val currentRoute = navController.currentBackStackEntry?.destination?.route
                if (currentRoute != target.route) {
                    navController.navigate(target.route) {
                        popUpTo(AppDestination.Login.route) { inclusive = true }
                    }
                }
            },
            onLogout = onLogout,
        )
    }
}
