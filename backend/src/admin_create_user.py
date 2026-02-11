"""
Admin endpoint to create users - bypasses self-registration restriction.
Since selfSignUpEnabled=false, use AdminCreateUser API instead.

This endpoint is PUBLIC but has security measures:
- Email validation
- Rate limiting (recommended via API Gateway)
- Cognito sends temporary password via email
- User must change password on first login
"""

import json
import os
import re
import boto3
from botocore.exceptions import ClientError

cognito_client = boto3.client("cognito-idp")
USER_POOL_ID = os.environ.get("USER_POOL_ID")


def is_valid_email(email):
    """Basic email validation"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def handler(event, context):
    """
    Public API to create users securely.

    Security measures:
    - Email format validation
    - Cognito sends temporary password via email
    - User MUST change password on first login
    - Rate limiting should be configured at API Gateway level
    """
    try:
        body = json.loads(event.get("body", "{}"))
        email = body.get("email", "").strip().lower()

        if not email:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Email is required"}),
            }

        if not is_valid_email(email):
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid email format"}),
            }

        # Create user with AdminCreateUser
        # Bypasses self-registration restriction
        # Cognito will send a temporary password via email
        cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            DesiredDeliveryMediums=["EMAIL"],
            ForceAliasCreation=False,
            # MessageAction NOT set - Cognito sends welcome email
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "message": (
                        "Account created! Check your email for a "
                        "temporary password. You must change it on "
                        "first login."
                    ),
                    "username": email,
                }
            ),
        }

    except ClientError as e:
        error_code = e.response["Error"]["Code"]

        if error_code == "UsernameExistsException":
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "User already exists"}),
            }

        if error_code == "InvalidParameterException":
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({"error": "Invalid parameters provided"}),
            }

        print(f"Error creating user: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"error": "Failed to create account. Please try again later."}
            ),
        }

    except Exception as e:
        print(f"Unexpected error: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": "An unexpected error occurred"}),
        }
