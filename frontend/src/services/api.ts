import { awsConfig } from '../aws-config';

export interface Question {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
}

export interface EvaluationRequest {
  question: string;
  answer: string;
  competency_type?: string;
}

export interface EvaluationResponse {
  is_correct: boolean;
  score: number;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  marcus_comment: string;
}

const API_BASE_URL = awsConfig.API.REST.InterviewQuestionsAPI.endpoint;

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
