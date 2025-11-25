package com.kiapat.mobile.data.api

import com.kiapat.mobile.data.model.*
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface KiapatApi {
    // Authentication
    @FormUrlEncoded
    @POST("api/auth/login")
    suspend fun login(
        @Field("username") username: String,
        @Field("password") password: String,
    ): Token

    @GET("api/auth/me")
    suspend fun me(): UserOut

    // Admin
    @GET("api/admin/health")
    suspend fun health(): Map<String, String>

    @POST("api/admin/seed")
    suspend fun seed(@Header("seed-token") seedToken: String): Map<String, String>

    // Catalog
    @GET("api/catalog/classifications")
    suspend fun getClassifications(): List<ClassificationOut>

    @POST("api/catalog/classifications")
    suspend fun createClassification(@Body payload: ClassificationCreate): ClassificationOut

    @PUT("api/catalog/classifications/{id}")
    suspend fun updateClassification(
        @Path("id") id: Int,
        @Body payload: ClassificationUpdate,
    ): ClassificationOut

    @POST("api/catalog/classifications/{id}/activate")
    suspend fun activateClassification(@Path("id") id: Int): ClassificationOut

    @POST("api/catalog/classifications/{id}/deactivate")
    suspend fun deactivateClassification(@Path("id") id: Int): ClassificationOut

    @DELETE("api/catalog/classifications/{id}")
    suspend fun deleteClassification(@Path("id") id: Int)

    @GET("api/catalog/prices")
    suspend fun getPrices(): List<PriceOut>

    @POST("api/catalog/prices")
    suspend fun createPrice(@Body payload: PriceCreate): PriceOut

    @PUT("api/catalog/prices/{id}")
    suspend fun updatePrice(
        @Path("id") id: Int,
        @Body payload: PriceUpdate,
    ): PriceOut

    @POST("api/catalog/prices/{id}/activate")
    suspend fun activatePrice(@Path("id") id: Int): PriceOut

    @POST("api/catalog/prices/{id}/deactivate")
    suspend fun deactivatePrice(@Path("id") id: Int): PriceOut

    @DELETE("api/catalog/prices/{id}")
    suspend fun deletePrice(@Path("id") id: Int)

    // Inventory
    @GET("api/inventory/summary")
    suspend fun inventorySummary(
        @Query("size") size: SizeEnum? = null,
        @Query("color") color: ColorEnum? = null,
        @Query("search") search: String? = null,
        @Query("low_stock") lowStock: Boolean = false,
    ): InventorySummary

    @GET("api/inventory/thresholds")
    suspend fun inventoryThresholds(): List<InventoryThresholdOut>

    @PUT("api/inventory/thresholds")
    suspend fun updateThresholds(@Body payload: InventoryThresholdBulkUpdate): List<InventoryThresholdOut>

    @GET("api/inventory/movements")
    suspend fun listMovements(
        @Query("type") type: MovementType? = null,
        @Query("limit") limit: Int = 50,
    ): List<MovementOut>

    @POST("api/inventory/in/create")
    suspend fun createInMovement(@Body payload: CreateInMovement): MovementOut

    @POST("api/inventory/in/verify")
    suspend fun verifyMovement(@Body payload: VerifyMovement): MovementOut

    @POST("api/inventory/in/commit")
    suspend fun commitMovement(@Body payload: CommitMovement): MovementOut

    // Products
    @GET("api/products/")
    suspend fun listProducts(): List<ProductOut>

    @POST("api/products/")
    suspend fun createProduct(@Body payload: ProductCreate): ProductOut

    @PUT("api/products/{id}")
    suspend fun updateProduct(
        @Path("id") id: Int,
        @Body payload: ProductUpdate,
    ): ProductOut

    @DELETE("api/products/{id}")
    suspend fun deleteProduct(@Path("id") id: Int)

    // Sales
    @POST("api/sales/invoices")
    suspend fun createInvoice(@Body payload: InvoiceCreate): InvoiceOut

    @GET("api/sales/invoices/overrides/pending")
    suspend fun listPendingOverrides(): List<InvoiceOverrideOut>

    @POST("api/sales/invoices/{id}/override/approve")
    suspend fun approveOverride(
        @Path("id") invoiceId: Int,
        @Body decision: OverrideDecision? = null,
    ): InvoiceOut

    @POST("api/sales/invoices/{id}/override/reject")
    suspend fun rejectOverride(
        @Path("id") invoiceId: Int,
        @Body decision: OverrideDecision? = null,
    ): InvoiceOut

    @GET("api/sales/invoices")
    suspend fun listInvoices(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
        @Query("customer") customer: String? = null,
        @Query("driver") driver: String? = null,
        @Query("status") status: MovementStatus? = null,
        @Query("invoice_status") invoiceStatus: InvoiceStatus? = null,
    ): InvoiceListResponse

    @GET("api/sales/invoices/{id}")
    suspend fun getInvoice(@Path("id") id: Int): InvoiceOut

    @POST("api/sales/invoices/{id}/reprint")
    suspend fun reprintInvoice(@Path("id") id: Int): InvoiceOut

    // Users
    @GET("api/users/")
    suspend fun listUsers(): List<UserOut>

    @POST("api/users/")
    suspend fun createUser(@Body payload: UserCreate): UserOut

    @PUT("api/users/{id}")
    suspend fun updateUser(
        @Path("id") id: Int,
        @Body payload: UserUpdate,
    ): UserOut

    @DELETE("api/users/{id}")
    suspend fun deleteUser(@Path("id") id: Int)

    @POST("api/users/{id}/reset-password")
    suspend fun resetPassword(
        @Path("id") id: Int,
        @Body payload: PasswordResetRequest,
    ): UserOut

    // Reports
    @GET("api/reports/daily-sales")
    suspend fun dailySales(
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
    ): List<DailySalesSummary>

    @GET("api/reports/inventory-turnover")
    suspend fun inventoryTurnover(
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
    ): List<InventoryTurnoverMetric>

    @GET("api/reports/cumulative-eggs-sold")
    suspend fun cumulativeEggsSold(
        @Query("start_date") startDate: String? = null,
        @Query("end_date") endDate: String? = null,
    ): CumulativeEggsSold
}
