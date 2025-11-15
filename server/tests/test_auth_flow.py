"""Authentication regression tests covering OAuth flows and role guards."""

from typing import Dict

import pytest

from test_app import login, seed_db


def _auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "username,password,expected_role",
    [
        ("admin", "admin123", "admin"),
        ("driver", "pass123", "driver"),
    ],
)
def test_login_and_me_endpoint_returns_seeded_user(client, username, password, expected_role):
    seed_db(client)
    token = login(client, username, password)

    me_resp = client.get("/api/auth/me", headers=_auth_headers(token))
    assert me_resp.status_code == 200, me_resp.text
    body = me_resp.json()
    assert body["username"] == username
    assert body["role"] == expected_role


def test_login_rejects_invalid_credentials(client):
    seed_db(client)
    resp = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "wrong"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 401
    assert "Incorrect username or password" in resp.text


def test_driver_cannot_access_admin_only_routes(client):
    seed_db(client)
    driver_token = login(client, "driver", "pass123")

    resp = client.get("/api/users/", headers=_auth_headers(driver_token))
    assert resp.status_code == 403
