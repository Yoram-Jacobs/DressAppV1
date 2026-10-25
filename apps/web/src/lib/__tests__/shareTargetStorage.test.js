import { getSharedMediaFromStorage } from '../shareTargetStorage';

describe('shareTargetStorage - getSharedMediaFromStorage', () => {
  let originalIndexedDB;

  beforeEach(() => {
    originalIndexedDB = window.indexedDB;
  });

  afterEach(() => {
    window.indexedDB = originalIndexedDB;
  });

  it('resolves null gracefully when indexedDB is unavailable', async () => {
    delete window.indexedDB;
    const result = await getSharedMediaFromStorage();
    expect(result).toBeNull();
  });

  it('retrieves and deletes stored media from indexedDB shares store', async () => {
    const mockFile = new File(['dummy content'], 'screenshot.png', { type: 'image/png' });
    let storedData = { latest_shared_image: mockFile };

    const mockStore = {
      get: jest.fn(() => {
        const req = {};
        setTimeout(() => {
          req.result = storedData['latest_shared_image'];
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      delete: jest.fn((key) => {
        delete storedData[key];
      }),
    };

    const mockTx = {
      objectStore: jest.fn(() => mockStore),
    };

    const mockDb = {
      objectStoreNames: {
        contains: jest.fn(() => true),
      },
      transaction: jest.fn(() => mockTx),
      close: jest.fn(),
    };

    window.indexedDB = {
      open: jest.fn(() => {
        const req = {};
        setTimeout(() => {
          req.result = mockDb;
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
    };

    const retrieved = await getSharedMediaFromStorage();
    expect(retrieved).toBe(mockFile);
    expect(mockStore.delete).toHaveBeenCalledWith('latest_shared_image');
    expect(mockDb.close).toHaveBeenCalled();
  });
});
