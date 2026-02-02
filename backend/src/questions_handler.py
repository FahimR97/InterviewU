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
import logging
import os
import sys
import boto3

# Configure JSON structured logging for CloudWatch
logger = logging.getLogger()
log_level = os.environ.get('LOG_LEVEL', 'INFO')
logger.setLevel(getattr(logging, log_level))

# JSON formatter for structured logs
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
        }

        # Add extra fields if present
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if hasattr(record, 'path'):
            log_data['path'] = record.path
        if hasattr(record, 'method'):
            log_data['method'] = record.method
        if hasattr(record, 'error_type'):
            log_data['error_type'] = record.error_type
        if hasattr(record, 'question_id'):
            log_data['question_id'] = record.question_id
        if hasattr(record, 'question_count'):
            log_data['question_count'] = record.question_count

        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        return json.dumps(log_data)

# Apply JSON formatter to handler
log_handler = logging.StreamHandler(sys.stdout)
log_handler.setFormatter(JsonFormatter())
logger.handlers = [log_handler]

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
        return list(item)
    else:
        return item


def handler(event, context):
    """
    Main Lambda handler for question operations.
    Routes requests based on HTTP method and path.
    """
    path = event["path"]
    method = event.get("httpMethod", "GET")
    request_id = context.aws_request_id if context else "local"

    # Create logger adapter with request context
    log_extra = {'request_id': request_id, 'method': method, 'path': path}

    logger.info("Incoming request", extra=log_extra)

    try:
        # List all questions
        if path == "/questions":
            if method == "GET":
                logger.info("Fetching all questions from DynamoDB", extra=log_extra)

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

                logger.info(
                    "Successfully retrieved questions",
                    extra={**log_extra, 'question_count': len(items)}
                )

                return {
                    "statusCode": 200,
                    "headers": {"Access-Control-Allow-Origin": "*"},
                    "body": json.dumps(items),
                }

        # Get single question by ID
        elif path.startswith("/questions/"):
            question_id = path.split("/")[-1]

            if method == "GET":
                logger.info(
                    "Fetching single question",
                    extra={**log_extra, 'question_id': question_id}
                )

                response = table.get_item(Key={"id": question_id})

                if "Item" in response:
                    item = convert_dynamodb_item(response["Item"])
                    logger.info(
                        "Question found",
                        extra={**log_extra, 'question_id': question_id}
                    )
                    return {
                        "statusCode": 200,
                        "headers": {"Access-Control-Allow-Origin": "*"},
                        "body": json.dumps(item),
                    }

                logger.warning(
                    "Question not found",
                    extra={**log_extra, 'question_id': question_id}
                )
                return {
                    "statusCode": 404,
                    "headers": {"Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "Not found"}),
                }

        # Default response
        else:
            logger.info("Fallback route accessed", extra=log_extra)
            return {
                "statusCode": 200,
                "body": json.dumps({"message": "Hello from Lambda!"}),
            }

    except Exception as e:
        logger.error(
            "Error processing request",
            extra={
                **log_extra,
                'error_type': type(e).__name__,
            },
            exc_info=True
        )

        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
