"""Reporting endpoints for aggregated sales and inventory metrics."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import auth, crud, models, schemas
from ..database import get_db


router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/daily-sales", response_model=List[schemas.DailySalesSummary])
def daily_sales_summary(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return aggregated sales totals per day."""

    return crud.get_daily_sales_summary(db, start_date=start_date, end_date=end_date)


@router.get("/inventory-turnover", response_model=List[schemas.InventoryTurnoverMetric])
def inventory_turnover(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return turnover calculations per classification."""

    return crud.get_inventory_turnover_metrics(db)


@router.get("/cumulative-eggs", response_model=schemas.CumulativeEggsSold)
def cumulative_eggs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return cumulative eggs sold in pieces, dozens, and trays."""

    return crud.get_cumulative_eggs_sold(db, start_date=start_date, end_date=end_date)
