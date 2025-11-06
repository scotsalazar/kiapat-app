"""Add inventory override requests table and extend movement status enum."""

from alembic import op
import sqlalchemy as sa


revision = "0002_override_requests"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


override_status_enum = sa.Enum(
    "PENDING", "APPROVED", "REJECTED", name="overridestatus"
)

def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TYPE movementstatus ADD VALUE IF NOT EXISTS 'PENDING_OVERRIDE'"
        )
        op.execute(
            "ALTER TYPE movementstatus ADD VALUE IF NOT EXISTS 'REJECTED'"
        )

    override_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "inventory_override_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("movement_id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("status", override_status_enum, nullable=False),
        sa.Column("shortage_qty_pcs", sa.Integer(), nullable=False),
        sa.Column("available_qty_pcs", sa.Integer(), nullable=False),
        sa.Column("admin_comment", sa.String(), nullable=True),
        sa.Column("requested_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["movement_id"], ["inventory_movements.id"],),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"],),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"],),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"],),
        sa.UniqueConstraint("movement_id"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("inventory_override_requests")
    bind = op.get_bind()
    override_status_enum.drop(bind, checkfirst=True)
