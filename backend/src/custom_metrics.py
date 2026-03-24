"""
Custom CloudWatch Metrics for InterviewU.

Emits business-level metrics beyond what AWS provides out of the box,
giving visibility into how the platform is used and where
improvement is needed.

Metrics tracked:
- Question access patterns (list requests, individual views, 404s)
- AI evaluation usage, scores, and latency (Marcus)
- Per-category and per-mode breakdowns for targeted improvement
- System performance indicators
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

import boto3

logger = logging.getLogger(__name__)
# Lazy — created on first emission to keep import fast
_cloudwatch = None

NAMESPACE = "InterviewU"


def _get_client():
    global _cloudwatch
    if _cloudwatch is None:
        _cloudwatch = boto3.client(
            "cloudwatch", region_name="eu-west-2"
        )
    return _cloudwatch


def _emit(
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[list] = None,
) -> None:
    """Emit a custom CloudWatch metric. Never raises."""
    try:
        data = {
            "MetricName": metric_name,
            "Value": value,
            "Unit": unit,
            "Timestamp": datetime.now(timezone.utc),
        }
        if dimensions:
            data["Dimensions"] = dimensions

        _get_client().put_metric_data(
            Namespace=NAMESPACE, MetricData=[data]
        )
        logger.debug(
            "Emitted metric %s=%s %s",
            metric_name, value, unit,
        )
    except Exception as exc:
        logger.warning(
            "Failed to emit metric %s: %s",
            metric_name, exc,
        )


class QuestionsMetrics:
    """Business metrics for the questions Lambda."""

    @staticmethod
    def questions_listed(count: int) -> None:
        """Questions returned on a list request."""
        _emit("QuestionsListed", count, "Count")

    @staticmethod
    def question_viewed(
        category: Optional[str] = None,
    ) -> None:
        """A single question was fetched by ID."""
        dims = []
        if category:
            dims.append(
                {"Name": "Category", "Value": category}
            )
        _emit("QuestionViewed", 1, "Count", dims or None)

    @staticmethod
    def question_not_found() -> None:
        """Requested question ID did not exist."""
        _emit("QuestionNotFound", 1, "Count")


class EvaluationMetrics:
    """Business metrics for the AI evaluation Lambda."""

    @staticmethod
    def answer_evaluated(
        score: int,
        category: str,
        mode: str,
        is_correct: bool,
    ) -> None:
        """
        An answer was evaluated. Emits:
        - AnswerEvaluated count (overall volume)
        - EvaluationScore (use Average in dashboard)
        - EvaluationByCategory (topic breakdown)
        - EvaluationByMode (practice vs test)
        - AnswerPassRate (improvement indicator)
        """
        _emit("AnswerEvaluated", 1, "Count")
        _emit("EvaluationScore", float(score), "None")
        _emit(
            "EvaluationByCategory", 1, "Count",
            [{"Name": "Category",
              "Value": category or "unknown"}],
        )
        _emit(
            "EvaluationByMode", 1, "Count",
            [{"Name": "Mode",
              "Value": mode or "practice"}],
        )
        _emit(
            "AnswerPassRate", 1, "Count",
            [{"Name": "IsCorrect",
              "Value": str(is_correct)}],
        )

    @staticmethod
    def ai_response_time(duration_ms: float) -> None:
        """Bedrock response time — p99 catches throttling."""
        _emit(
            "MarcusResponseTime", duration_ms,
            "Milliseconds",
        )

    @staticmethod
    def evaluation_failure(error_type: str) -> None:
        """Evaluation failed. Dimension on error type."""
        _emit(
            "EvaluationFailure", 1, "Count",
            [{"Name": "ErrorType", "Value": error_type}],
        )


def timer() -> float:
    """Monotonic time in ms — use with ai_response_time."""
    return time.monotonic() * 1000
