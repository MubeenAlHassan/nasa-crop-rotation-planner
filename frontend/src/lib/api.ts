import { RecommendationRequest, RecommendationResponse } from '../types/api';

export async function fetchRotationPlan(payload: RecommendationRequest): Promise<RecommendationResponse> {
  const response = await fetch('http://localhost:8000/api/v1/recommend-rotation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
