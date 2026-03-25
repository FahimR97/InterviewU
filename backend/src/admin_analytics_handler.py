"""Admin platform analytics handler — aggregates answer history across all users."""
import json
import os
import boto3
from collections import defaultdict
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
USER_ANSWERS_TABLE_NAME = os.environ.get("USER_ANSWERS_TABLE_NAME")


def decimal_to_float(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


def check_admin(event) -> bool:
    """Return True if the caller's Cognito token includes the Admin group."""
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        groups_raw = claims.get("cognito:groups", "")
        # API Gateway serialises list claims as a comma-separated string
        groups = [g.strip() for g in groups_raw.split(",")] if groups_raw else []
        return "Admin" in groups
    except (KeyError, TypeError):
        return False


def handler(event, context):
    if not check_admin(event):
        return {
            "statusCode": 403,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Admin access required"}),
        }

    if not USER_ANSWERS_TABLE_NAME:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Table not configured"}),
        }

    try:
        table = dynamodb.Table(USER_ANSWERS_TABLE_NAME)

        # Full scan — acceptable at this scale; note as known tradeoff
        response = table.scan()
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))

        if not items:
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({
                    "total_attempts": 0,
                    "unique_users": 0,
                    "avg_score": None,
                    "pass_rate": 0,
                    "by_category": [],
                    "by_difficulty": [],
                    "by_mode": {},
                    "low_scoring_categories": [],
                }),
            }

        total_attempts = len(items)
        unique_users = len({item["userId"] for item in items})
        all_scores = [float(item["score"]) for item in items]
        avg_score = round(sum(all_scores) / total_attempts, 1)
        pass_count = sum(1 for item in items if item.get("is_correct"))
        pass_rate = round(pass_count / total_attempts * 100, 1)

        # By category
        cat_data: dict = defaultdict(lambda: {"scores": [], "correct": 0})
        for item in items:
            cat = item.get("category", "unknown")
            cat_data[cat]["scores"].append(float(item["score"]))
            if item.get("is_correct"):
                cat_data[cat]["correct"] += 1

        by_category = sorted(
            [
                {
                    "category": cat,
                    "attempts": len(d["scores"]),
                    "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1),
                    "pass_rate": round(d["correct"] / len(d["scores"]) * 100, 1),
                }
                for cat, d in cat_data.items()
            ],
            key=lambda x: x["avg_score"],
        )

        # By difficulty
        diff_data: dict = defaultdict(lambda: {"scores": [], "correct": 0})
        for item in items:
            diff = item.get("difficulty", "unknown").lower()
            diff_data[diff]["scores"].append(float(item["score"]))
            if item.get("is_correct"):
                diff_data[diff]["correct"] += 1

        diff_order = {"easy": 0, "medium": 1, "hard": 2}
        by_difficulty = sorted(
            [
                {
                    "difficulty": diff,
                    "attempts": len(d["scores"]),
                    "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1),
                    "pass_rate": round(d["correct"] / len(d["scores"]) * 100, 1),
                }
                for diff, d in diff_data.items()
            ],
            key=lambda x: diff_order.get(x["difficulty"], 99),
        )

        # By mode (practice vs test)
        mode_data: dict = defaultdict(lambda: {"scores": [], "correct": 0})
        for item in items:
            mode = item.get("mode", "test")
            mode_data[mode]["scores"].append(float(item["score"]))
            if item.get("is_correct"):
                mode_data[mode]["correct"] += 1

        by_mode = {
            mode: {
                "attempts": len(d["scores"]),
                "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1),
                "pass_rate": round(d["correct"] / len(d["scores"]) * 100, 1),
            }
            for mode, d in mode_data.items()
        }

        # Categories where avg score < 60 — areas needing better content
        low_scoring_categories = [c["category"] for c in by_category if c["avg_score"] < 60]

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {
                    "total_attempts": total_attempts,
                    "unique_users": unique_users,
                    "avg_score": avg_score,
                    "pass_rate": pass_rate,
                    "by_category": by_category,
                    "by_difficulty": by_difficulty,
                    "by_mode": by_mode,
                    "low_scoring_categories": low_scoring_categories,
                },
                default=decimal_to_float,
            ),
        }

    except Exception as e:
        print(f"Admin analytics error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to fetch analytics"}),
        }