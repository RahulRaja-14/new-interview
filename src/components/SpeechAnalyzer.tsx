// Speech analysis utility for detecting speech patterns
export interface SpeechMetrics {
  fillerWords: string[];
  fillerCount: number;
  pauseCount: number;
  averageWordsPerMinute: number;
  sentenceCount: number;
  grammarIssues: string[];
}

const FILLER_WORDS = [
  "um", "uh", "like", "you know", "actually", "basically", "literally",
  "so", "well", "i mean", "kind of", "sort of", "right", "okay so",
  "you see", "honestly", "frankly", "anyway", "whatever"
];

const GRAMMAR_PATTERNS = [
  { pattern: /\bi is\b/gi, issue: "Subject-verb disagreement: 'I is' should be 'I am'" },
  { pattern: /\bhe don't\b/gi, issue: "Subject-verb disagreement: 'he don't' should be 'he doesn't'" },
  { pattern: /\bshe don't\b/gi, issue: "Subject-verb disagreement: 'she don't' should be 'she doesn't'" },
  { pattern: /\bthey was\b/gi, issue: "Subject-verb disagreement: 'they was' should be 'they were'" },
  { pattern: /\bme and\b/gi, issue: "Consider using 'X and I' instead of 'me and X'" },
  { pattern: /\bdid went\b/gi, issue: "Double past tense: 'did went' should be 'went' or 'did go'" },
  { pattern: /\bmore better\b/gi, issue: "Double comparative: 'more better' should be 'better'" },
  { pattern: /\bmost best\b/gi, issue: "Double superlative: 'most best' should be 'best'" },
  { pattern: /\bcould of\b/gi, issue: "'could of' should be 'could have'" },
  { pattern: /\bshould of\b/gi, issue: "'should of' should be 'should have'" },
  { pattern: /\bwould of\b/gi, issue: "'would of' should be 'would have'" },
];

export function analyzeSpeech(
  transcripts: string[],
  durationSeconds: number
): SpeechMetrics {
  const fullText = transcripts.join(" ").toLowerCase();
  const words = fullText.split(/\s+/).filter(w => w.length > 0);
  
  // Count fillers
  const detectedFillers: string[] = [];
  FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, "gi");
    const matches = fullText.match(regex);
    if (matches) {
      detectedFillers.push(...matches);
    }
  });

  // Detect grammar issues
  const grammarIssues: string[] = [];
  GRAMMAR_PATTERNS.forEach(({ pattern, issue }) => {
    if (pattern.test(fullText)) {
      grammarIssues.push(issue);
    }
  });

  // Count pauses (approximated by long gaps represented as "..." or multiple spaces)
  const pauseCount = (fullText.match(/\.\.\./g) || []).length + 
                     (fullText.match(/,\s*,/g) || []).length;

  // Calculate WPM
  const minutes = durationSeconds / 60;
  const wpm = minutes > 0 ? Math.round(words.length / minutes) : 0;

  // Count sentences
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  return {
    fillerWords: [...new Set(detectedFillers)],
    fillerCount: detectedFillers.length,
    pauseCount,
    averageWordsPerMinute: wpm,
    sentenceCount: sentences.length,
    grammarIssues: [...new Set(grammarIssues)]
  };
}

export function calculateConfidenceIndicators(
  metrics: SpeechMetrics,
  durationSeconds: number
): {
  confidenceLevel: "Low" | "Medium" | "High";
  fearIndicator: "Low" | "Moderate" | "High";
  nervousHabits: string[];
} {
  const nervousHabits: string[] = [];
  let nervousnessScore = 0;

  // High filler rate indicates nervousness
  const fillerRate = metrics.fillerCount / Math.max(metrics.sentenceCount, 1);
  if (fillerRate > 2) {
    nervousHabits.push("Excessive use of filler words (um, uh, like)");
    nervousnessScore += 3;
  } else if (fillerRate > 1) {
    nervousHabits.push("Moderate use of filler words");
    nervousnessScore += 1;
  }

  // Too slow or too fast speaking
  if (metrics.averageWordsPerMinute < 100) {
    nervousHabits.push("Speaking too slowly - may indicate uncertainty");
    nervousnessScore += 2;
  } else if (metrics.averageWordsPerMinute > 180) {
    nervousHabits.push("Speaking too fast - may indicate nervousness");
    nervousnessScore += 2;
  }

  // Many pauses
  const pauseRate = metrics.pauseCount / Math.max(durationSeconds / 60, 1);
  if (pauseRate > 5) {
    nervousHabits.push("Frequent long pauses during speech");
    nervousnessScore += 2;
  }

  // Calculate levels
  const confidenceLevel = nervousnessScore <= 2 ? "High" : 
                          nervousnessScore <= 4 ? "Medium" : "Low";
  
  const fearIndicator = nervousnessScore <= 1 ? "Low" :
                        nervousnessScore <= 3 ? "Moderate" : "High";

  return {
    confidenceLevel,
    fearIndicator,
    nervousHabits
  };
}
