import { describe, it, expect } from 'vitest';

interface DwiCriteria {
  workItemExists: boolean;
  prLinked: boolean;
  ciPassed: boolean;
  prApproved: boolean;
  prMerged: boolean;
  workItemClosed: boolean;
}

function isBillable(criteria: DwiCriteria): boolean {
  return (
    criteria.workItemExists &&
    criteria.prLinked &&
    criteria.ciPassed &&
    criteria.prApproved &&
    criteria.prMerged &&
    criteria.workItemClosed
  );
}

describe('DWI Billing Criteria', () => {
  it('should be billable when all 6 criteria are met', () => {
    expect(isBillable({
      workItemExists: true,
      prLinked: true,
      ciPassed: true,
      prApproved: true,
      prMerged: true,
      workItemClosed: true,
    })).toBe(true);
  });

  it('should NOT be billable if CI fails', () => {
    expect(isBillable({
      workItemExists: true,
      prLinked: true,
      ciPassed: false,
      prApproved: true,
      prMerged: true,
      workItemClosed: true,
    })).toBe(false);
  });

  it('should NOT be billable if PR not merged', () => {
    expect(isBillable({
      workItemExists: true,
      prLinked: true,
      ciPassed: true,
      prApproved: true,
      prMerged: false,
      workItemClosed: true,
    })).toBe(false);
  });

  it('should NOT be billable if work item not closed', () => {
    expect(isBillable({
      workItemExists: true,
      prLinked: true,
      ciPassed: true,
      prApproved: true,
      prMerged: true,
      workItemClosed: false,
    })).toBe(false);
  });

  it('should NOT be billable if no criteria met', () => {
    expect(isBillable({
      workItemExists: false,
      prLinked: false,
      ciPassed: false,
      prApproved: false,
      prMerged: false,
      workItemClosed: false,
    })).toBe(false);
  });
});
