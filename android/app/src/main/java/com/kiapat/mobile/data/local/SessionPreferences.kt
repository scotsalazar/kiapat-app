package com.kiapat.mobile.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.kiapat.mobile.data.model.RoleEnum
import com.kiapat.mobile.data.model.Token
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private const val DATA_STORE_NAME = "kiapat_session"
private val Context.dataStore by preferencesDataStore(name = DATA_STORE_NAME)

class SessionPreferences(private val context: Context) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val roleKey = stringPreferencesKey("role")

    data class SessionState(val accessToken: String?, val role: RoleEnum?)

    val session: Flow<SessionState> = context.dataStore.data.map { prefs ->
        val role = prefs[roleKey]?.let { runCatching { RoleEnum.valueOf(it) }.getOrNull() }
        SessionState(accessToken = prefs[accessTokenKey], role = role)
    }

    suspend fun save(token: Token) {
        context.dataStore.edit { prefs ->
            prefs[accessTokenKey] = token.accessToken
            prefs[roleKey] = token.user.role.name
        }
    }

    suspend fun clear() {
        context.dataStore.edit { prefs ->
            prefs.remove(accessTokenKey)
            prefs.remove(roleKey)
        }
    }
}
