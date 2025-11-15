"""
Basic API tests for the Kiapat backend.  These tests use FastAPI's
TestClient to perform requests against the application without
starting a server.  They exercise key happy paths described in the
acceptance criteria: seeding, authentication, inventory in/out and
invoice creation.
"""

from base64 import b64encode
import os
from datetime import datetime, timedelta
import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="function")
def client(tmp_path_factory):
    """Create a TestClient with a temporary SQLite database for tests."""
    # Override DATABASE_URL to use a temporary file
    db_path = tmp_path_factory.mktemp("data") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SEED_TOKEN"] = "test-token"
    os.environ["API_SHARED_SECRET"] = "test-api-key"
    # Reload database/app modules so they pick up the new DATABASE_URL
    app_database = importlib.import_module("app.database")
    importlib.reload(app_database)
    app_auth = importlib.import_module("app.auth")
    importlib.reload(app_auth)
    app_main = importlib.import_module("app.main")
    importlib.reload(app_main)
    app = app_main.create_app()

    client = TestClient(app)
    client.headers.update({"X-API-Key": os.environ["API_SHARED_SECRET"]})
    return client


def seed_db(client: TestClient):
    # call seed endpoint with header
    resp = client.post("/api/admin/seed", headers={"seed-token": "test-token"})
    assert resp.status_code == 200
    return resp.json()


def test_seed_and_login(client):
    seed_db(client)
    resp = client.get("/api/catalog/classifications")
    assert resp.status_code == 200
    assert resp.json(), "Expected classifications to be visible anonymously"
    resp = client.get("/api/inventory/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["cards"], "Inventory summary should be accessible anonymously"


def test_inventory_in_flow(client):
    seed_db(client)
    # list classifications
    resp = client.get("/api/catalog/classifications")
    assert resp.status_code == 200
    classifications = resp.json()
    cls_id = classifications[0]["id"]
    # create draft IN movement
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls_id, "qty": 1, "unit": "TRAY"},
    )
    assert resp.status_code == 200
    movement_id = resp.json()["id"]
    # verify
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 200
    # commit
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 200
    # inventory summary should reflect 30 pcs (1 tray) added
    resp = client.get("/api/inventory/summary")
    summary = resp.json()
    # find card
    card = next(c for c in summary["cards"] if c["classification_id"] == cls_id)
    assert card["qty_pcs"] >= 30


def test_driver_invoice_flow(client):
    seed_db(client)
    # top up stock for two classifications
    resp = client.get("/api/catalog/classifications")
    classes = resp.json()
    for cls in classes[:2]:
        resp = client.post(
            "/api/inventory/in/create",
            json={"classification_id": cls["id"], "qty": 2, "unit": "DOZEN"},
        )
        mid = resp.json()["id"]
        client.post(
            "/api/inventory/in/verify",
            json={"movement_id": mid},
        )
        client.post(
            "/api/inventory/in/commit",
            json={"movement_id": mid},
        )
    # create invoice as driver
    invoice_payload = {
        "customer_name": "Jane Doe",
        "customer_phone": "12345678",
        "items": [
            {"classification_id": classes[0]["id"], "qty": 1, "unit": "DOZEN"},
            {"classification_id": classes[1]["id"], "qty": 1, "unit": "DOZEN"},
        ],
        # encode a small png as base64 (empty signature)
        "signature_png_b64": b64encode(b"PNG").decode(),
    }
    resp = client.post(
        "/api/sales/invoices",
        json=invoice_payload,
    )
    assert resp.status_code == 201
    invoice = resp.json()
    assert invoice["total_amount"] > 0
    assert invoice["status"] == "COMPLETED"
    assert invoice["overrides"] == []
    # inventory should decrement
    resp = client.get("/api/inventory/summary")
    summary = resp.json()
    for item in invoice["items"]:
        card = next(c for c in summary["cards"] if c["classification_id"] == item["classification_id"])
        # after 2 dozens added and 1 dozen sold, pcs should be 12
        assert card["qty_pcs"] == 12


