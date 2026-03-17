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

    # All categories are above 60 — find lowest to suggest continued improvement
    lowest = min(by_category, key=lambda c: c["avg_score"])
    return (
        f"You're doing well across the board! "
        f"To push further, focus on {lowest['category']} "
        f"where there's still room to grow."
    )


def handler(event, context):
    try:
        # Extract userId from Cognito JWT claims
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

        # Query all answers for this user (efficient single-partition read)
        response = table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        items = response.get("Items", [])

        # Handle pagination for users with many answers
        while "LastEvaluatedKey" in response:
            response = table.query(
                KeyConditionExpression=Key("userId").eq(user_id),
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            items.extend(response.get("Items", []))

        if not items:
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({
                    "total_attempts": 0,
                    "avg_score": None,
                    "by_category": [],
                    "by_difficulty": [],
                    "scores_over_time": [],
                    "weak_areas": [],
                    "recommendation": (
                        "No data yet. Start practising to see your stats."
                    ),
                }),
            }

        total_attempts = len(items)
        all_scores = [float(item["score"]) for item in items]
        avg_score = sum(all_scores) / total_attempts

        # Aggregate by category
        cat_scores = defaultdict(list)
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
        diff_scores = defaultdict(list)
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

        # Scores over time — group by date (first 10 chars of ISO timestamp)
        day_scores = defaultdict(list)
        for item in items:
            day = item.get("timestamp", "")[:10]  # "2026-03-17"
            if day:
                day_scores[day].append(float(item["score"]))

        scores_over_time = [
            {
                "date": day,
                "avg_score": round(sum(scores) / len(scores), 1),
                "attempts": len(scores),
            }
            for day, scores in sorted(day_scores.items())
        ]

        # Weak areas: categories with avg_score < 60
        weak_areas = [c["category"] for c in by_category if c["avg_score"] < 60]

        recommendation = build_recommendation(by_category)

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {
                    "total_attempts": total_attempts,
                    "avg_score": round(avg_score, 1),
                    "by_category": by_category,
                    "by_difficulty": by_difficulty,
                    "scores_over_time": scores_over_time,
                    "weak_areas": weak_areas,
                    "recommendation": recommendation,
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