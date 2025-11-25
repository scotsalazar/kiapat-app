package com.kiapat.mobile.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

enum class StatusBannerType { Success, Error, Info }

@Composable
fun StatusBanner(
    message: String,
    type: StatusBannerType,
    modifier: Modifier = Modifier,
) {
    val backgroundColor = when (type) {
        StatusBannerType.Error -> MaterialTheme.colorScheme.error.copy(alpha = 0.12f).compositeWith(Color.White)
        StatusBannerType.Success -> MaterialTheme.colorScheme.tertiary.copy(alpha = 0.16f).compositeWith(Color.White)
        StatusBannerType.Info -> MaterialTheme.colorScheme.primary.copy(alpha = 0.12f).compositeWith(Color.White)
    }

    val contentColor = when (type) {
        StatusBannerType.Error -> MaterialTheme.colorScheme.error
        StatusBannerType.Success -> MaterialTheme.colorScheme.tertiary
        StatusBannerType.Info -> MaterialTheme.colorScheme.primary
    }

    AnimatedVisibility(visible = message.isNotEmpty(), enter = fadeIn()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .background(backgroundColor, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            Text(
                text = message,
                color = contentColor,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun Color.compositeWith(other: Color): Color {
    val alpha = 1 - (1 - alpha) * (1 - other.alpha)
    val red = (red * this.alpha + other.red * other.alpha * (1 - this.alpha)) / alpha
    val green = (green * this.alpha + other.green * other.alpha * (1 - this.alpha)) / alpha
    val blue = (blue * this.alpha + other.blue * other.alpha * (1 - this.alpha)) / alpha
    return Color(red, green, blue, alpha)
}
