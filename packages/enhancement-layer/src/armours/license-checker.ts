import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('license-checker');

interface LicenseMatch {
  license: string;
  spdxId: string;
  category: 'permissive' | 'copyleft' | 'weak-copyleft' | 'proprietary' | 'unknown';
  line: number;
  snippet: string;
}

interface LicenseInfo {
  spdxId: string;
  names: string[];
  pattern: RegExp;
  category: 'permissive' | 'copyleft' | 'weak-copyleft' | 'proprietary' | 'unknown';
}

const LICENSE_DATABASE: LicenseInfo[] = [
  // Permissive licenses
  {
    spdxId: 'MIT',
    names: ['MIT License', 'MIT'],
    pattern: /\bMIT\s+License\b|(?:Permission\s+is\s+hereby\s+granted.*?without\s+restriction)/gi,
    category: 'permissive',
  },
  {
    spdxId: 'Apache-2.0',
    names: ['Apache License 2.0', 'Apache-2.0'],
    pattern: /\bApache\s+License(?:,?\s+Version)?\s*2(?:\.0)?\b|Licensed\s+under\s+the\s+Apache\s+License/gi,
    category: 'permissive',
  },
  {
    spdxId: 'BSD-2-Clause',
    names: ['BSD 2-Clause', 'Simplified BSD'],
    pattern: /\bBSD\s+2[- ]Clause\b|\bSimplified\s+BSD\b/gi,
    category: 'permissive',
  },
  {
    spdxId: 'BSD-3-Clause',
    names: ['BSD 3-Clause', 'New BSD'],
    pattern: /\bBSD\s+3[- ]Clause\b|\bNew\s+BSD\b|\bModified\s+BSD\b/gi,
    category: 'permissive',
  },
  {
    spdxId: 'ISC',
    names: ['ISC License'],
    pattern: /\bISC\s+License\b/gi,
    category: 'permissive',
  },
  {
    spdxId: 'Unlicense',
    names: ['Unlicense', 'The Unlicense'],
    pattern: /\bUnlicense\b|\bpublic\s+domain\b/gi,
    category: 'permissive',
  },
  {
    spdxId: 'CC0-1.0',
    names: ['CC0', 'Creative Commons Zero'],
    pattern: /\bCC0(?:\s+1\.0)?\b|\bCreative\s+Commons\s+Zero\b/gi,
    category: 'permissive',
  },

  // Copyleft licenses
  {
    spdxId: 'GPL-2.0-only',
    names: ['GNU GPL v2', 'GPLv2'],
    pattern: /\bGNU\s+General\s+Public\s+License(?:,?\s+version)?\s*2\b|\bGPL[- ]?v?2(?:\.0)?\b/gi,
    category: 'copyleft',
  },
  {
    spdxId: 'GPL-3.0-only',
    names: ['GNU GPL v3', 'GPLv3'],
    pattern: /\bGNU\s+General\s+Public\s+License(?:,?\s+version)?\s*3\b|\bGPL[- ]?v?3(?:\.0)?\b/gi,
    category: 'copyleft',
  },
  {
    spdxId: 'AGPL-3.0-only',
    names: ['GNU AGPL v3', 'AGPLv3'],
    pattern: /\bAGPL[- ]?v?3(?:\.0)?\b|\bAffero\s+General\s+Public\s+License/gi,
    category: 'copyleft',
  },

  // Weak copyleft
  {
    spdxId: 'LGPL-2.1-only',
    names: ['GNU LGPL v2.1', 'LGPLv2.1'],
    pattern: /\bLGPL[- ]?v?2\.1\b|\bLesser\s+General\s+Public\s+License(?:,?\s+version)?\s*2\.1/gi,
    category: 'weak-copyleft',
  },
  {
    spdxId: 'LGPL-3.0-only',
    names: ['GNU LGPL v3', 'LGPLv3'],
    pattern: /\bLGPL[- ]?v?3(?:\.0)?\b|\bLesser\s+General\s+Public\s+License(?:,?\s+version)?\s*3/gi,
    category: 'weak-copyleft',
  },
  {
    spdxId: 'MPL-2.0',
    names: ['Mozilla Public License 2.0', 'MPL-2.0'],
    pattern: /\bMPL[- ]?2(?:\.0)?\b|\bMozilla\s+Public\s+License(?:,?\s+version)?\s*2/gi,
    category: 'weak-copyleft',
  },
  {
    spdxId: 'EPL-2.0',
    names: ['Eclipse Public License 2.0', 'EPL-2.0'],
    pattern: /\bEPL[- ]?2(?:\.0)?\b|\bEclipse\s+Public\s+License/gi,
    category: 'weak-copyleft',
  },

  // Proprietary / restrictive
  {
    spdxId: 'SSPL-1.0',
    names: ['Server Side Public License'],
    pattern: /\bSSPL\b|\bServer\s+Side\s+Public\s+License/gi,
    category: 'proprietary',
  },
  {
    spdxId: 'BSL-1.1',
    names: ['Business Source License'],
    pattern: /\bBSL[- ]?1\.1\b|\bBusiness\s+Source\s+License/gi,
    category: 'proprietary',
  },
  {
    spdxId: 'BUSL-1.1',
    names: ['MariaDB BSL'],
    pattern: /\bBUSL[- ]?1\.1\b/gi,
    category: 'proprietary',
  },
];

