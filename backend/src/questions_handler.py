"""
Questions Handler Lambda
Manages CRUD operations for interview questions in DynamoDB.

Endpoints:
- GET /questions - List all questions
- GET /questions/{id} - Get single question by ID
- POST /questions - Create new question
- PUT /questions/{id} - Update existing question
- DELETE /questions/{id} - Delete question
"""

import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


def convert_dynamodb_item(item):
    """
    Convert DynamoDB item to regular Python dict.
    Handles DynamoDB-specific types like sets.
    """
    if isinstance(item, dict):
        return {k: convert_dynamodb_item(v) for k, v in item.items()}
    elif isinstance(item, set):
        return list(item)  # Convert sets to lists
    else:
        return item


def handler(event, context):
    """
    Main Lambda handler for question operations.
    Routes requests based on HTTP method and path.
    """
    path = event["path"]
    method = event.get("httpMethod", "GET")

    try:
        # List all questions
        if path == "/questions":
            if method == "GET":
                # Scan with pagination handling
                items = []
                response = table.scan()
                items.extend(response.get("Items", []))

                # Handle pagination
                while "LastEvaluatedKey" in response:
                    response = table.scan(
                        ExclusiveStartKey=response["LastEvaluatedKey"]
                    )
                    items.extend(response.get("Items", []))

                items = [convert_dynamodb_item(item) for item in items]
                return {
                    "statusCode": 200,
                    "headers": {"Access-Control-Allow-Origin": "*"},
                    "body": json.dumps(items),
                }

        # Get single question by ID
        elif path.startswith("/questions/"):
            question_id = path.split("/")[-1]

            if method == "GET":
                response = table.get_item(Key={"id": question_id})
                if "Item" in response:
                    item = convert_dynamodb_item(response["Item"])
                    return {
                        "statusCode": 200,
                        "headers": {"Access-Control-Allow-Origin": "*"},
                        "body": json.dumps(item),
                    }
                return {
                    "statusCode": 404,
                    "headers": {"Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "Not found"}),
                }

        # Default response
        else:
            return {
                "statusCode": 200,
                "body": json.dumps({"message": "Hello from Lambda!"}),
            }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
