package com.kiapat.mobile.data.repository

import android.util.Base64
import java.nio.charset.StandardCharsets
import com.kiapat.mobile.data.api.KiapatApi
import com.kiapat.mobile.data.local.SessionPreferences
import com.kiapat.mobile.data.model.Token
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

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

    suspend fun validateSession(): SessionPreferences.SessionState? {
        val session = preferences.getSession()
        val accessToken = session.accessToken ?: return null

        if (isTokenExpired(accessToken)) {
            preferences.clear()
            return null
        }

        return runCatching { api.me() }
            .map { user ->
                preferences.updateRole(user.role)
                SessionPreferences.SessionState(accessToken, user.role)
            }
            .getOrElse {
                preferences.clear()
                null
            }
    }

    private fun isTokenExpired(token: String): Boolean {
        val parts = token.split(".")
        if (parts.size < 2) return true

        val payload = runCatching {
            val decoded = Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            val json = decoded.toString(StandardCharsets.UTF_8)
            Json { ignoreUnknownKeys = true }.decodeFromString(JwtPayload.serializer(), json)
        }.getOrNull() ?: return true

        val exp = payload.exp ?: return true
        val nowInSeconds = System.currentTimeMillis() / 1000
        return exp <= nowInSeconds
    }
}

@Serializable
private data class JwtPayload(val exp: Long? = null)
