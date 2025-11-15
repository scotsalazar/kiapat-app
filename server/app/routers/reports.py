"""Reporting endpoints for aggregated sales and inventory metrics."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import auth, crud, schemas
from ..database import get_db


router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/daily-sales", response_model=List[schemas.DailySalesSummary])
def get_daily_sales_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
) -> List[schemas.DailySalesSummary]:
    """Return aggregated sales totals grouped by day."""
    if end_date and start_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not be before start_date",
        )
    return crud.get_daily_sales_summary(db, start_date, end_date)


@router.get("/inventory-turnover", response_model=List[schemas.InventoryTurnoverMetric])
def get_inventory_turnover_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
) -> List[schemas.InventoryTurnoverMetric]:
    """Return inventory turnover metrics per classification."""
    if end_date and start_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not be before start_date",
        )
    return crud.get_inventory_turnover(db, start_date, end_date)


@router.get("/cumulative-eggs-sold", response_model=schemas.CumulativeEggsSold)
def get_cumulative_eggs_sold_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    _: None = Depends(auth.require_api_key),
) -> schemas.CumulativeEggsSold:
    """Return the total eggs sold in the provided window."""
    if end_date and start_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not be before start_date",
        )
    return crud.get_cumulative_eggs_sold(db, start_date, end_date)
