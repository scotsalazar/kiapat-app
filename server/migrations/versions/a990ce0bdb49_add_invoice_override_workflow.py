"""add invoice override workflow

Revision ID: a990ce0bdb49
Revises: 0001_initial
Create Date: 2025-11-05 17:06:57.904616

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a990ce0bdb49"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

invoice_status_enum = sa.Enum(
    "COMPLETED",
    "PENDING_OVERRIDE",
    "REJECTED",
    name="invoicestatus",
)

override_status_enum = sa.Enum(
    "PENDING",
    "APPROVED",
    "REJECTED",
    name="overridestatus",
)


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute("ALTER TYPE movementstatus ADD VALUE IF NOT EXISTS 'PENDING_OVERRIDE'")
        op.execute("ALTER TYPE movementstatus ADD VALUE IF NOT EXISTS 'REJECTED'")
        invoice_status_enum.create(bind, checkfirst=True)
        override_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "invoice_overrides",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("classification_id", sa.Integer(), nullable=False),
        sa.Column("requested_qty_pcs", sa.Integer(), nullable=False),
        sa.Column("available_qty_pcs", sa.Integer(), nullable=False),
        sa.Column("status", override_status_enum, nullable=False),
        sa.Column("requested_by_id", sa.Integer(), nullable=False),
        sa.Column("decided_by_id", sa.Integer(), nullable=True),
        sa.Column("decision_reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["classification_id"], ["classifications.id"]),
        sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["requested_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_overrides_id"), "invoice_overrides", ["id"], unique=False)

    op.add_column(
        "invoices",
        sa.Column(
            "status",
            invoice_status_enum,
            nullable=False,
            server_default="COMPLETED",
        ),
    )
    if dialect == "postgresql":
        op.alter_column("invoices", "status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_column("invoices", "status")
    op.drop_index(op.f("ix_invoice_overrides_id"), table_name="invoice_overrides")
    op.drop_table("invoice_overrides")

    if dialect == "postgresql":
        override_status_enum.drop(bind, checkfirst=False)
        invoice_status_enum.drop(bind, checkfirst=False)
