"""
Unit tests for admin authorization in questions_handler.

Covers:
- get_user_groups: single group, multiple groups, list format, no groups
- is_admin: true/false cases
- require_admin: allows admin, blocks non-admin and unauthenticated
- Handler-level enforcement: POST/PUT/DELETE blocked for non-admins, GET open to all
"""

import json
import os
from unittest.mock import patch, MagicMock

mock_table = MagicMock()
mock_dynamodb = MagicMock()
mock_dynamodb.Table.return_value = mock_table

with patch.dict(
    os.environ,
    {"TABLE_NAME": "test-table", "LOG_LEVEL": "INFO", "AWS_DEFAULT_REGION": "eu-west-1"},
):
    with patch("boto3.resource", return_value=mock_dynamodb):
        from questions_handler import handler, get_user_groups, is_admin, require_admin


def make_event(method, path, body=None, groups=None):
    """Build a minimal API Gateway proxy event with optional Cognito group claims."""
    event = {
        "httpMethod": method,
        "path": path,
        "headers": {},
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-abc-123",
                    "email": "test@example.com",
                    "cognito:username": "testuser",
                }
            }
        },
    }
    if body:
        event["body"] = json.dumps(body)
    if groups:
        event["requestContext"]["authorizer"]["claims"]["cognito:groups"] = groups
    return event


def make_context():
    ctx = MagicMock()
    ctx.aws_request_id = "test-request-id"
    return ctx


# --- get_user_groups ---

def test_get_user_groups_single():
    event = make_event("GET", "/questions", groups="Admin")
    assert get_user_groups(event) == ["Admin"]


def test_get_user_groups_comma_separated():
    event = make_event("GET", "/questions", groups="Admin,Users")
    assert set(get_user_groups(event)) == {"Admin", "Users"}


def test_get_user_groups_list():
    event = make_event("GET", "/questions", groups=["Admin", "Users"])
    assert get_user_groups(event) == ["Admin", "Users"]


def test_get_user_groups_none():
    event = make_event("GET", "/questions")
    assert get_user_groups(event) == []


# --- is_admin ---

def test_is_admin_true():
    event = make_event("GET", "/questions", groups="Admin")
    assert is_admin(event) is True


def test_is_admin_false_wrong_group():
    event = make_event("GET", "/questions", groups="Users")
    assert is_admin(event) is False


def test_is_admin_false_no_groups():
    event = make_event("GET", "/questions")
    assert is_admin(event) is False


# --- require_admin ---

def test_require_admin_passes_for_admin():
    event = make_event("DELETE", "/questions/123", groups="Admin")
    assert require_admin(event) is None


def test_require_admin_blocks_non_admin():
    event = make_event("DELETE", "/questions/123", groups="Users")
    result = require_admin(event)
    assert result is not None
    assert result["statusCode"] == 403
    assert "Forbidden" in result["body"]


def test_require_admin_blocks_unauthenticated():
    event = make_event("DELETE", "/questions/123")
    result = require_admin(event)
    assert result is not None
    assert result["statusCode"] == 403


# --- Handler-level enforcement ---

def test_post_as_admin_creates_question():
    mock_table.put_item.return_value = {}
    event = make_event(
        "POST", "/questions",
        body={"question_text": "What is AWS?", "category": "AWS", "difficulty": "Easy", "reference_answer": "A cloud platform"},
        groups="Admin",
    )
    response = handler(event, make_context())
    assert response["statusCode"] == 201
    body = json.loads(response["body"])
    assert body["question_text"] == "What is AWS?"
    assert "id" in body


def test_post_as_non_admin_is_forbidden():
    event = make_event(
        "POST", "/questions",
        body={"question_text": "What is AWS?", "category": "AWS", "difficulty": "Easy"},
        groups="Users",
    )
    response = handler(event, make_context())
    assert response["statusCode"] == 403


def test_post_missing_required_field_returns_400():
    event = make_event(
        "POST", "/questions",
        body={"question_text": "What is AWS?"},  # missing category and difficulty
        groups="Admin",
    )
    response = handler(event, make_context())
    assert response["statusCode"] == 400
    assert "Missing required field" in response["body"]


def test_put_as_admin_updates_question():
    mock_table.get_item.return_value = {
        "Item": {"id": "123", "question_text": "Old text", "category": "AWS", "difficulty": "Easy"}
    }
    mock_table.update_item.return_value = {}

    event = make_event(
        "PUT", "/questions/123",
        body={"difficulty": "Hard"},
        groups="Admin",
    )
    response = handler(event, make_context())
    assert response["statusCode"] == 200


def test_put_as_non_admin_is_forbidden():
    event = make_event(
        "PUT", "/questions/123",
        body={"difficulty": "Hard"},
        groups="Users",
    )
    response = handler(event, make_context())
    assert response["statusCode"] == 403


def test_delete_as_admin_succeeds():
    mock_table.delete_item.return_value = {}
    event = make_event("DELETE", "/questions/123", groups="Admin")
    response = handler(event, make_context())
    assert response["statusCode"] == 204


def test_delete_as_non_admin_is_forbidden():
    event = make_event("DELETE", "/questions/123", groups="Users")
    response = handler(event, make_context())
    assert response["statusCode"] == 403


def test_get_questions_allowed_for_non_admin():
    mock_table.scan.return_value = {"Items": []}
    event = make_event("GET", "/questions", groups="Users")
    response = handler(event, make_context())
    assert response["statusCode"] == 200


def test_get_single_question_allowed_for_non_admin():
    mock_table.get_item.return_value = {
        "Item": {"id": "123", "question_text": "Test?", "category": "AWS", "difficulty": "Easy"}
    }
    event = make_event("GET", "/questions/123", groups="Users")
    response = handler(event, make_context())
    assert response["statusCode"] == 200
