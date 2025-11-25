"""add inventory thresholds

Revision ID: 4f18129af8f1
Revises: a990ce0bdb49
Create Date: 2024-05-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f18129af8f1"
down_revision: Union[str, None] = "a990ce0bdb49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_thresholds",
        sa.Column("classification_id", sa.Integer(), nullable=False),
        sa.Column("threshold_pcs", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["classification_id"], ["classifications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("classification_id"),
    )


def downgrade() -> None:
    op.drop_table("inventory_thresholds")
