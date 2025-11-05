"""Add invoice override tracking tables and status column"""

from alembic import op
import sqlalchemy as sa


revision = "0002_invoice_overrides"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


invoice_status = sa.Enum(
    "COMPLETED", "PENDING_OVERRIDE", "REJECTED", name="invoicestatus"
)
override_status = sa.Enum("PENDING", "APPROVED", "REJECTED", name="overridestatus")


def upgrade():
    bind = op.get_bind()
    invoice_status.create(bind, checkfirst=True)
    override_status.create(bind, checkfirst=True)

    op.add_column(
        "invoices",
        sa.Column("status", invoice_status, nullable=False, server_default="COMPLETED"),
    )
    op.alter_column("invoices", "status", server_default=None)

    op.create_table(
        "invoice_override_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("status", override_status, nullable=False, server_default="PENDING"),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"], ),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_id"),
    )

    op.create_table(
        "invoice_override_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("override_request_id", sa.Integer(), nullable=False),
        sa.Column("invoice_item_id", sa.Integer(), nullable=False),
        sa.Column("requested_qty_pcs", sa.Integer(), nullable=False),
        sa.Column("available_qty_pcs", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["invoice_item_id"], ["invoice_items.id"], ),
        sa.ForeignKeyConstraint(["override_request_id"], ["invoice_override_requests.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_item_id"),
    )



def downgrade():
    op.drop_table("invoice_override_items")
    op.drop_table("invoice_override_requests")
    op.drop_column("invoices", "status")
    bind = op.get_bind()
    override_status.drop(bind, checkfirst=True)
    invoice_status.drop(bind, checkfirst=True)
