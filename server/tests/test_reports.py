pytest_plugins = ["tests.test_app"]

"""Tests for reporting metrics exposed by the reports router."""

from datetime import datetime
from importlib import import_module
import pytest

from test_app import seed_db


def _commit_inventory_in(client, classification_id: int, qty: int, unit: str) -> None:
    create_resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": classification_id, "qty": qty, "unit": unit},
    )
    assert create_resp.status_code == 200
    movement_id = create_resp.json()["id"]
    verify_resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
    )
    assert verify_resp.status_code == 200
    commit_resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )
    assert commit_resp.status_code == 200


def test_reports_metrics_across_time_ranges(client):
    seed_db(client)

    models = import_module("app.models")
    database = import_module("app.database")
    SessionLocal = database.SessionLocal

    classifications_resp = client.get(
        "/api/catalog/classifications",
    )
    assert classifications_resp.status_code == 200
    classification_id = classifications_resp.json()[0]["id"]

    _commit_inventory_in(client, classification_id, qty=5, unit="TRAY")

    invoice_one_resp = client.post(
        "/api/sales/invoices",
        json={
            "customer_name": "Day One",
            "customer_phone": "12345678",
            "signature_png_b64": "dGVzdA==",
            "items": [
                {"classification_id": classification_id, "qty": 2, "unit": "DOZEN"}
            ],
        },
    )
    assert invoice_one_resp.status_code == 201, invoice_one_resp.text
    invoice_two_resp = client.post(
        "/api/sales/invoices",
        json={
            "customer_name": "Day Two",
            "customer_phone": "99999999",
            "signature_png_b64": "dGVzdA==",
            "items": [
                {"classification_id": classification_id, "qty": 1, "unit": "TRAY"}
            ],
        },
    )
    assert invoice_two_resp.status_code == 201, invoice_two_resp.text

    invoice_one = invoice_one_resp.json()
    invoice_two = invoice_two_resp.json()

    day_one = datetime(2024, 1, 1, 8, 0, 0)
    day_two = datetime(2024, 1, 2, 9, 0, 0)
    with SessionLocal() as db:
        inv_one = db.query(models.Invoice).get(invoice_one["id"])
        inv_two = db.query(models.Invoice).get(invoice_two["id"])
        inv_one.created_at = day_one
        inv_two.created_at = day_two
        db.query(models.InventoryMovement).filter(
            models.InventoryMovement.linked_invoice_id == inv_one.id
        ).update({models.InventoryMovement.created_at: day_one}, synchronize_session=False)
        db.query(models.InventoryMovement).filter(
            models.InventoryMovement.linked_invoice_id == inv_two.id
        ).update({models.InventoryMovement.created_at: day_two}, synchronize_session=False)
        db.commit()

    sales_resp = client.get(
        "/api/reports/daily-sales",
        params={
            "start_date": day_one.isoformat(),
            "end_date": (datetime(2024, 1, 3)).isoformat(),
        },
    )
    assert sales_resp.status_code == 200
    summaries = sales_resp.json()
    assert len(summaries) == 2
    day_one_summary = next(item for item in summaries if item["date"] == "2024-01-01")
    assert day_one_summary["total_amount"] == pytest.approx(200.0)
    assert day_one_summary["eggs_sold_pcs"] == 24
    assert day_one_summary["invoice_count"] == 1
    day_two_summary = next(item for item in summaries if item["date"] == "2024-01-02")
    assert day_two_summary["total_amount"] == pytest.approx(250.0)
    assert day_two_summary["eggs_sold_pcs"] == 30

    turnover_resp = client.get(
        "/api/reports/inventory-turnover",
    )
    assert turnover_resp.status_code == 200
    turnover_metrics = turnover_resp.json()
    target_metric = next(m for m in turnover_metrics if m["classification_id"] == classification_id)
    assert target_metric["total_in_pcs"] == 150
    assert target_metric["total_out_pcs"] == 54
    assert target_metric["turnover_ratio"] == pytest.approx(54 / 150)

    cumulative_resp = client.get(
        "/api/reports/cumulative-eggs-sold",
    )
    assert cumulative_resp.status_code == 200
    cumulative = cumulative_resp.json()
    assert cumulative["total_eggs_pcs"] == 54
    assert cumulative["total_eggs_tray"] == pytest.approx(54 / 30)
    assert cumulative["total_eggs_dozen"] == pytest.approx(54 / 12)

    day_two_only_resp = client.get(
        "/api/reports/daily-sales",
        params={"start_date": day_two.isoformat(), "end_date": day_two.isoformat()},
    )
    assert day_two_only_resp.status_code == 200
    single_day = day_two_only_resp.json()
    assert len(single_day) == 1
    assert single_day[0]["date"] == "2024-01-02"

    forbidden_resp = client.get(
        "/api/reports/daily-sales",
        headers={"X-API-Key": "invalid"},
    )
    assert forbidden_resp.status_code == 401
