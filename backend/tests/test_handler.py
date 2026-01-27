import json
import os
import sys
from unittest.mock import patch, MagicMock

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Mock boto3 and environment before importing handler
mock_table = MagicMock()
mock_dynamodb = MagicMock()
mock_dynamodb.Table.return_value = mock_table

with patch.dict(os.environ, {'TABLE_NAME': 'test-table', 'AWS_DEFAULT_REGION': 'us-east-1'}):
    with patch('boto3.resource', return_value=mock_dynamodb):
        from handler import handler


def test_handler_hello_endpoint():
    event = {"path": "/testing"}
    response = handler(event, {})
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["message"] == "Hello from Lambda!"


@patch('handler.table')
def test_get_all_questions(mock_table):
    mock_table.scan.return_value = {
        'Items': [
            {
                'id': '1',
                'title': 'Test Question',
                'difficulty': 'Easy',
                'tags': {'Networking', 'Fundamentals'}
            }
        ]
    }

    event = {"path": "/questions"}
    response = handler(event, {})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert len(body) == 1
    assert body[0]["title"] == "Test Question"
    assert isinstance(body[0]["tags"], list)


@patch('handler.table')
def test_get_single_question(mock_table):
    mock_table.get_item.return_value = {
        'Item': {
            'id': '1',
            'title': 'Test Question',
            'difficulty': 'Easy',
            'tags': {'Networking'}
        }
    }

    event = {"path": "/questions/1"}
    response = handler(event, {})

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["title"] == "Test Question"
    assert isinstance(body["tags"], list)


@patch('handler.table')
def test_question_not_found(mock_table):
    mock_table.get_item.return_value = {}

    event = {"path": "/questions/999"}
    response = handler(event, {})

    assert response["statusCode"] == 404


@patch('handler.table')
def test_error_handling(mock_table):
    mock_table.scan.side_effect = Exception("DynamoDB error")

    event = {"path": "/questions"}
    response = handler(event, {})

    assert response["statusCode"] == 500
    body = json.loads(response["body"])
    assert "error" in body
