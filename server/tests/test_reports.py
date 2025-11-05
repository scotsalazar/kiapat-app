"""Tests for reporting endpoints ensuring aggregate metrics are accurate."""

from __future__ import annotations

from datetime import datetime, timedelta

import importlib
import os
import sys
from pathlib import Path
from base64 import b64encode

import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="function")
def client(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("data") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SEED_TOKEN"] = "test-token"
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    app_database = importlib.import_module("app.database")
    importlib.reload(app_database)
    app_main = importlib.import_module("app.main")
    importlib.reload(app_main)
    app = app_main.create_app()
    return TestClient(app)


def seed_db(client: TestClient):
    resp = client.post("/api/admin/seed", headers={"seed-token": "test-token"})
    assert resp.status_code == 200
    return resp.json()


def login(client: TestClient, username: str, password: str) -> str:
    resp = client.post(
        "/api/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def top_up_inventory(client: TestClient, token: str, classification_id: int, qty: int, unit: str) -> None:
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": classification_id, "qty": qty, "unit": unit},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    movement_id = resp.json()["id"]
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200


def create_invoice(client: TestClient, token: str, classification_id: int, qty: int) -> dict:
    payload = {
        "customer_name": "Metrics Tester",
        "customer_phone": "00000000",
        "items": [{"classification_id": classification_id, "qty": qty, "unit": "DOZEN"}],
        "signature_png_b64": b64encode(b"PNG").decode(),
    }
    resp = client.post(
        "/api/sales/invoices",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_reports_metrics_with_date_filters(client: TestClient):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    driver_token = login(client, "driver", "pass123")

    resp = client.get(
        "/api/catalog/classifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    classifications = resp.json()
    cls_id = classifications[0]["id"]

    top_up_inventory(client, admin_token, cls_id, qty=10, unit="DOZEN")

    first_invoice = create_invoice(client, driver_token, cls_id, qty=2)
    create_invoice(client, driver_token, cls_id, qty=1)

    older_date = datetime.utcnow() - timedelta(days=1)
    from app.database import SessionLocal
    from app import models

    with SessionLocal() as db:
        invoice = db.query(models.Invoice).get(first_invoice["id"])
        invoice.created_at = older_date
        for movement in invoice.movements:
            movement.created_at = older_date
        db.commit()

    resp = client.get(
        "/api/reports/daily-sales",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    summaries = resp.json()
    assert len(summaries) == 2
    summaries_by_date = {entry["date"]: entry for entry in summaries}
    yesterday_key = older_date.date().isoformat()
    today_key = datetime.utcnow().date().isoformat()
    assert summaries_by_date[yesterday_key]["invoice_count"] == 1
    assert summaries_by_date[yesterday_key]["total_amount"] == pytest.approx(200.0)
    assert summaries_by_date[yesterday_key]["eggs_sold_pcs"] == 24
    assert summaries_by_date[today_key]["invoice_count"] == 1
    assert summaries_by_date[today_key]["total_amount"] == pytest.approx(100.0)
    assert summaries_by_date[today_key]["eggs_sold_pcs"] == 12

    resp = client.get(
        "/api/reports/daily-sales",
        params={"start_date": today_key},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    filtered = resp.json()
    assert len(filtered) == 1
    assert filtered[0]["date"] == today_key

    resp = client.get(
        "/api/reports/inventory-turnover",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    turnover_metrics = resp.json()
    target_metric = next(item for item in turnover_metrics if item["classification_id"] == cls_id)
    assert target_metric["total_in_pcs"] == 120
    assert target_metric["total_out_pcs"] == 36
    assert target_metric["opening_balance_pcs"] == 0
    assert target_metric["closing_balance_pcs"] == 84
    assert target_metric["average_inventory_pcs"] == pytest.approx(42.0)
    assert target_metric["turnover_ratio"] == pytest.approx(36 / 42)

    resp = client.get(
        "/api/reports/cumulative-eggs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    cumulative = resp.json()
    assert cumulative["total_pcs"] == 36
    assert cumulative["total_dozens"] == pytest.approx(3.0)
    assert cumulative["total_trays"] == pytest.approx(1.2)

    resp = client.get(
        "/api/reports/cumulative-eggs",
        params={"start_date": today_key},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    filtered_cumulative = resp.json()
    assert filtered_cumulative["total_pcs"] == 12
