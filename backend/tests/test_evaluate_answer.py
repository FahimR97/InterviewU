import json
import pytest
from unittest.mock import Mock, patch
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from evaluate_answer import handler


@patch("evaluate_answer.bedrock")
def test_evaluate_answer_success(mock_bedrock):
    """Test successful answer evaluation"""
    mock_response = {
        "body": Mock(
            read=lambda: json.dumps(
                {
                    "content": [
                        {
                            "text": json.dumps(
                                {
                                    "is_correct": True,
                                    "score": 85,
                                    "strengths": ["Good explanation"],
                                    "improvements": ["Add more detail"],
                                    "suggestions": ["Include examples"],
                                    "marcus_comment": "Great work!",
                                }
                            )
                        }
                    ]
                }
            ).encode()
        )
    }
    mock_bedrock.invoke_model.return_value = mock_response

    event = {
        "body": json.dumps(
            {
                "question": "Explain OSI model",
                "answer": "7 layers",
                "competency_type": "networking",
            }
        )
    }
    context = Mock(aws_request_id="test-123")

    response = handler(event, context)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["score"] == 85
    assert body["is_correct"] is True


@patch("evaluate_answer.bedrock")
def test_evaluate_answer_missing_fields(mock_bedrock):
    """Test validation for missing required fields"""
    event = {"body": json.dumps({"question": "Test"})}
    context = Mock(aws_request_id="test-123")

    response = handler(event, context)

    assert response["statusCode"] == 400
    body = json.loads(response["body"])
    assert "error" in body


@patch("evaluate_answer.bedrock")
def test_evaluate_answer_strips_markdown(mock_bedrock):
    """Test markdown code block stripping"""
    mock_response = {
        "body": Mock(
            read=lambda: json.dumps(
                {
                    "content": [
                        {
                            "text": '```json\n{"is_correct": true, "score": 90, "strengths": [], "improvements": [], "suggestions": [], "marcus_comment": "Good"}\n```'
                        }
                    ]
                }
            ).encode()
        )
    }
    mock_bedrock.invoke_model.return_value = mock_response

    event = {
        "body": json.dumps(
            {"question": "Test", "answer": "Test answer", "competency_type": "coding"}
        )
    }
    context = Mock(aws_request_id="test-123")

    response = handler(event, context)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["score"] == 90
