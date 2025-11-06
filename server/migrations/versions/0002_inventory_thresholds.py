"""Add inventory thresholds table"""

from alembic import op
import sqlalchemy as sa

revision = '0002_inventory_thresholds'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inventory_thresholds',
        sa.Column('classification_id', sa.Integer(), nullable=False),
        sa.Column('low_stock_pcs', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['classification_id'], ['classifications.id']),
        sa.PrimaryKeyConstraint('classification_id'),
    )


def downgrade():
    op.drop_table('inventory_thresholds')
