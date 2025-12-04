package com.kiapat.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp

@Composable
fun SignaturePad(
    strokes: List<List<Offset>>,
    onStrokeCaptured: (List<Offset>) -> Unit,
    onPadSizeChanged: (IntSize) -> Unit,
    modifier: Modifier = Modifier,
) {
    val currentStroke = remember { mutableStateOf<List<Offset>>(emptyList()) }
    val backgroundColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    val padSizeState = remember { mutableStateOf(IntSize.Zero) }

    // Move the color declaration here, into the @Composable context
    val strokeColor = MaterialTheme.colorScheme.onSurface

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(200.dp)
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
                shape = RoundedCornerShape(12.dp),
            )
            .background(backgroundColor, RoundedCornerShape(12.dp))
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { offset ->
                        currentStroke.value = listOf(offset.clampWithin(padSizeState.value))
                    },
                    onDrag = { change, _ ->
                        currentStroke.value = currentStroke.value + listOf(change.position.clampWithin(padSizeState.value))
                    },
                    onDragEnd = {
                        if (currentStroke.value.isNotEmpty()) {
                            onStrokeCaptured(currentStroke.value)
                        }
                        currentStroke.value = emptyList()
                    },
                    onDragCancel = { currentStroke.value = emptyList() },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .padding(8.dp)
            .background(Color.Transparent)
            .onSizeChanged {
                padSizeState.value = it
                onPadSizeChanged(it)
            }
        ) {
            // This is the DrawScope
            val strokeStyle = Stroke(width = 8f, cap = StrokeCap.Round, join = StrokeJoin.Round)

            fun drawStroke(points: List<Offset>) {
                if (points.isEmpty()) return
                val path = Path().apply {
                    moveTo(points.first().x, points.first().y)
                    points.drop(1).forEach { lineTo(it.x, it.y) }
                }
                // Use the strokeColor variable that was declared outside
                drawPath(path = path, color = strokeColor, style = strokeStyle)
            }

            strokes.forEach { drawStroke(it) }
            drawStroke(currentStroke.value)
        }

        if (strokes.isEmpty() && currentStroke.value.isEmpty()) {
            Text(
                text = "Sign here",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private fun Offset.clampWithin(bounds: IntSize): Offset {
    if (bounds == IntSize.Zero) return this
    val xClamped = x.coerceIn(0f, bounds.width.toFloat())
    val yClamped = y.coerceIn(0f, bounds.height.toFloat())
    return copy(x = xClamped, y = yClamped)
}
