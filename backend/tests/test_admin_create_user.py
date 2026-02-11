import json
import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import ClientError
import sys
import os

# Set AWS region before importing module to avoid NoRegionError in CI
os.environ.setdefault('AWS_DEFAULT_REGION', 'eu-west-1')
os.environ.setdefault('USER_POOL_ID', 'test-pool-id')

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from admin_create_user import handler, is_valid_email


def test_valid_email():
    """Test valid email addresses"""
    assert is_valid_email('user@example.com') is True
    assert is_valid_email('test.user@example.co.uk') is True
    assert is_valid_email('user+tag@example.com') is True


def test_invalid_email():
    """Test invalid email addresses"""
    assert is_valid_email('invalid') is False
    assert is_valid_email('invalid@') is False
    assert is_valid_email('@example.com') is False
    assert is_valid_email('user@.com') is False
    assert is_valid_email('') is False


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_successful_user_creation(mock_cognito):
    """Test successful user creation"""
    mock_cognito.admin_create_user.return_value = {
        'User': {
            'Username': 'test@example.com',
            'UserStatus': 'FORCE_CHANGE_PASSWORD'
        }
    }

    event = {
        'body': json.dumps({
            'email': 'test@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'Account created!' in body['message']
    assert body['username'] == 'test@example.com'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_email_case_normalization(mock_cognito):
    """Test email is converted to lowercase"""
    mock_cognito.admin_create_user.return_value = {'User': {}}

    event = {
        'body': json.dumps({
            'email': 'Test@EXAMPLE.COM'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 200
    call_args = mock_cognito.admin_create_user.call_args
    assert call_args[1]['Username'] == 'test@example.com'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_missing_email(mock_cognito):
    """Test error when email is missing"""
    event = {
        'body': json.dumps({})
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['error'] == 'Email is required'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_invalid_email_format(mock_cognito):
    """Test error when email format is invalid"""
    event = {
        'body': json.dumps({
            'email': 'invalid-email'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['error'] == 'Invalid email format'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_user_already_exists(mock_cognito):
    """Test error when user already exists"""
    mock_cognito.admin_create_user.side_effect = ClientError(
        {'Error': {'Code': 'UsernameExistsException', 'Message': 'User exists'}},
        'AdminCreateUser'
    )

    event = {
        'body': json.dumps({
            'email': 'existing@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['error'] == 'User already exists'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_invalid_parameter(mock_cognito):
    """Test error when Cognito rejects invalid parameters"""
    mock_cognito.admin_create_user.side_effect = ClientError(
        {'Error': {'Code': 'InvalidParameterException', 'Message': 'Invalid param'}},
        'AdminCreateUser'
    )

    event = {
        'body': json.dumps({
            'email': 'test@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['error'] == 'Invalid parameters provided'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_cognito_service_error(mock_cognito):
    """Test error when Cognito service fails"""
    mock_cognito.admin_create_user.side_effect = ClientError(
        {'Error': {'Code': 'ServiceException', 'Message': 'Service error'}},
        'AdminCreateUser'
    )

    event = {
        'body': json.dumps({
            'email': 'test@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert response['statusCode'] == 500
    body = json.loads(response['body'])
    assert body['error'] == 'Failed to create account. Please try again later.'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_cors_headers(mock_cognito):
    """Test that CORS headers are present in response"""
    mock_cognito.admin_create_user.return_value = {'User': {}}

    event = {
        'body': json.dumps({
            'email': 'test@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    response = handler(event, context)

    assert 'headers' in response
    assert response['headers']['Access-Control-Allow-Origin'] == '*'
    assert response['headers']['Content-Type'] == 'application/json'


@patch('admin_create_user.cognito_client')
@patch.dict(os.environ, {'USER_POOL_ID': 'test-pool-id'})
def test_email_verified_attribute(mock_cognito):
    """Test that email_verified is set to true"""
    mock_cognito.admin_create_user.return_value = {'User': {}}

    event = {
        'body': json.dumps({
            'email': 'test@example.com'
        })
    }
    context = Mock(aws_request_id='test-123')

    handler(event, context)

    call_args = mock_cognito.admin_create_user.call_args
    user_attributes = call_args[1]['UserAttributes']

    email_verified_attr = [attr for attr in user_attributes if attr['Name'] == 'email_verified']
    assert len(email_verified_attr) == 1
    assert email_verified_attr[0]['Value'] == 'true'
