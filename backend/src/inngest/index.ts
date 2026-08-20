import { inngest } from "./client.js";
import { generateInsightFunction } from "./functions/generateInsight.js";
import { generateReviewFunction } from "./functions/generateReview.js";

// Re-export the client for use elsewhere (e.g. controllers)
export { inngest };

// All Inngest functions
export const functions = [generateReviewFunction, generateInsightFunction];
