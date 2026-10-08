import { compareTwoStrings } from 'string-similarity';

export const FUZZY_MATCH_THRESHOLD = Number(process.env.FUZZY_MATCH_THRESHOLD ?? 0.8);

/**
 * Normalize a raw submitted word: trim, lowercase, strip punctuation,
 * collapse internal whitespace.
 */
export function normalizeWord(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ClusterCandidate {
  id: string;
  canonical_word: string;
}

/**
 * Given a normalized word and the existing clusters for a question,
 * return the best matching cluster id (if similarity >= threshold) or
 * null if a new cluster should be created.
 */
export function findBestCluster(
  normalized: string,
  clusters: ClusterCandidate[],
  threshold: number = FUZZY_MATCH_THRESHOLD
): ClusterCandidate | null {
  let best: ClusterCandidate | null = null;
  let bestScore = 0;
  for (const cluster of clusters) {
    const score = compareTwoStrings(normalized, cluster.canonical_word);
    if (score > bestScore) {
      bestScore = score;
      best = cluster;
    }
  }
  if (best && bestScore >= threshold) {
    return best;
  }
  return null;
}
