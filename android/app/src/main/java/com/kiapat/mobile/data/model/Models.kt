package com.kiapat.mobile.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class RoleEnum {
    @SerialName("admin") ADMIN,
    @SerialName("driver") DRIVER,
}

@Serializable
enum class SizeEnum { S, M, L, XL }

@Serializable
enum class ColorEnum { WHITE }

@Serializable
enum class UnitEnum { TRAY, DOZEN, PCS }

@Serializable
enum class MovementType { IN, OUT }

@Serializable
enum class MovementStatus {
    @SerialName("DRAFT") DRAFT,
    @SerialName("VERIFIED") VERIFIED,
    @SerialName("COMMITTED") COMMITTED,
    @SerialName("PENDING_OVERRIDE") PENDING_OVERRIDE,
    @SerialName("REJECTED") REJECTED,
}

@Serializable
enum class InvoiceStatus { COMPLETED, PENDING_OVERRIDE, REJECTED }

@Serializable
enum class OverrideStatus { PENDING, APPROVED, REJECTED }

@Serializable
data class ErrorResponse(
    val code: String,
    val message: String,
    val details: Map<String, String>? = null,
)

@Serializable
data class UserOut(
    val id: Int,
    val name: String,
    val username: String,
    val email: String? = null,
    val role: RoleEnum,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class Token(
    @SerialName("access_token") val accessToken: String,
    @SerialName("token_type") val tokenType: String = "bearer",
    val user: UserOut,
)

@Serializable
data class ClassificationOut(
    val id: Int,
    val size: SizeEnum,
    val color: ColorEnum,
    @SerialName("is_active") val isActive: Boolean,
)

@Serializable
data class ClassificationCreate(
    val size: SizeEnum,
    val color: ColorEnum,
)

@Serializable
data class ClassificationUpdate(
    val size: SizeEnum? = null,
    val color: ColorEnum? = null,
)

@Serializable
data class PriceOut(
    val id: Int,
    @SerialName("classification_id") val classificationId: Int,
    val unit: UnitEnum,
    @SerialName("price_per_unit") val pricePerUnit: Double,
    @SerialName("effective_from") val effectiveFrom: String,
    @SerialName("effective_to") val effectiveTo: String? = null,
)

@Serializable
data class PriceCreate(
    @SerialName("classification_id") val classificationId: Int,
    val unit: UnitEnum,
    @SerialName("price_per_unit") val pricePerUnit: Double,
    @SerialName("effective_from") val effectiveFrom: String? = null,
    @SerialName("effective_to") val effectiveTo: String? = null,
)

@Serializable
data class PriceUpdate(
    @SerialName("price_per_unit") val pricePerUnit: Double? = null,
    @SerialName("effective_from") val effectiveFrom: String? = null,
    @SerialName("effective_to") val effectiveTo: String? = null,
)

@Serializable
data class MovementOut(
    val id: Int,
    val type: MovementType,
    @SerialName("classification_id") val classificationId: Int,
    @SerialName("qty_pcs") val qtyPcs: Int,
    @SerialName("unit_entered") val unitEntered: UnitEnum,
    @SerialName("qty_entered") val qtyEntered: Int,
    @SerialName("by_user_id") val byUserId: Int,
    val status: MovementStatus,
    @SerialName("linked_invoice_id") val linkedInvoiceId: Int? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("committed_at") val committedAt: String? = null,
)

@Serializable
data class InventoryCard(
    @SerialName("classification_id") val classificationId: Int,
    val size: SizeEnum,
    val color: ColorEnum,
    @SerialName("qty_tray") val qtyTray: Double,
    @SerialName("qty_dozen") val qtyDozen: Double,
    @SerialName("qty_pcs") val qtyPcs: Int,
    @SerialName("unit_price") val unitPrice: Double? = null,
    @SerialName("stock_value") val stockValue: Double? = null,
    @SerialName("threshold_pcs") val thresholdPcs: Int? = null,
    @SerialName("is_low") val isLow: Boolean,
)

@Serializable
data class InventoryTotals(
    @SerialName("qty_tray") val qtyTray: Double,
    @SerialName("qty_dozen") val qtyDozen: Double,
    @SerialName("qty_pcs") val qtyPcs: Int,
    @SerialName("stock_value") val stockValue: Double? = null,
)

@Serializable
data class InventorySummary(
    val timestamp: String,
    val totals: InventoryTotals,
    val cards: List<InventoryCard>,
)

@Serializable
data class CreateInMovement(
    @SerialName("classification_id") val classificationId: Int,
    @SerialName("qty") val qty: Int,
    val unit: UnitEnum,
)

@Serializable
data class VerifyMovement(@SerialName("movement_id") val movementId: Int)

@Serializable
data class CommitMovement(@SerialName("movement_id") val movementId: Int)

@Serializable
data class InventoryThresholdOut(
    @SerialName("classification_id") val classificationId: Int,
    @SerialName("threshold_pcs") val thresholdPcs: Int,
)

@Serializable
data class InventoryThresholdUpdate(
    @SerialName("classification_id") val classificationId: Int,
    @SerialName("threshold_pcs") val thresholdPcs: Int,
)

@Serializable
data class InventoryThresholdBulkUpdate(
    val thresholds: List<InventoryThresholdUpdate>,
)

@Serializable
data class ProductOut(
    val id: Int,
    val size: SizeEnum,
    val color: ColorEnum,
    @SerialName("price_per_tray") val pricePerTray: Double? = null,
    @SerialName("price_per_dozen") val pricePerDozen: Double? = null,
    @SerialName("price_per_pcs") val pricePerPcs: Double? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class ProductCreate(
    val size: SizeEnum,
    val color: ColorEnum,
    @SerialName("price_per_tray") val pricePerTray: Double? = null,
    @SerialName("price_per_dozen") val pricePerDozen: Double? = null,
    @SerialName("price_per_pcs") val pricePerPcs: Double? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class ProductUpdate(
    val size: SizeEnum? = null,
    val color: ColorEnum? = null,
    @SerialName("price_per_tray") val pricePerTray: Double? = null,
    @SerialName("price_per_dozen") val pricePerDozen: Double? = null,
    @SerialName("price_per_pcs") val pricePerPcs: Double? = null,
    @SerialName("is_active") val isActive: Boolean? = null,
)

@Serializable
data class InvoiceItemCreate(
    @SerialName("classification_id") val classificationId: Int,
    val qty: Int,
    val unit: UnitEnum,
)

@Serializable
data class InvoiceCreate(
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("gps_coordinates") val gpsCoordinates: String? = null,
    val items: List<InvoiceItemCreate>,
    @SerialName("signature_png_b64") val signaturePngBase64: String? = null,
)

@Serializable
data class InvoiceItemOut(
    val id: Int,
    @SerialName("invoice_id") val invoiceId: Int,
    @SerialName("classification_id") val classificationId: Int,
    val unit: UnitEnum,
    val qty: Int,
    @SerialName("unit_price") val unitPrice: Double,
    @SerialName("line_total") val lineTotal: Double,
    val classification: ClassificationOut? = null,
)

@Serializable
data class InvoiceSummary(
    val id: Int,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("gps_coordinates") val gpsCoordinates: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    val status: InvoiceStatus,
    @SerialName("created_by") val createdBy: Int,
    @SerialName("created_at") val createdAt: String,
    @SerialName("created_by_user") val createdByUser: UserOut? = null,
    @SerialName("receipt_reprint_count") val receiptReprintCount: Int,
)

@Serializable
data class InvoiceOverrideOut(
    val id: Int,
    @SerialName("invoice_id") val invoiceId: Int,
    @SerialName("classification_id") val classificationId: Int,
    @SerialName("requested_qty_pcs") val requestedQtyPcs: Int,
    @SerialName("requested_unit") val requestedUnit: UnitEnum,
    @SerialName("available_qty_pcs") val availableQtyPcs: Int,
    val status: OverrideStatus,
    @SerialName("requested_by_id") val requestedById: Int,
    @SerialName("decided_by_id") val decidedById: Int? = null,
    @SerialName("decision_reason") val decisionReason: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("decided_at") val decidedAt: String? = null,
    val invoice: InvoiceSummary? = null,
    val classification: ClassificationOut? = null,
)

@Serializable
data class InvoiceOut(
    val id: Int,
    @SerialName("customer_name") val customerName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("gps_coordinates") val gpsCoordinates: String? = null,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("signature_png_path") val signaturePngPath: String? = null,
    @SerialName("created_by") val createdBy: Int,
    @SerialName("created_at") val createdAt: String,
    val status: InvoiceStatus,
    @SerialName("created_by_user") val createdByUser: UserOut? = null,
    @SerialName("receipt_reprint_count") val receiptReprintCount: Int,
    val items: List<InvoiceItemOut> = emptyList(),
    val overrides: List<InvoiceOverrideOut> = emptyList(),
)

@Serializable
data class InvoiceListResponse(
    val items: List<InvoiceOut>,
    val total: Int,
    val page: Int,
    @SerialName("page_size") val pageSize: Int,
)

@Serializable
data class OverrideDecision(@SerialName("decision_reason") val decisionReason: String? = null)

@Serializable
data class DailySalesSummary(
    val date: String,
    @SerialName("total_amount") val totalAmount: Double,
    @SerialName("eggs_sold_pcs") val eggsSoldPcs: Int,
    @SerialName("invoice_count") val invoiceCount: Int,
)

@Serializable
data class InventoryTurnoverMetric(
    @SerialName("classification_id") val classificationId: Int,
    val size: SizeEnum,
    val color: ColorEnum,
    @SerialName("total_in_pcs") val totalInPcs: Int,
    @SerialName("total_out_pcs") val totalOutPcs: Int,
    @SerialName("turnover_ratio") val turnoverRatio: Double? = null,
)

@Serializable
data class CumulativeEggsSold(
    @SerialName("total_eggs_pcs") val totalEggsPcs: Int,
    @SerialName("total_eggs_tray") val totalEggsTray: Double,
    @SerialName("total_eggs_dozen") val totalEggsDozen: Double,
)

@Serializable
data class UserCreate(
    val name: String,
    val username: String,
    val email: String? = null,
    val password: String,
    val role: RoleEnum,
)

@Serializable
data class UserUpdate(
    val name: String? = null,
    val email: String? = null,
    val role: RoleEnum? = null,
)

@Serializable
data class PasswordResetRequest(
    @SerialName("new_password") val newPassword: String,
)
