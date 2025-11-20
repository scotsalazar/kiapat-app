package com.kiapat.mobile.data.repository

import com.kiapat.mobile.data.api.KiapatApi
import com.kiapat.mobile.data.local.SessionPreferences
import com.kiapat.mobile.data.model.Token
import kotlinx.coroutines.flow.Flow

class AuthRepository(
    private val api: KiapatApi,
    private val preferences: SessionPreferences,
) {
    val sessionFlow: Flow<SessionPreferences.SessionState> = preferences.session

    suspend fun login(username: String, password: String): Token {
        val token = api.login(username, password)
        preferences.save(token)
        return token
    }

    suspend fun logout() {
        preferences.clear()
    }
}
