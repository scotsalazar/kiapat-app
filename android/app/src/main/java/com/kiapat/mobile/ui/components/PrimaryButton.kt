package com.kiapat.mobile.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
) {
    Button(onClick = onClick, modifier = modifier, enabled = !loading) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = text, style = MaterialTheme.typography.labelLarge)
            if (loading) {
                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                CircularProgressIndicator(modifier = Modifier.padding(start = 4.dp), strokeWidth = 2.dp)
            }
        }
    }
}
