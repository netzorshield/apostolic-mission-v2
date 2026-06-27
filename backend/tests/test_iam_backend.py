"""IAM backend E2E tests — credentials and target URL loaded from environment."""
import re
import uuid

import httpx
import pytest

TIMEOUT = 30.0

ENROLLMENT_DATA = {
    "personal_info": {"first_name": "John", "last_name": "Doe", "date_of_birth": "1990-01-01"},
    "contact_info": {"phone": "+1234567890", "alternate_email": "alt@example.com"},
    "address": {"street": "123 Main St", "city": "Mumbai", "state": "WE", "country": "IND", "postal_code": "400001"},
    "spiritual_info": {"baptism_date": "2010-06-15", "current_church": "Test Church"},
    "references": [{"name": "Ref One", "phone": "+1111111111", "relationship": "Pastor"}],
    "documents": {"id_proof": "uploaded", "photo": "uploaded"},
    "agreements": {"terms_accepted": True, "privacy_accepted": True},
}

MEMBER_ID_PATTERN = re.compile(r"IAM-[A-Z]{3}-[A-Z]{2}-\d{4}-\d{6}")


def make_client(api_base_url: str):
    """Fresh client without shared auth cookies."""
    return httpx.Client(base_url=api_base_url, timeout=TIMEOUT)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login_admin(client: httpx.Client, admin_email: str, admin_password: str) -> str:
    r = client.post("/auth/login", json={"email": admin_email, "password": admin_password})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


def register_member(client: httpx.Client, prefix: str = "member"):
    uid = uuid.uuid4().hex[:8]
    creds = {
        "email": f"{prefix}_{uid}@example.com",
        "password": "TestPass123!",
        "name": f"Test Member {uid}",
    }
    r = client.post("/auth/register", json=creds)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data["user"]["role"] == "member"
    return creds, data["token"]


def application_payload(uid: str) -> dict:
    return {
        "first_name": f"First{uid}",
        "last_name": f"Last{uid}",
        "email": f"applicant_{uid}@example.com",
        "mobile": "+1234567890",
        "country": "India",
        "purpose": "membership",
    }


class TestHealth:
    def test_health_returns_200(self, api_base_url):
        with make_client(api_base_url) as client:
            r = client.get("/")
            assert r.status_code == 200
            assert r.json().get("status") == "operational"


