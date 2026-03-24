import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timezone

from custom_metrics import EvaluationMetrics, timer

bedrock = boto3.client("bedrock-runtime", region_name="eu-west-2")
dynamodb = boto3.resource("dynamodb")

USER_ANSWERS_TABLE_NAME = os.environ.get("USER_ANSWERS_TABLE_NAME")


def handler(event, context):
    """
    Marcus - AI Interview Coach via direct Bedrock invocation
    """
    try:
        body = json.loads(event.get("body", "{}"))
        question_text = body.get("question")
        user_answer = body.get("answer")
        competency_type = body.get("competency_type", "general")
        question_id = body.get("question_id", "unknown")
        category = body.get("category", "unknown")
        difficulty = body.get("difficulty", "unknown")
        mode = body.get("mode", "practice")  # "test" writes analytics, "practice" skips

        if not question_text or not user_answer:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Missing question or answer"}),
            }

        # Extract userId from Cognito JWT claims (injected by API Gateway authorizer)
        user_id = None
        try:
            claims = event["requestContext"]["authorizer"]["claims"]
            user_id = claims.get("sub")
        except (KeyError, TypeError):
            pass

        # Marcus evaluation prompt
        prompt = f"""You are Marcus, a strict AI interview coach for AWS.
You evaluate candidates for L4 Systems Engineer and Systems Development Engineer roles.

Evaluate this candidate's answer honestly and rigorously — as a real interviewer would.

Question: {question_text}
Candidate's Answer: {user_answer}
Competency: {competency_type}

Scoring guide (apply strictly):
- 0–10: Completely wrong, irrelevant, or a non-answer
  (e.g. "Hello World", "I don't know", a single unrelated word)
- 11–30: Shows minimal relevant understanding but misses the core concept entirely
- 31–50: Partially relevant but significant gaps, vague, or incorrect in key areas
- 51–70: Correct direction but lacks depth, specifics, or real-world application
- 71–85: Solid answer with good technical accuracy, minor gaps
- 86–100: Excellent — specific, accurate, demonstrates real experience

Do NOT inflate scores. A wrong answer must score low. An irrelevant answer scores 0–10.
is_correct should be true only if the answer is substantially correct (score >= 60).

Respond ONLY with valid JSON in this exact format:
{{
  "is_correct": true/false,
  "score": 0-100,
  "strengths": ["point1", "point2"],
  "improvements": ["point1", "point2"],
  "suggestions": ["point1", "point2"],
  "marcus_comment": "Your honest, direct feedback here"
}}

Be rigorous and specific. Candidates need accurate feedback to improve."""

        # Call Bedrock Claude 3.7 Sonnet — track latency for monitoring
        t0 = timer()
        response = bedrock.invoke_model(
            modelId="anthropic.claude-3-7-sonnet-20250219-v1:0",
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 1000,
                    "messages": [{"role": "user", "content": prompt}],
                }
            ),
        )
        EvaluationMetrics.ai_response_time(timer() - t0)

        response_body = json.loads(response["body"].read())
        feedback_text = response_body["content"][0]["text"]

        # Strip markdown code blocks if present
        if feedback_text.startswith("```"):
            feedback_text = feedback_text.strip("`").strip()
            if feedback_text.startswith("json"):
                feedback_text = feedback_text[4:].strip()

        # Parse JSON from Marcus
        feedback = json.loads(feedback_text)

        # Persist answer record for analytics — both practice and test modes
        if user_id and USER_ANSWERS_TABLE_NAME:
            try:
                table = dynamodb.Table(USER_ANSWERS_TABLE_NAME)
                table.put_item(Item={
                    "userId": user_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "questionId": question_id,
                    "category": category,
                    "difficulty": difficulty,
                    "mode": mode,
                    "score": Decimal(str(feedback.get("score", 0))),
                    "is_correct": feedback.get("is_correct", False),
                })
            except Exception as write_err:
                print(f"Warning: failed to persist answer record: {write_err}")

        # Emit business metrics — score, category breakdown, pass rate
        EvaluationMetrics.answer_evaluated(
            score=feedback.get("score", 0),
            category=category,
            mode=mode,
            is_correct=feedback.get("is_correct", False),
        )

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(feedback),
        }

    except Exception as e:
        EvaluationMetrics.evaluation_failure(type(e).__name__)
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
