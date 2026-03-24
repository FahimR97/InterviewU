"""
Tests for custom_metrics.py.

Strategy: patch _get_client() to return a mock CloudWatch client so no
real AWS calls are made and no region config is required.
"""

import pytest
from unittest.mock import MagicMock, patch, call

import custom_metrics
from custom_metrics import (
    QuestionsMetrics,
    EvaluationMetrics,
    timer,
    NAMESPACE,
)


@pytest.fixture(autouse=True)
def mock_cloudwatch():
    """Replace the CloudWatch client with a mock for every test."""
    mock_client = MagicMock()
    with patch("custom_metrics._get_client", return_value=mock_client):
        # Reset the module-level singleton so lazy init re-runs each test
        custom_metrics._cloudwatch = None
        yield mock_client


# ── _emit ────────────────────────────────────────────────────────────────────

def test_emit_calls_put_metric_data(mock_cloudwatch):
    custom_metrics._emit("TestMetric", 42.0, "Count")

    mock_cloudwatch.put_metric_data.assert_called_once()
    kwargs = mock_cloudwatch.put_metric_data.call_args.kwargs
    assert kwargs["Namespace"] == NAMESPACE
    data = kwargs["MetricData"][0]
    assert data["MetricName"] == "TestMetric"
    assert data["Value"] == 42.0
    assert data["Unit"] == "Count"


def test_emit_includes_dimensions_when_provided(mock_cloudwatch):
    dims = [{"Name": "Category", "Value": "networking"}]
    custom_metrics._emit("TestMetric", 1, "Count", dims)

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["Dimensions"] == dims


def test_emit_omits_dimensions_when_none(mock_cloudwatch):
    custom_metrics._emit("TestMetric", 1, "Count", None)

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert "Dimensions" not in data


def test_emit_never_raises_on_client_error(mock_cloudwatch):
    mock_cloudwatch.put_metric_data.side_effect = Exception("network error")

    # Must not raise
    custom_metrics._emit("TestMetric", 1, "Count")


# ── QuestionsMetrics ─────────────────────────────────────────────────────────

def test_questions_listed_emits_correct_metric(mock_cloudwatch):
    QuestionsMetrics.questions_listed(10)

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "QuestionsListed"
    assert data["Value"] == 10


def test_question_viewed_emits_with_category_dimension(mock_cloudwatch):
    QuestionsMetrics.question_viewed(category="networking")

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "QuestionViewed"
    assert {"Name": "Category", "Value": "networking"} in data["Dimensions"]


def test_question_viewed_emits_without_dimension_when_no_category(mock_cloudwatch):
    QuestionsMetrics.question_viewed(category=None)

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "QuestionViewed"
    assert "Dimensions" not in data


def test_question_not_found_emits_correct_metric(mock_cloudwatch):
    QuestionsMetrics.question_not_found()

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "QuestionNotFound"
    assert data["Value"] == 1


# ── EvaluationMetrics ────────────────────────────────────────────────────────

def test_answer_evaluated_emits_five_metrics(mock_cloudwatch):
    EvaluationMetrics.answer_evaluated(
        score=75, category="networking", mode="test", is_correct=True
    )

    assert mock_cloudwatch.put_metric_data.call_count == 5


def test_answer_evaluated_emits_score(mock_cloudwatch):
    EvaluationMetrics.answer_evaluated(
        score=80, category="compute", mode="practice", is_correct=False
    )

    metric_names = [
        call.kwargs["MetricData"][0]["MetricName"]
        for call in mock_cloudwatch.put_metric_data.call_args_list
    ]
    assert "AnswerEvaluated" in metric_names
    assert "EvaluationScore" in metric_names
    assert "EvaluationByCategory" in metric_names
    assert "EvaluationByMode" in metric_names
    assert "AnswerPassRate" in metric_names


def test_ai_response_time_emits_milliseconds(mock_cloudwatch):
    EvaluationMetrics.ai_response_time(350.5)

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "MarcusResponseTime"
    assert data["Value"] == 350.5
    assert data["Unit"] == "Milliseconds"


def test_evaluation_failure_emits_with_error_type_dimension(mock_cloudwatch):
    EvaluationMetrics.evaluation_failure("JSONDecodeError")

    data = mock_cloudwatch.put_metric_data.call_args.kwargs["MetricData"][0]
    assert data["MetricName"] == "EvaluationFailure"
    assert {"Name": "ErrorType", "Value": "JSONDecodeError"} in data["Dimensions"]


# ── timer ────────────────────────────────────────────────────────────────────

def test_timer_returns_positive_float():
    t = timer()
    assert isinstance(t, float)
    assert t > 0