const COPYRIGHT_PATTERN = /(?:copyright|©|\(c\))\s+(?:\d{4}[-,\s]*)*\s*(.{3,80}?)(?:\.\s|,\s|\n|$)/gi;

export class LicenseChecker implements EnhancementStage {
  readonly name = 'license-checker';
  readonly type = 'armour' as const;

  private readonly allowedLicenses: readonly string[];

  constructor(allowedLicenses: string[] = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']) {
    this.allowedLicenses = allowedLicenses;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, allowedLicenses: this.allowedLicenses },
      'License checker executing',
    );

    const matches = this.scanForLicenses(input);
    const copyrightNotices = this.scanForCopyright(input);

    if (matches.length === 0 && copyrightNotices.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          licensesFound: [],
          copyrightNotices: [],
          compliant: true,
          message: 'No license mentions detected',
        },
      };
    }

    // Check compliance
    const violations: string[] = [];
    const warnings: string[] = [];

    for (const match of matches) {
      if (!this.allowedLicenses.includes(match.spdxId)) {
        if (match.category === 'copyleft') {
          violations.push(`Copyleft license "${match.spdxId}" detected on line ${match.line} — not in allowed list`);
        } else if (match.category === 'proprietary') {
          violations.push(`Proprietary/restrictive license "${match.spdxId}" detected on line ${match.line}`);
        } else {
          warnings.push(`License "${match.spdxId}" (${match.category}) on line ${match.line} — not in allowed list`);
        }
      }
    }

    const compliant = violations.length === 0;

    logger.info(
      {
        licensesFound: matches.map((m) => m.spdxId),
        violations: violations.length,
        warnings: warnings.length,
        compliant,
      },
      'License check complete',
    );

    return {
      content: input,
      modified: false,
      details: {
        licensesFound: matches.map((m) => ({
          spdxId: m.spdxId,
          category: m.category,
          line: m.line,
          snippet: m.snippet,
        })),
        copyrightNotices,
        allowedLicenses: [...this.allowedLicenses],
        violations,
        warnings,
        compliant,
      },
    };
  }

  private scanForLicenses(input: string): LicenseMatch[] {
    const matches: LicenseMatch[] = [];
    const lines = input.split('\n');

    for (const licenseInfo of LICENSE_DATABASE) {
      licenseInfo.pattern.lastIndex = 0;

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum]!;
        licenseInfo.pattern.lastIndex = 0;

        if (licenseInfo.pattern.test(line)) {
          matches.push({
            license: licenseInfo.names[0]!,
            spdxId: licenseInfo.spdxId,
            category: licenseInfo.category,
            line: lineNum + 1,
            snippet: line.trim().substring(0, 100),
          });
        }
      }
    }

    // Deduplicate by spdxId (keep first occurrence)
    const seen = new Set<string>();
    return matches.filter((m) => {
      if (seen.has(m.spdxId)) return false;
      seen.add(m.spdxId);
      return true;
    });
  }

  private scanForCopyright(input: string): Array<{ text: string; line: number }> {
    const notices: Array<{ text: string; line: number }> = [];
    const lines = input.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]!;
      COPYRIGHT_PATTERN.lastIndex = 0;

      if (COPYRIGHT_PATTERN.test(line)) {
        notices.push({
          text: line.trim().substring(0, 120),
          line: lineNum + 1,
        });
      }
    }

    return notices;
  }
}
