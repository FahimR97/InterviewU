"""User settings handler — persists per-user preferences in DynamoDB.

GET  /settings  → returns current settings (interview_date, etc.)
PUT  /settings  → saves/updates settings (partial updates supported)
"""

import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
USER_SETTINGS_TABLE_NAME = os.environ.get("USER_SETTINGS_TABLE_NAME")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
}

ALLOWED_KEYS = {"interview_date"}


def handler(event, context):
    method = event.get("httpMethod", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        user_id = claims.get("sub")
    except (KeyError, TypeError):
        user_id = None

    if not user_id:
        return {
            "statusCode": 401,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Unauthorised"}),
        }

    table = dynamodb.Table(USER_SETTINGS_TABLE_NAME)

    if method == "GET":
        resp = table.get_item(Key={"userId": user_id})
        item = resp.get("Item", {})
        # Strip internal DynamoDB key from response
        item.pop("userId", None)
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(item),
        }

    if method == "PUT":
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "Invalid JSON"}),
            }

        # Only allow known settings keys — reject unknown fields
        updates = {k: v for k, v in body.items() if k in ALLOWED_KEYS}
        if not updates:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "No valid settings fields provided"}),
            }

        # Build update expression dynamically for partial updates
        expr_parts = []
        expr_names = {}
        expr_values = {}
        for i, (k, v) in enumerate(updates.items()):
            placeholder = f"#k{i}"
            value_placeholder = f":v{i}"
            expr_parts.append(f"{placeholder} = {value_placeholder}")
            expr_names[placeholder] = k
            expr_values[value_placeholder] = v

        table.update_item(
            Key={"userId": user_id},
            UpdateExpression="SET " + ", ".join(expr_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Settings saved"}),
        }

    return {
        "statusCode": 405,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": "Method not allowed"}),
    }