class TestAuth:
    def test_register_creates_member(self, api_base_url):
        with make_client(api_base_url) as client:
            uid = uuid.uuid4().hex[:8]
            creds = {
                "email": f"reg_{uid}@example.com",
                "password": "TestPass123!",
                "name": f"Reg User {uid}",
            }
            r = client.post("/auth/register", json=creds)
            assert r.status_code in (200, 201), r.text
            data = r.json()
            assert "token" in data
            assert data["user"]["email"] == creds["email"]

    def test_admin_login(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as client:
            token = login_admin(client, admin_email, admin_password)
            assert token

    def test_wrong_password_returns_401(self, api_base_url, admin_email):
        with make_client(api_base_url) as client:
            r = client.post("/auth/login", json={"email": admin_email, "password": "WrongPassword!"})
            assert r.status_code == 401

    def test_me_with_bearer_token(self, api_base_url):
        with make_client(api_base_url) as client:
            creds, token = register_member(client, "me")
            r = client.get("/auth/me", headers=auth_headers(token))
            assert r.status_code == 200, r.text
            assert r.json()["email"] == creds["email"]

    def test_logout_returns_ok(self, api_base_url):
        with make_client(api_base_url) as client:
            _, token = register_member(client, "logout")
            r = client.post("/auth/logout", headers=auth_headers(token))
            assert r.status_code == 200, r.text


class TestBruteForce:
    def test_lockout_after_failed_attempts(self, api_base_url):
        with make_client(api_base_url) as client:
            creds, _ = register_member(client, "bruteforce")
            got_429 = False
            for _ in range(6):
                r = client.post(
                    "/auth/login",
                    json={"email": creds["email"], "password": "wrongpass"},
                )
                if r.status_code == 429:
                    got_429 = True
                    break
            assert got_429, "Expected 429 lockout within 6 failed login attempts"


class TestApplications:
    def test_public_create_application(self, api_base_url):
        with make_client(api_base_url) as client:
            uid = uuid.uuid4().hex[:8]
            r = client.post("/applications", json=application_payload(uid))
            assert r.status_code in (200, 201), r.text
            data = r.json()
            assert re.match(r"IAM-APP-[\w-]+", data["tracking_id"])

    def test_get_applications_admin_only(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            _, member_token = register_member(member_client, "appmember")
            admin_token = login_admin(admin_client, admin_email, admin_password)

            r_member = member_client.get("/applications", headers=auth_headers(member_token))
            assert r_member.status_code == 403

            r_admin = admin_client.get("/applications", headers=auth_headers(admin_token))
            assert r_admin.status_code == 200, r_admin.text
            assert isinstance(r_admin.json(), list)

    def test_patch_application_as_admin(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as client:
            uid = uuid.uuid4().hex[:8]
            admin_token = login_admin(client, admin_email, admin_password)
            create = client.post("/applications", json=application_payload(uid))
            assert create.status_code in (200, 201), create.text
            app_id = create.json()["id"]

            patch = client.patch(
                f"/applications/{app_id}",
                headers=auth_headers(admin_token),
                json={"status": "reviewed"},
            )
            assert patch.status_code == 200, patch.text
            assert patch.json().get("status") == "reviewed"


class TestEnrollment:
    def test_enrollment_initially_null(self, api_base_url):
        with make_client(api_base_url) as client:
            _, token = register_member(client, "enrollinit")
            r = client.get("/enrollment", headers=auth_headers(token))
            assert r.status_code == 200, r.text
            assert r.json().get("data") is None

    def test_save_and_retrieve_draft(self, api_base_url):
        with make_client(api_base_url) as client:
            _, token = register_member(client, "draft")
            save = client.post(
                "/enrollment/save",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            assert save.status_code == 200, save.text
            get = client.get("/enrollment", headers=auth_headers(token))
            assert get.status_code == 200, get.text
            assert get.json().get("data") is not None

    def test_submit_moves_to_pending_review(self, api_base_url):
        with make_client(api_base_url) as client:
            _, token = register_member(client, "submit")
            r = client.post(
                "/enrollment/submit",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            assert r.status_code == 200, r.text
            assert r.json().get("status") == "pending_review"

    def test_admin_list_enrollments(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            creds, token = register_member(member_client, "list")
            member_client.post(
                "/enrollment/submit",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            admin_token = login_admin(admin_client, admin_email, admin_password)
            r = admin_client.get("/enrollment/all", headers=auth_headers(admin_token))
            assert r.status_code == 200, r.text
            enrollments = r.json()
            assert isinstance(enrollments, list)
            ours = [e for e in enrollments if e.get("user_email") == creds["email"]]
            assert len(ours) >= 1
            assert "user_name" in ours[0]

    def test_approve_generates_member_id(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            creds, token = register_member(member_client, "approve")
            member_client.post(
                "/enrollment/submit",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            admin_token = login_admin(admin_client, admin_email, admin_password)
            all_r = admin_client.get("/enrollment/all", headers=auth_headers(admin_token))
            enrollments = all_r.json()
            ours = [e for e in enrollments if e.get("user_email") == creds["email"]]
            assert ours, "No enrollment found for test member"
            enrollment_id = ours[0]["id"]

            approve = admin_client.post(
                f"/enrollment/{enrollment_id}/approve",
                headers=auth_headers(admin_token),
            )
            assert approve.status_code == 200, approve.text
            member_id = approve.json().get("member_id")
            assert member_id, "member_id missing from approve response"
            assert MEMBER_ID_PATTERN.match(member_id), f"Bad member_id format: {member_id}"

            me = member_client.get("/auth/me", headers=auth_headers(token))
            assert me.json().get("enrollment_complete") is True

    def test_reject_sets_rejected_status(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            creds, token = register_member(member_client, "reject")
            member_client.post(
                "/enrollment/submit",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            admin_token = login_admin(admin_client, admin_email, admin_password)
            all_r = admin_client.get("/enrollment/all", headers=auth_headers(admin_token))
            enrollments = all_r.json()
            ours = [e for e in enrollments if e.get("user_email") == creds["email"]]
            assert ours
            enrollment_id = ours[0]["id"]

            reject = admin_client.post(
                f"/enrollment/{enrollment_id}/reject",
                headers=auth_headers(admin_token),
                json={"status": "rejected", "reason": "Incomplete documentation"},
            )
            assert reject.status_code == 200, reject.text
            assert reject.json().get("ok") is True

            refreshed = admin_client.get("/enrollment/all", headers=auth_headers(admin_token))
            rejected = next(e for e in refreshed.json() if e["id"] == enrollment_id)
            assert rejected.get("status") == "rejected"


class TestMembership:
    def test_card_404_before_approval(self, api_base_url):
        with make_client(api_base_url) as client:
            _, token = register_member(client, "nocard")
            r = client.get("/membership/card", headers=auth_headers(token))
            assert r.status_code == 404

    def test_card_after_approval(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            creds, token = register_member(member_client, "card")
            member_client.post(
                "/enrollment/submit",
                headers=auth_headers(token),
                json={"data": ENROLLMENT_DATA},
            )
            admin_token = login_admin(admin_client, admin_email, admin_password)
            all_r = admin_client.get("/enrollment/all", headers=auth_headers(admin_token))
            ours = [e for e in all_r.json() if e.get("user_email") == creds["email"]]
            enrollment_id = ours[0]["id"]
            approve = admin_client.post(
                f"/enrollment/{enrollment_id}/approve",
                headers=auth_headers(admin_token),
            )
            member_id = approve.json()["member_id"]

            r = member_client.get("/membership/card", headers=auth_headers(token))
            assert r.status_code == 200, r.text
            assert r.json().get("member_id") == member_id


class TestAdminStats:
    def test_admin_stats(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as client:
            admin_token = login_admin(client, admin_email, admin_password)
            r = client.get("/admin/stats", headers=auth_headers(admin_token))
            assert r.status_code == 200, r.text
            data = r.json()
            for key in (
                "total_users",
                "total_members",
                "total_applications",
                "pending_applications",
                "pending_enrollments",
                "geographic_distribution",
            ):
                assert key in data, f"Missing key: {key}"


class TestRBAC:
    def test_admin_endpoints_reject_member(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as member_client, make_client(api_base_url) as admin_client:
            _, member_token = register_member(member_client, "rbac")
            login_admin(admin_client, admin_email, admin_password)

            endpoints = [
                ("GET", "/applications"),
                ("GET", "/enrollment/all"),
                ("GET", "/admin/stats"),
                ("GET", "/admin/member-activity"),
                ("GET", "/admin/security/audit"),
                ("GET", "/admin/users"),
            ]
            for method, path in endpoints:
                r = member_client.request(method, path, headers=auth_headers(member_token))
                assert r.status_code == 403, f"{method} {path} expected 403, got {r.status_code}"

    def test_admin_cannot_use_member_self_service(self, api_base_url, admin_email, admin_password):
        with make_client(api_base_url) as client:
            admin_token = login_admin(client, admin_email, admin_password)
            r = client.get("/enrollment", headers=auth_headers(admin_token))
            assert r.status_code == 403, r.text

    def test_member_me_returns_only_own_identity(self, api_base_url):
        with make_client(api_base_url) as client:
            creds, token = register_member(client, "isolate")
            r = client.get("/auth/me", headers=auth_headers(token))
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["email"] == creds["email"]
            assert data["role"] == "member"
            assert "password" not in data

    def test_unauthenticated_returns_401(self, api_base_url):
        with make_client(api_base_url) as client:
            r = client.get("/auth/me")
            assert r.status_code == 401
