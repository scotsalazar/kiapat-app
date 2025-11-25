package com.kiapat.mobile.data.repository

import com.kiapat.mobile.data.model.ErrorResponse
import java.io.IOException
import kotlinx.serialization.json.Json
import retrofit2.HttpException

object ApiErrorMapper {
    private val json = Json { ignoreUnknownKeys = true }

    fun map(error: Throwable): String {
        return when (error) {
            is HttpException -> {
                val status = error.code()
                val messageFromBody = error.response()?.errorBody()?.string()?.let { body ->
                    runCatching { json.decodeFromString(ErrorResponse.serializer(), body).message }.getOrNull()
                }

                when (status) {
                    401 -> "Invalid username or password"
                    500 -> "Server error, try again later"
                    else -> messageFromBody ?: "Request failed with code $status"
                }
            }
            is IOException -> "Cannot connect to server"
            else -> error.message ?: "Unexpected error"
        }
    }

    suspend fun <T> safeApiCall(block: suspend () -> T): T {
        return try {
            block()
        } catch (t: Throwable) {
            throw Exception(map(t))
        }
    }
}
