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
        prompt = f"""You are Marcus, an AI interview coach for AWS.
You evaluate candidates for L4 Systems Engineer and Systems Development Engineer roles.

Question: {question_text}
Candidate's Answer: {user_answer}
Competency: {competency_type}

Score the answer on a scale of 1 to 5:
- 1: No attempt, nonsense, or completely unrelated
  (e.g. blank, "Hello World", "asdf", random words — score exactly 1)
- 2: Tried but the answer has no real relevance to the question
- 3: On the right track — understands the concept but significant gaps
- 4: Strong answer — accurate, decent depth, minor gaps
- 5: Excellent — specific, accurate, shows real experience

Rules:
- Output only a whole number 1–5 in the score field. No decimals.
- Do not inflate. Score what was actually said.
- is_correct is true only if score >= 3.

Tone:
- Warm, supportive, coaching — like a mentor who wants them to succeed
- Never harsh or discouraging
- For scores 1–2: briefly acknowledge the attempt, then give clear actionable
  guidance on what to study
- marcus_comment should be honest but end on an encouraging note
- Do NOT ask follow-up questions, offer resources, or suggest the candidate
  reach out for more help — this is a one-shot evaluation, there is no reply

Respond ONLY with valid JSON:
{{
  "is_correct": true/false,
  "score": 1-5,
  "strengths": ["point1", "point2"],
  "improvements": ["point1", "point2"],
  "suggestions": ["point1", "point2"],
  "marcus_comment": "Honest, warm, coaching message"
}}"""

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

        # Marcus scores 1–5; convert to 0–100 for storage and analytics
        raw_stars = int(feedback.get("score", 1))
        feedback["score"] = raw_stars * 20

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
