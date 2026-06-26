import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire firebase/app and firebase/firestore modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDocRef = { id: 'new-doc-id' };
const mockDoc = vi.fn(() => mockDocRef);
const mockGetDocs = vi.fn();
const mockGetCountFromServer = vi.fn();
const mockCollection = vi.fn(() => 'scores-col-ref');
const mockQuery = vi.fn((...args) => args);
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TS');

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: mockCollection,
  doc: mockDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  where: mockWhere,
  getDocs: mockGetDocs,
  getCountFromServer: mockGetCountFromServer,
  serverTimestamp: mockServerTimestamp,
}));

// Import after mocks are set up
const { submitScore, fetchTopScores, getPlayerRank } = await import('./firebase');

describe('submitScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new entry with id field when player name does not exist yet', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockSetDoc.mockResolvedValue(undefined);

    const result = await submitScore('TestPlayer', 42);

    expect(mockSetDoc).toHaveBeenCalledWith(
      mockDocRef,
      { id: 'new-doc-id', name: 'TestPlayer', score: 42, createdAt: 'SERVER_TS' },
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ docId: 'new-doc-id', bestScore: 42 });
  });

  it('updates the score when new score beats the existing one', async () => {
    const fakeRef = {};
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'existing-id', ref: fakeRef, data: () => ({ name: 'TestPlayer', score: 30 }) }],
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    const result = await submitScore('TestPlayer', 50);

    expect(mockUpdateDoc).toHaveBeenCalledWith(fakeRef, { score: 50, createdAt: 'SERVER_TS' });
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ docId: 'existing-id', bestScore: 50 });
  });

  it('keeps the existing entry and returns the stored best when the run is lower', async () => {
    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'existing-id', ref: {}, data: () => ({ name: 'TestPlayer', score: 100 }) }],
    });

    const result = await submitScore('TestPlayer', 40);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ docId: 'existing-id', bestScore: 100 });
  });
});

describe('fetchTopScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped ScoreRecords sorted by score', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'doc1', data: () => ({ name: 'Alice', score: 100, createdAt: null }) },
        { id: 'doc2', data: () => ({ name: 'Bob',   score: 50,  createdAt: null }) },
      ],
    });
    const results = await fetchTopScores(10);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: 'doc1', name: 'Alice', score: 100 });
    expect(results[1]).toMatchObject({ id: 'doc2', name: 'Bob',   score: 50 });
  });
});

describe('getPlayerRank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { count: 4, rank: 5 },  // 4 higher scores → rank 5
    { count: 0, rank: 1 },  // none higher → rank 1
  ])('returns higher-score count + 1 (count $count → rank $rank)', async ({ count, rank }) => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count }) });
    expect(await getPlayerRank(30)).toBe(rank);
  });
});
