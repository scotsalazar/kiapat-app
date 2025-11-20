"""add receipt reprint count to invoices

Revision ID: f1c2e7e2f6a0
Revises: 1b927011fe5c
Create Date: 2025-05-12 00:00:00.000000

"""

from typing import Union

import sqlalchemy as sa
from alembic import op


revision: str = "f1c2e7e2f6a0"
down_revision: Union[str, None] = "1b927011fe5c"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column(
            "receipt_reprint_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.alter_column(
        "invoices",
        "receipt_reprint_count",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("invoices", "receipt_reprint_count")
