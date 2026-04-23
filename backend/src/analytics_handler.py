"""User analytics handler — aggregates answer history from DynamoDB."""

import json
import os
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from collections import defaultdict

dynamodb = boto3.resource("dynamodb")
USER_ANSWERS_TABLE_NAME = os.environ.get("USER_ANSWERS_TABLE_NAME")


def decimal_to_float(obj):
    """JSON serialiser that converts Decimal to float."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


def build_recommendation(by_category: list) -> str:
    if not by_category:
        return "No data yet. Start practising to see your stats."

    weak = [c for c in by_category if c["avg_score"] < 60]
    if weak:
        worst = min(weak, key=lambda c: c["avg_score"])
        return (
            f"Focus on {worst['category']} — your average score is "
            f"{worst['avg_score']:.0f}/100. "
            "Keep practising questions in that area to build confidence."
        )

    lowest = min(by_category, key=lambda c: c["avg_score"])
    return (
        f"You're doing well across the board! "
        f"To push further, focus on {lowest['category']} "
        f"where there's still room to grow."
    )


def _empty_response(by_mode: dict, message: str) -> dict:
    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps(
            {
                "total_attempts": 0,
                "avg_score": None,
                "pass_rate": 0,
                "by_category": [],
                "by_difficulty": [],
                "scores_over_time": [],
                "weak_areas": [],
                "recommendation": message,
                "by_mode": by_mode,
            }
        ),
    }


def handler(event, context):
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        user_id = claims.get("sub")

        if not user_id:
            return {
                "statusCode": 401,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Unauthorised"}),
            }

        if not USER_ANSWERS_TABLE_NAME:
            return {
                "statusCode": 500,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Table not configured"}),
            }

        table = dynamodb.Table(USER_ANSWERS_TABLE_NAME)

        response = table.query(KeyConditionExpression=Key("userId").eq(user_id))
        items = response.get("Items", [])

        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression=Key("userId").eq(user_id),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        if not items:
            return _empty_response(
                {}, "No data yet. Start practising to see your stats."
            )

        # Compute by_mode BEFORE applying mode filter — always global totals
        mode_data: dict = defaultdict(lambda: {"scores": [], "correct_count": 0})
        for item in items:
            m = item.get("mode", "test")  # pre-change items were test-only
            mode_data[m]["scores"].append(float(item["score"]))
            if item.get("is_correct"):
                mode_data[m]["correct_count"] += 1

        by_mode = {
            m: {
                "count": len(d["scores"]),
                "avg_score": (
                    round(sum(d["scores"]) / len(d["scores"]), 1) if d["scores"] else 0
                ),
                "pass_rate": (
                    round(d["correct_count"] / len(d["scores"]) * 100, 1)
                    if d["scores"]
                    else 0
                ),
            }
            for m, d in mode_data.items()
        }

        # Apply optional mode filter
        qsp = event.get("queryStringParameters") or {}
        mode_filter = (
            qsp.get("mode") if qsp.get("mode") in ("practice", "test") else None
        )
        if mode_filter:
            items = [i for i in items if i.get("mode", "test") == mode_filter]

        if not items:
            return _empty_response(by_mode, f"No {mode_filter} data yet.")

        total_attempts = len(items)
        all_scores = [float(item["score"]) for item in items]
        avg_score = sum(all_scores) / total_attempts

        total_correct = sum(1 for item in items if item.get("is_correct"))
        pass_rate = round(total_correct / total_attempts * 100, 1)

        # Aggregate by category
        cat_scores: dict = defaultdict(list)
        for item in items:
            cat_scores[item.get("category", "unknown")].append(float(item["score"]))

        by_category = [
            {
                "category": cat,
                "avg_score": round(sum(scores) / len(scores), 1),
                "count": len(scores),
            }
            for cat, scores in sorted(cat_scores.items())
        ]

        # Aggregate by difficulty
        diff_scores: dict = defaultdict(list)
        for item in items:
            diff_scores[item.get("difficulty", "unknown")].append(float(item["score"]))

        by_difficulty = [
            {
                "difficulty": diff,
                "avg_score": round(sum(scores) / len(scores), 1),
                "count": len(scores),
            }
            for diff, scores in sorted(diff_scores.items())
        ]

        # Scores over time
        day_data: dict = defaultdict(
            lambda: {"scores": [], "categories": defaultdict(int)}
        )
        for item in items:
            day = item.get("timestamp", "")[:10]
            if day:
                day_data[day]["scores"].append(float(item["score"]))
                cat = item.get("category", "unknown")
                day_data[day]["categories"][cat] += 1

        scores_over_time = [
            {
                "date": day,
                "avg_score": round(sum(d["scores"]) / len(d["scores"]), 1),
                "attempts": len(d["scores"]),
                "categories": dict(d["categories"]),
            }
            for day, d in sorted(day_data.items())
        ]

        weak_areas = [c["category"] for c in by_category if c["avg_score"] < 60]
        recommendation = build_recommendation(by_category)

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {
                    "total_attempts": total_attempts,
                    "avg_score": round(avg_score, 1),
                    "pass_rate": pass_rate,
                    "by_category": by_category,
                    "by_difficulty": by_difficulty,
                    "scores_over_time": scores_over_time,
                    "weak_areas": weak_areas,
                    "recommendation": recommendation,
                    "by_mode": by_mode,
                },
                default=decimal_to_float,
            ),
        }

    except Exception as e:
        print(f"Analytics error: {e}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to fetch analytics"}),
        }
