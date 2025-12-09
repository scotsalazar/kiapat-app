package com.kiapat.mobile.ui.screens.invoice

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.pdf.PdfDocument
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.view.View
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kiapat.mobile.data.model.InvoiceOut
import com.kiapat.mobile.ui.theme.KiapatTheme
import java.io.FileOutputStream
import java.io.OutputStream

class ReceiptPrintAdapter(
    private val context: Context,
    private val invoice: InvoiceOut,
    private val tenderedAmount: Double?,
) : PrintDocumentAdapter() {

    private var pageWidth: Int = 0
    private var pageHeight: Int = 0
    private var preparedAttributes: PrintAttributes? = null
    private lateinit var composeView: ComposeView

    fun prepareForPrint(attributes: PrintAttributes) {
        preparedAttributes = attributes
        setupComposeView(attributes)
    }

    private fun setupComposeView(attributes: PrintAttributes) {
        val widthMils = attributes.mediaSize?.widthMils ?: 6120
        pageWidth = (widthMils / 1000f * 72).toInt()

        composeView = ComposeView(context).apply {
            setContent {
                KiapatTheme {
                    ReceiptContent(
                        invoice = invoice,
                        tenderedAmount = tenderedAmount,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                    )
                }
            }
        }

        composeView.measure(
            View.MeasureSpec.makeMeasureSpec(pageWidth, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
        )
        pageHeight = composeView.measuredHeight
    }

    override fun onLayout(
        oldAttributes: PrintAttributes?,
        newAttributes: PrintAttributes,
        cancellationSignal: CancellationSignal,
        callback: LayoutResultCallback,
        extras: android.os.Bundle?,
    ) {
        setupComposeView(preparedAttributes ?: newAttributes)

        val info = PrintDocumentInfo.Builder("invoice_${invoice.id}.pdf")
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(1)
            .build()

        callback.onLayoutFinished(info, true)
    }

    override fun onWrite(
        pages: Array<out PageRange>?,
        destination: ParcelFileDescriptor,
        cancellationSignal: CancellationSignal,
        callback: WriteResultCallback,
    ) {
        renderToPdf(FileOutputStream(destination.fileDescriptor))
            .onSuccess { callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES)) }
            .onFailure { callback.onWriteFailed(it.message) }
    }

    fun renderToPdf(outputStream: OutputStream): Result<Unit> {
        return runCatching {
            if (!::composeView.isInitialized) {
                callbackMissingContent()
            }
            if (pageWidth == 0 || pageHeight == 0) {
                pageWidth = 612
                pageHeight = composeView.measuredHeight.takeIf { it > 0 } ?: 792
            }

            composeView.layout(0, 0, pageWidth, pageHeight)
            val bitmap = Bitmap.createBitmap(pageWidth, pageHeight, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(android.graphics.Color.WHITE)
            composeView.draw(canvas)

            val pdfDocument = PdfDocument()
            val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create()
            val page = pdfDocument.startPage(pageInfo)
            page.canvas.drawBitmap(bitmap, 0f, 0f, null)
            pdfDocument.finishPage(page)

            pdfDocument.writeTo(outputStream)
            pdfDocument.close()
        }
    }

    private fun callbackMissingContent() {
        throw IllegalStateException("Receipt content is not ready")
    }
}
