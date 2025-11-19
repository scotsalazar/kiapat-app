"""add gps coordinates to invoices

Revision ID: 1b927011fe5c
Revises: 2c650f78c0d1
Create Date: 2024-05-21 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1b927011fe5c"
down_revision: Union[str, None] = "2c650f78c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("gps_coordinates", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("invoices", "gps_coordinates")
