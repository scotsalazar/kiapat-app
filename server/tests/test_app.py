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

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """Create a TestClient with a temporary SQLite database for tests."""
    # Override DATABASE_URL to use a temporary file
    db_path = tmp_path_factory.mktemp("data") / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SEED_TOKEN"] = "test-token"
    app = create_app()
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

    # admin cannot create sales invoice
    payload = {
        "customer_name": "Test",
        "customer_phone": "",
        "items": [{"classification_id": cls_id, "qty": 1, "unit": "PCS"}],
        "signature_png_b64": "",
    }
    resp = client.post(
        "/api/sales/invoices",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 403