"""add requested unit column to invoice overrides

Revision ID: 2c650f78c0d1
Revises: a990ce0bdb49
Create Date: 2025-02-17 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "2c650f78c0d1"
down_revision: Union[str, None] = "a990ce0bdb49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.add_column(
        "invoice_overrides",
        sa.Column(
            "requested_unit",
            sa.Enum("TRAY", "DOZEN", "PCS", name="unitenum"),
            nullable=False,
            server_default="PCS",
        ),
    )

    if dialect == "postgresql":
        op.alter_column(
            "invoice_overrides", "requested_unit", server_default=None
        )


def downgrade() -> None:
    op.drop_column("invoice_overrides", "requested_unit")

