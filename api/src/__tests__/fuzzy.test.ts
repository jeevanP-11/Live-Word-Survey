import { normalizeWord, findBestCluster } from '../lib/fuzzy';

describe('normalizeWord', () => {
  it('trims whitespace', () => {
    expect(normalizeWord('  happy  ')).toBe('happy');
  });

  it('lowercases', () => {
    expect(normalizeWord('HAPPY')).toBe('happy');
  });

  it('strips punctuation', () => {
    expect(normalizeWord('happy!!')).toBe('happy');
    expect(normalizeWord("don't-worry")).toBe('dontworry');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeWord('so   happy')).toBe('so happy');
  });

  it('handles empty / whitespace-only input', () => {
    expect(normalizeWord('   ')).toBe('');
  });
});

describe('findBestCluster', () => {
  const clusters = [
    { id: '1', canonical_word: 'happy' },
    { id: '2', canonical_word: 'excited' },
    { id: '3', canonical_word: 'grateful' }
  ];

  it('matches an exact word to its cluster', () => {
    const match = findBestCluster('happy', clusters);
    expect(match?.id).toBe('1');
  });

  it('matches a near-typo above the threshold', () => {
    // "hapy" is a one-character-deletion typo of "happy"
    const match = findBestCluster('hapy', clusters, 0.8);
    expect(match?.id).toBe('1');
  });

  it('does not match a dissimilar word', () => {
    const match = findBestCluster('banana', clusters, 0.8);
    expect(match).toBeNull();
  });

  it('returns null when clusters is empty', () => {
    expect(findBestCluster('anything', [])).toBeNull();
  });

  it('picks the highest-scoring cluster when multiple are above threshold', () => {
    const closeClusters = [
      { id: 'a', canonical_word: 'happiness' },
      { id: 'b', canonical_word: 'happy' }
    ];
    const match = findBestCluster('happy', closeClusters, 0.5);
    expect(match?.id).toBe('b');
  });

  it('respects a stricter threshold', () => {
    const match = findBestCluster('hapy', clusters, 0.99);
    expect(match).toBeNull();
  });
});
