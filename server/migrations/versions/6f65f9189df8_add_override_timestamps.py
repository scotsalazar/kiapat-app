"""add override timestamps to invoices

Revision ID: 6f65f9189df8
Revises: a990ce0bdb49
Create Date: 2025-01-06 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "6f65f9189df8"
down_revision: Union[str, None] = "a990ce0bdb49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("override_requested_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("override_resolved_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "override_resolved_at")
    op.drop_column("invoices", "override_requested_at")

