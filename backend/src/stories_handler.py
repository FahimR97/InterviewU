"""STAR Story Builder — CRUD handler for user stories."""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("USER_STORIES_TABLE_NAME", "")
table = dynamodb.Table(TABLE_NAME)

LEADERSHIP_PRINCIPLES = [
    "Customer Obsession",
    "Ownership",
    "Learn and Be Curious",
    "Insist on the Highest Standards",
    "Bias for Action",
    "Earn Trust",
    "Dive Deep",
    "Deliver Results",
]


def _get_user_id(event):
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("sub", None)
    )


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body),
    }


def handler(event, context):
    try:
        method = event.get("httpMethod", "")
        user_id = _get_user_id(event)
        if not user_id:
            return _response(401, {"error": "Unauthorized"})

        path_params = event.get("pathParameters") or {}
        story_id = path_params.get("storyId")

        if method == "GET":
            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key(
                    "userId"
                ).eq(user_id)
            )
            items = response.get("Items", [])
            while "LastEvaluatedKey" in response:
                response = table.query(
                    KeyConditionExpression=boto3.dynamodb.conditions.Key(
                        "userId"
                    ).eq(user_id),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))
            return _response(200, items)

        elif method == "POST":
            body = json.loads(event.get("body", "{}"))
            title = body.get("title", "").strip()
            if not title:
                return _response(400, {"error": "Title is required"})
            if len(title) > 200:
                return _response(
                    400, {"error": "Title exceeds 200 characters"}
                )

            tags = body.get("tags", [])
            if not isinstance(tags, list):
                return _response(
                    400, {"error": "Tags must be a list"}
                )

            item = {
                "userId": user_id,
                "storyId": str(uuid.uuid4()),
                "title": title,
                "situation": body.get("situation", ""),
                "task": body.get("task", ""),
                "action": body.get("action", ""),
                "result": body.get("result", ""),
                "tags": tags,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            table.put_item(Item=item)
            return _response(201, item)

        elif method == "PUT":
            if not story_id:
                return _response(400, {"error": "storyId required"})
            body = json.loads(event.get("body", "{}"))

            allowed = {
                "title",
                "situation",
                "task",
                "action",
                "result",
                "tags",
            }
            updates = {
                k: v for k, v in body.items() if k in allowed
            }
            if not updates:
                return _response(
                    400, {"error": "No valid fields to update"}
                )

            updates["updated_at"] = datetime.now(
                timezone.utc
            ).isoformat()

            expr_parts = []
            expr_values = {}
            expr_names = {}
            for i, (k, v) in enumerate(updates.items()):
                attr = f"#a{i}"
                val = f":v{i}"
                expr_parts.append(f"{attr} = {val}")
                expr_names[attr] = k
                expr_values[val] = v

            table.update_item(
                Key={"userId": user_id, "storyId": story_id},
                UpdateExpression="SET " + ", ".join(expr_parts),
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
            return _response(200, {"message": "Story updated"})

        elif method == "DELETE":
            if not story_id:
                return _response(400, {"error": "storyId required"})
            table.delete_item(
                Key={"userId": user_id, "storyId": story_id}
            )
            return _response(200, {"message": "Story deleted"})

        return _response(405, {"error": "Method not allowed"})

    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": "Internal server error"})
