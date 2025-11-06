"""
Database seeding utilities.  This module centralises the logic for
creating initial users, classifications and prices so that it can be
invoked both from the admin API endpoint and automatically on
startup when the database is empty.
"""

from datetime import datetime
from itertools import product
from sqlalchemy.orm import Session

from . import models, auth, utils


def seed_database(db: Session) -> str:
    """Populate the database with initial records if no users exist.

    Creates an admin and driver account, all combinations of egg size
    and colour, and sample pricing for trays and dozens.  Returns a
    string indicating whether seeding occurred.
    """
    if db.query(models.User).count() > 0:
        return "already-seeded"
    # users
    admin_user = models.User(
        name="Inventory Manager",
        username="admin",
        email="admin@kiapat.local",
        hashed_password=auth.get_password_hash("admin123"),
        role=models.RoleEnum.ADMIN,
    )
    driver_user = models.User(
        name="Driver",
        username="driver",
        email="driver@kiapat.local",
        hashed_password=auth.get_password_hash("pass123"),
        role=models.RoleEnum.DRIVER,
    )
    db.add_all([admin_user, driver_user])
    # classifications
    for size, color in product(models.SizeEnum, models.ColorEnum):
        cls = models.Classification(size=size, color=color, is_active=True)
        db.add(cls)
    db.commit()
    # seed prices for each classification
    classifications = db.query(models.Classification).all()
    for cls in classifications:
        price_per_dozen = 100.0
        price_per_tray = price_per_dozen * (utils.TRAY_SIZE / utils.DOZEN_SIZE)
        db.add(
            models.Price(
                classification_id=cls.id,
                unit=models.UnitEnum.DOZEN,
                price_per_unit=price_per_dozen,
                effective_from=datetime.utcnow(),
            )
        )
        db.add(
            models.Price(
                classification_id=cls.id,
                unit=models.UnitEnum.TRAY,
                price_per_unit=price_per_tray,
                effective_from=datetime.utcnow(),
            )
        )
    db.commit()
    # default low stock thresholds (2 trays)
    for cls in classifications:
        db.merge(
            models.InventoryThreshold(
                classification_id=cls.id, low_stock_pcs=2 * utils.TRAY_SIZE
            )
        )
    db.commit()
    return "seeded"