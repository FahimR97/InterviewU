import { awsConfig } from '../aws-config';

export interface Question {
  id: string;
  category: string;
  competency: string;
  create_at: string;
  difficulty: string;
  question_text: string;
  reference_answer: string;
}

export interface EvaluationRequest {
  question: string;
  answer: string;
  competency_type?: string;
  question_id?: string;
  category?: string;
  difficulty?: string;
  mode?: 'practice' | 'test';
}

export interface EvaluationResponse {
  is_correct: boolean;
  score: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  marcus_comment: string;
}

export interface AnalyticsCategoryEntry {
  category: string;
  avg_score: number;
  count: number;
}

export interface AnalyticsDifficultyEntry {
  difficulty: string;
  avg_score: number;
  count: number;
}

export interface AnalyticsTimeEntry {
  date: string;
  avg_score: number;
  attempts: number;
  categories?: Record<string, number>;
}

export interface AnalyticsResponse {
  total_attempts: number;
  avg_score: number | null;
  by_category: AnalyticsCategoryEntry[];
  by_difficulty: AnalyticsDifficultyEntry[];
  scores_over_time: AnalyticsTimeEntry[];
  weak_areas: string[];
  recommendation: string;
}

const API_BASE_URL = awsConfig.API.REST.InterviewQuestionsAPI.endpoint;

/**
 * Public signup endpoint (no authentication required)
 */
export async function signupUser(email: string, name: string): Promise<{ message: string; username: string }> {
  const response = await fetch(`${API_BASE_URL}signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!response.ok) throw new Error((await response.json()).error || 'Signup failed');
  return response.json();
}

/**
 * Fetch all questions from the API
 */
export async function getAllQuestions(authToken: string | null): Promise<Question[]> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = authToken;
  }

  const response = await fetch(`${API_BASE_URL}questions`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch questions: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch a single question by ID
 */
export async function getQuestionById(id: string, authToken: string | null): Promise<Question> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = authToken;
  }

  const response = await fetch(`${API_BASE_URL}questions/${id}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Question not found');
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch question: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Evaluate a candidate's answer using Marcus AI
 */
export async function evaluateAnswer(
  request: EvaluationRequest,
  authToken: string | null
): Promise<EvaluationResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = authToken;
  }

  const response = await fetch(`${API_BASE_URL}answers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to evaluate answer: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch analytics for the authenticated user
 */
export async function getAnalytics(authToken: string | null): Promise<AnalyticsResponse> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = authToken;

  const response = await fetch(`${API_BASE_URL}analytics`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch analytics: ${response.status} ${errorText}`);
  }

  return response.json();
}