def test_inventory_threshold_configuration(client):
    seed_db(client)

    resp = client.get("/api/catalog/classifications")
    assert resp.status_code == 200
    classification_id = resp.json()[0]["id"]

    resp = client.put(
        "/api/inventory/thresholds",
        json={"thresholds": [{"classification_id": classification_id, "threshold_pcs": 120}]},
    )
    assert resp.status_code == 200
    thresholds = resp.json()
    assert any(t["classification_id"] == classification_id for t in thresholds)

    resp = client.get("/api/inventory/summary")
    assert resp.status_code == 200
    summary = resp.json()
    card = next(c for c in summary["cards"] if c["classification_id"] == classification_id)
    assert card["threshold_pcs"] == 120
    assert card["is_low"] is True

    resp = client.put(
        "/api/inventory/thresholds",
        json={"thresholds": [{"classification_id": classification_id, "threshold_pcs": 0}]},
    )
    assert resp.status_code == 200

    resp = client.get("/api/inventory/summary")
    summary = resp.json()
    card = next(c for c in summary["cards"] if c["classification_id"] == classification_id)
    assert card["threshold_pcs"] is None
    assert card["is_low"] is False


def test_inventory_summary_filters(client):
    seed_db(client)

    resp = client.get("/api/inventory/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["cards"], "Expected seeded inventory to include classifications"
    first_card = summary["cards"][0]

    resp = client.get(
        "/api/inventory/summary",
        params={"size": first_card["size"]},
    )
    assert resp.status_code == 200
    size_filtered = resp.json()["cards"]
    assert size_filtered
    assert all(card["size"] == first_card["size"] for card in size_filtered)

    resp = client.get(
        "/api/inventory/summary",
        params={"color": first_card["color"]},
    )
    assert resp.status_code == 200
    color_filtered = resp.json()["cards"]
    assert color_filtered
    assert all(card["color"] == first_card["color"] for card in color_filtered)

    # mark the first card as low stock and ensure low_stock filter returns only low stock items
    threshold_value = max(first_card["qty_pcs"], 0) + 10
    client.put(
        "/api/inventory/thresholds",
        json={
            "thresholds": [
                {
                    "classification_id": first_card["classification_id"],
                    "threshold_pcs": threshold_value,
                }
            ]
        },
    )

    resp = client.get(
        "/api/inventory/summary",
        params={"low_stock": "true"},
    )
    assert resp.status_code == 200
    low_filtered = resp.json()["cards"]
    assert low_filtered
    assert all(card["is_low"] for card in low_filtered)
    assert any(card["classification_id"] == first_card["classification_id"] for card in low_filtered)

    search_term = first_card["size"].lower()
    resp = client.get(
        "/api/inventory/summary",
        params={"search": search_term},
    )
    assert resp.status_code == 200
    search_filtered = resp.json()["cards"]
    assert search_filtered
    assert all(
        search_term in f"{card['size']} {card['color']}".lower()
        for card in search_filtered
    )


def test_invoice_override_flow(client):
    seed_db(client)

    # load a single classification and add limited stock
    resp = client.get(
        "/api/catalog/classifications",
    )
    assert resp.status_code == 200
    cls = resp.json()[0]

    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls["id"], "qty": 1, "unit": "DOZEN"},
    )
    movement_id = resp.json()["id"]
    client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
    )
    client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )

    # driver requests more stock than available to trigger override
    invoice_payload = {
        "customer_name": "Override Test",
        "customer_phone": "98765432",
        "items": [
            {"classification_id": cls["id"], "qty": 2, "unit": "DOZEN"},
        ],
        "signature_png_b64": b64encode(b"PNG").decode(),
    }
    resp = client.post(
        "/api/sales/invoices",
        json=invoice_payload,
    )
    assert resp.status_code == 201
    invoice = resp.json()
    assert invoice["status"] == "PENDING_OVERRIDE"
    assert invoice["overrides"], "Expected override details"
    assert invoice["overrides"][0]["requested_unit"] == "DOZEN"

    # inventory should remain unchanged while pending
    resp = client.get("/api/inventory/summary")
    summary = resp.json()
    card = next(c for c in summary["cards"] if c["classification_id"] == cls["id"])
    assert card["qty_pcs"] == 12

    # admin sees pending overrides
    resp = client.get("/api/sales/invoices/overrides/pending")
    overrides = resp.json()
    assert any(o["invoice_id"] == invoice["id"] for o in overrides)

    # approve override
    resp = client.post(
        f"/api/sales/invoices/{invoice['id']}/override/approve",
        json={},
    )
    assert resp.status_code == 200
    approved_invoice = resp.json()
    assert approved_invoice["status"] == "COMPLETED"
    assert all(o["status"] == "APPROVED" for o in approved_invoice["overrides"])

    # inventory now reflects deduction (12 - 24 = -12)
    resp = client.get("/api/inventory/summary")
    summary = resp.json()
    card = next(c for c in summary["cards"] if c["classification_id"] == cls["id"])
    assert card["qty_pcs"] == -12


