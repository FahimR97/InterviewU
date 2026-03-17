import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timezone

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
You evaluate candidate answers for L4 Systems Engineer and
Systems Development Engineer roles.

Evaluate this candidate's answer:

Question: {question_text}
Candidate's Answer: {user_answer}
Competency: {competency_type}

Respond ONLY with valid JSON in this exact format:
{{
  "is_correct": true/false,
  "score": 0-100,
  "strengths": ["point1", "point2"],
  "improvements": ["point1", "point2"],
  "suggestions": ["point1", "point2"],
  "marcus_comment": "Your encouraging message here"
}}

Be constructive, specific, and encouraging."""

        # Call Bedrock Claude 3.7 Sonnet
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

        response_body = json.loads(response["body"].read())
        feedback_text = response_body["content"][0]["text"]

        # Strip markdown code blocks if present
        if feedback_text.startswith("```"):
            feedback_text = feedback_text.strip("`").strip()
            if feedback_text.startswith("json"):
                feedback_text = feedback_text[4:].strip()

        # Parse JSON from Marcus
        feedback = json.loads(feedback_text)

        # Persist answer record for analytics (best-effort — never blocks the response)
        if user_id and USER_ANSWERS_TABLE_NAME:
            try:
                table = dynamodb.Table(USER_ANSWERS_TABLE_NAME)
                table.put_item(Item={
                    "userId": user_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "questionId": question_id,
                    "category": category,
                    "difficulty": difficulty,
                    "score": Decimal(str(feedback.get("score", 0))),
                    "is_correct": feedback.get("is_correct", False),
                })
            except Exception as write_err:
                print(f"Warning: failed to persist answer record: {write_err}")

        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(feedback),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }