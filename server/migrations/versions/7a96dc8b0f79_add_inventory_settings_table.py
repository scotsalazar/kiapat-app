"""add inventory settings table

Revision ID: 7a96dc8b0f79
Revises: a990ce0bdb49
Create Date: 2024-05-22 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a96dc8b0f79"
down_revision: Union[str, None] = "a990ce0bdb49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("low_stock_threshold_pcs", sa.Integer(), nullable=False, server_default="360"),
    )
    op.execute(
        "INSERT INTO inventory_settings (id, low_stock_threshold_pcs) VALUES (1, 360)"
    )


def downgrade() -> None:
    op.drop_table("inventory_settings")