def test_inventory_movement_state_rules(client):
    seed_db(client)
    cls_id = 1
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls_id, "qty": 1, "unit": "DOZEN"},
    )
    movement_id = resp.json()["id"]

    # committing before verifying should fail due to invalid state
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 400

    # verifying works once
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 200

    # verifying again should fail because status already advanced
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 400

    # committing now succeeds
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 200

    # committing twice should again fail with invalid state
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
    )
    assert resp.status_code == 400


def test_catalog_management_flow(client):
    seed_db(client)

    resp = client.get("/api/catalog/classifications")
    assert resp.status_code == 200
    classifications = resp.json()
    assert classifications
    target_cls = classifications[-1]

    # duplicates should be rejected even for anonymous callers
    resp = client.post(
        "/api/catalog/classifications",
        json={"size": target_cls["size"], "color": target_cls["color"]},
    )
    assert resp.status_code == 400

    resp = client.get("/api/catalog/prices")
    assert resp.status_code == 200
    for price in resp.json():
        if price["classification_id"] == target_cls["id"]:
            del_resp = client.delete(
                f"/api/catalog/prices/{price['id']}",
            )
            assert del_resp.status_code == 204

    resp = client.delete(f"/api/catalog/classifications/{target_cls['id']}")
    assert resp.status_code == 204

    resp = client.post(
        "/api/catalog/classifications",
        json={"size": target_cls["size"], "color": target_cls["color"]},
    )
    assert resp.status_code == 201
    new_classification = resp.json()

    resp = client.put(
        f"/api/catalog/classifications/{new_classification['id']}",
        json={"size": new_classification["size"]},
    )
    assert resp.status_code == 200

    resp = client.post(
        f"/api/catalog/classifications/{new_classification['id']}/deactivate",
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = client.post(
        f"/api/catalog/classifications/{new_classification['id']}/activate",
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    resp = client.post(
        "/api/catalog/prices",
        json={
            "classification_id": new_classification["id"],
            "unit": "DOZEN",
            "price_per_unit": 123.0,
        },
    )
    assert resp.status_code == 201
    first_price = resp.json()

    effective_from = datetime.utcnow() - timedelta(days=1)
    price_payload = {
        "classification_id": new_classification["id"],
        "unit": "TRAY",
        "price_per_unit": 150.0,
        "effective_from": effective_from.isoformat(),
    }
    resp = client.post(
        "/api/catalog/prices",
        json=price_payload,
    )
    assert resp.status_code == 201
    price = resp.json()

    resp = client.post(
        "/api/catalog/prices",
        json=price_payload,
    )
    assert resp.status_code == 400

    future_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
    resp = client.put(
        f"/api/catalog/prices/{price['id']}",
        json={"price_per_unit": 175.0, "effective_to": future_end},
    )
    assert resp.status_code == 200
    assert resp.json()["price_per_unit"] == 175.0

    resp = client.post(
        f"/api/catalog/prices/{price['id']}/deactivate",
    )
    assert resp.status_code == 200
    assert resp.json()["effective_to"] is not None

    resp = client.post(
        f"/api/catalog/prices/{price['id']}/activate",
    )
    assert resp.status_code == 200
    assert resp.json()["effective_to"] is None

    # ensure we can still fetch prices including the original unit
    resp = client.get("/api/catalog/prices")
    assert resp.status_code == 200
    assert any(p["id"] == first_price["id"] for p in resp.json())
