"""
Basic API tests for the Kiapat backend.  These tests use FastAPI's
TestClient to perform requests against the application without
starting a server.  They exercise key happy paths described in the
acceptance criteria: seeding, authentication, inventory in/out and
invoice creation.
"""

from base64 import b64encode
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import importlib

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="function")
def client(tmp_path_factory):
    """Create a TestClient with a temporary SQLite database for tests."""
    # Override DATABASE_URL to use a temporary file
    db_path = tmp_path_factory.mktemp("data") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SEED_TOKEN"] = "test-token"
    # Reload database/app modules so they pick up the new DATABASE_URL
    app_database = importlib.import_module("app.database")
    importlib.reload(app_database)
    app_main = importlib.import_module("app.main")
    importlib.reload(app_main)
    app = app_main.create_app()
    return TestClient(app)


def seed_db(client: TestClient):
    # call seed endpoint with header
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
    token = resp.json()["access_token"]
    return token


def test_seed_and_login(client):
    seed_db(client)
    # login admin
    token = login(client, "admin", "admin123")
    assert token
    # login driver
    token2 = login(client, "driver", "pass123")
    assert token2


def test_inventory_in_flow(client):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    # list classifications
    resp = client.get(
        "/api/catalog/classifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    classifications = resp.json()
    cls_id = classifications[0]["id"]
    # create draft IN movement
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls_id, "qty": 1, "unit": "TRAY"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    movement_id = resp.json()["id"]
    # verify
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    # commit
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    # inventory summary should reflect 30 pcs (1 tray) added
    resp = client.get(
        "/api/inventory/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    summary = resp.json()
    # find card
    card = next(c for c in summary["cards"] if c["classification_id"] == cls_id)
    assert card["qty_pcs"] >= 30


def test_driver_invoice_flow(client):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    driver_token = login(client, "driver", "pass123")
    # top up stock for two classifications
    resp = client.get(
        "/api/catalog/classifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    classes = resp.json()
    for cls in classes[:2]:
        resp = client.post(
            "/api/inventory/in/create",
            json={"classification_id": cls["id"], "qty": 2, "unit": "DOZEN"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        mid = resp.json()["id"]
        client.post(
            "/api/inventory/in/verify",
            json={"movement_id": mid},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        client.post(
            "/api/inventory/in/commit",
            json={"movement_id": mid},
            headers={"Authorization": f"Bearer {admin_token}"},
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
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 201
    invoice = resp.json()
    assert invoice["total_amount"] > 0
    assert invoice["status"] == "COMPLETED"
    # inventory should decrement
    resp = client.get(
        "/api/inventory/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    summary = resp.json()
    for item in invoice["items"]:
        card = next(c for c in summary["cards"] if c["classification_id"] == item["classification_id"])
        # after 2 dozens added and 1 dozen sold, pcs should be 12
        assert card["qty_pcs"] == 12


def test_invoice_override_flow(client):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    driver_token = login(client, "driver", "pass123")

    # Ensure limited stock for one classification
    resp = client.get(
        "/api/catalog/classifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cls = resp.json()[0]

    # Add small amount of stock
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls["id"], "qty": 1, "unit": "DOZEN"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    mid = resp.json()["id"]
    client.post(
        "/api/inventory/in/verify",
        json={"movement_id": mid},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    client.post(
        "/api/inventory/in/commit",
        json={"movement_id": mid},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Driver requests more than available stock
    invoice_payload = {
        "customer_name": "Override Customer",
        "customer_phone": "555",
        "items": [
            {"classification_id": cls["id"], "qty": 5, "unit": "DOZEN"},
        ],
        "signature_png_b64": None,
    }
    resp = client.post(
        "/api/sales/invoices",
        json=invoice_payload,
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 202
    invoice = resp.json()
    assert invoice["status"] == "PENDING_OVERRIDE"
    override = invoice["override_request"]
    assert override is not None
    shortage = override["items"][0]["shortage_qty_pcs"]
    assert shortage > 0

    # Admin lists pending overrides
    resp = client.get(
        "/api/sales/invoices/overrides/pending",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    pending = resp.json()
    assert any(o["invoice_id"] == invoice["id"] for o in pending)

    # Approve the override
    resp = client.post(
        f"/api/sales/invoices/overrides/{override['id']}/approve",
        json={"note": "ok"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    approved_invoice = resp.json()
    assert approved_invoice["status"] == "COMPLETED"

    # Inventory should now reflect the sale (and go negative)
    resp = client.get(
        "/api/inventory/summary",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    summary = resp.json()
    card = next(c for c in summary["cards"] if c["classification_id"] == cls["id"])
    assert card["qty_pcs"] == 12 - (5 * 12)

    # Rejecting a new override should mark invoice as rejected
    resp = client.post(
        "/api/sales/invoices",
        json={
            "customer_name": "Reject",
            "customer_phone": "000",
            "items": [{"classification_id": cls["id"], "qty": 2, "unit": "DOZEN"}],
            "signature_png_b64": None,
        },
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 202
    pending_invoice = resp.json()
    resp = client.post(
        f"/api/sales/invoices/overrides/{pending_invoice['override_request']['id']}/reject",
        json={"note": "not allowed"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    rejected = resp.json()
    assert rejected["status"] == "REJECTED"


def test_authorization_checks(client):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    driver_token = login(client, "driver", "pass123")
    # driver should not be able to verify or commit movements
    # create draft as admin
    cls_id = 1
    resp = client.post(
        "/api/inventory/in/create",
        json={"classification_id": cls_id, "qty": 1, "unit": "DOZEN"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    movement_id = resp.json()["id"]
    # attempt verify as driver
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403
    # attempt commit as driver
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403
    # admin can verify and commit
    resp = client.post(
        "/api/inventory/in/verify",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    resp = client.post(
        "/api/inventory/in/commit",
        json={"movement_id": movement_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200


def test_catalog_admin_routes_authorization(client):
    seed_db(client)
    admin_token = login(client, "admin", "admin123")
    driver_token = login(client, "driver", "pass123")

    resp = client.get(
        "/api/catalog/classifications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    classifications = resp.json()
    assert classifications
    target_cls = classifications[-1]

    resp = client.post(
        "/api/catalog/classifications",
        json={"size": target_cls["size"], "color": target_cls["color"]},
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403

    resp = client.get(
        "/api/catalog/prices",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    for price in resp.json():
        if price["classification_id"] == target_cls["id"]:
            del_resp = client.delete(
                f"/api/catalog/prices/{price['id']}",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert del_resp.status_code == 204

    resp = client.delete(
        f"/api/catalog/classifications/{target_cls['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204

    resp = client.post(
        "/api/catalog/classifications",
        json={"size": target_cls["size"], "color": target_cls["color"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    new_classification = resp.json()

    resp = client.put(
        f"/api/catalog/classifications/{new_classification['id']}",
        json={"size": new_classification["size"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    resp = client.post(
        f"/api/catalog/classifications/{new_classification['id']}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = client.post(
        f"/api/catalog/classifications/{new_classification['id']}/activate",
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403

    resp = client.post(
        f"/api/catalog/classifications/{new_classification['id']}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
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
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403

    effective_from = datetime.utcnow() - timedelta(days=1)
    price_payload = {
        "classification_id": new_classification["id"],
        "unit": "DOZEN",
        "price_per_unit": 150.0,
        "effective_from": effective_from.isoformat(),
    }
    resp = client.post(
        "/api/catalog/prices",
        json=price_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    price = resp.json()

    resp = client.post(
        "/api/catalog/prices",
        json=price_payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400

    future_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
    resp = client.put(
        f"/api/catalog/prices/{price['id']}",
        json={"price_per_unit": 175.0, "effective_to": future_end},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["price_per_unit"] == 175.0

    resp = client.post(
        f"/api/catalog/prices/{price['id']}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["effective_to"] is not None

    resp = client.post(
        f"/api/catalog/prices/{price['id']}/activate",
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert resp.status_code == 403

    resp = client.post(
        f"/api/catalog/prices/{price['id']}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["effective_to"] is None
