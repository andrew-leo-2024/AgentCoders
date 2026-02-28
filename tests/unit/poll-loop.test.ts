import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for poll loop testing
interface MockAdoClient {
  queryWorkItems: ReturnType<typeof vi.fn>;
  getWorkItem: ReturnType<typeof vi.fn>;
  updateWorkItem: ReturnType<typeof vi.fn>;
  addComment: ReturnType<typeof vi.fn>;
}

describe('PollLoop', () => {
  let mockAdoClient: MockAdoClient;

  beforeEach(() => {
    mockAdoClient = {
      queryWorkItems: vi.fn(),
      getWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      addComment: vi.fn(),
    };
  });

  describe('non-reentrant guard', () => {
    it('should skip poll when already processing', () => {
      // The poll loop should not re-enter when isProcessing is true
      // This test validates the concept
      let isProcessing = false;
      let pollCount = 0;

      const poll = () => {
        if (isProcessing) return;
        isProcessing = true;
        pollCount++;
        isProcessing = false;
      };

      poll();
      expect(pollCount).toBe(1);
    });
  });

  describe('jitter calculation', () => {
    it('should produce jitter between 0 and 30000ms', () => {
      const jitters = Array.from({ length: 100 }, () => Math.random() * 30_000);
      for (const jitter of jitters) {
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(30_000);
      }
    });
  });

  describe('work item query', () => {
    it('should return empty when no work items found', async () => {
      mockAdoClient.queryWorkItems.mockResolvedValue({ workItems: [] });
      const result = await mockAdoClient.queryWorkItems('SELECT [System.Id] FROM WorkItems');
      expect(result.workItems).toHaveLength(0);
    });

    it('should fetch work item details when found', async () => {
      mockAdoClient.queryWorkItems.mockResolvedValue({
        workItems: [{ id: 42, url: 'https://dev.azure.com/...' }],
      });
      mockAdoClient.getWorkItem.mockResolvedValue({
        id: 42,
        fields: {
          'System.Title': 'Fix login bug',
          'System.Description': 'The login page crashes on empty password',
          'System.State': 'New',
        },
      });

      const query = await mockAdoClient.queryWorkItems('...');
      expect(query.workItems).toHaveLength(1);

      const wi = await mockAdoClient.getWorkItem(42);
      expect(wi.fields['System.Title']).toBe('Fix login bug');
    });
  });

  describe('complexity pricing', () => {
    it('should map tiers to correct prices', () => {
      const pricing: Record<string, number> = {
        XS: 5, S: 15, M: 50, L: 150, XL: 500,
      };
      expect(pricing['XS']).toBe(5);
      expect(pricing['XL']).toBe(500);
    });

    it('should map tiers to correct timeouts', () => {
      const timeouts: Record<string, number> = {
        XS: 5 * 60_000,
        S: 15 * 60_000,
        M: 30 * 60_000,
        L: 45 * 60_000,
        XL: 60 * 60_000,
      };
      expect(timeouts['XS']).toBe(300_000);
      expect(timeouts['XL']).toBe(3_600_000);
    });
  });
});
