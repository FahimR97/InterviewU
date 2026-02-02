"""
Integration tests for Alpha environment.
Tests the deployed API Gateway and Lambda functions.

These tests run after deployment to Alpha to verify:
- API Gateway is accessible
- Lambda functions are responding correctly
- Basic smoke tests before promoting to Production
"""

import os
import pytest
import requests


def get_alpha_api_url():
    """Get Alpha API URL from environment variable."""
    api_url = os.environ.get('ALPHA_API_URL')
    if not api_url:
        pytest.skip("ALPHA_API_URL not set - skipping integration tests")
    return api_url.rstrip('/')


def test_alpha_api_testing_endpoint():
    """
    Smoke test: Verify Alpha API Gateway is accessible.
    Tests the /testing endpoint which doesn't require authentication.
    """
    api_url = get_alpha_api_url()

    response = requests.get(f"{api_url}/testing", timeout=10)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    # Verify it's actually hitting our Lambda
    response_data = response.json()
    assert "message" in response_data or "Hello" in response_data.get("message", "")


def test_alpha_api_has_cors_headers():
    """
    Verify CORS headers are present for frontend compatibility.
    """
    api_url = get_alpha_api_url()

    response = requests.get(f"{api_url}/testing", timeout=10)

    # Check for CORS header
    assert "access-control-allow-origin" in response.headers, \
        "Missing CORS header - frontend won't be able to call API"


def test_alpha_questions_endpoint_exists():
    """
    Verify /questions endpoint exists (may return 401 if auth required).
    This checks the route is configured correctly in API Gateway.
    """
    api_url = get_alpha_api_url()

    response = requests.get(f"{api_url}/questions", timeout=10)

    # 200 (success) or 401 (unauthorized) both mean endpoint is working
    # 403 (forbidden) means Cognito authorizer is working
    # 404 means route isn't configured
    assert response.status_code in [200, 401, 403], \
        f"Unexpected status {response.status_code} - endpoint may not be configured"


def test_alpha_evaluate_endpoint_exists():
    """
    Verify /answers endpoint exists for Marcus AI evaluation.
    This checks the evaluate endpoint is configured correctly.
    """
    api_url = get_alpha_api_url()

    response = requests.post(f"{api_url}/answers", json={}, timeout=10)

    # 200, 400 (bad request), 401 (unauthorized), or 403 (forbidden) all mean endpoint exists
    # 404 means route isn't configured
    assert response.status_code in [200, 400, 401, 403], \
        f"Unexpected status {response.status_code} - evaluate endpoint may not be configured"
