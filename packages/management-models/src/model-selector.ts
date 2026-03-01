import type { ManagementModelType } from '@agentcoders/shared';
import type { ManagementModel } from './model-interface.js';
import { createSpotifyModel } from './spotify/index.js';
import { createSafeModel } from './safe/index.js';
import { createTeamTopologiesModel } from './team-topologies/index.js';

export class ModelSelector {
  select(type: ManagementModelType, config: Record<string, unknown> = {}): ManagementModel {
    switch (type) {
      case 'spotify':
        return createSpotifyModel(config);
      case 'safe':
        return createSafeModel(config);
      case 'team-topologies':
        return createTeamTopologiesModel(config);
      case 'scrum-at-scale':
        return createSafeModel(config); // SAFe-compatible for now
    }
  }

  getAvailableModels(): Array<{ type: ManagementModelType; description: string }> {
    return [
      { type: 'spotify', description: 'Squads, Tribes, Chapters, Guilds — autonomous cross-functional teams' },
      { type: 'safe', description: 'Agile Release Trains, PI Planning — scaled enterprise agile' },
      { type: 'team-topologies', description: 'Stream-aligned, Platform, Enabling, Complicated-subsystem teams' },
      { type: 'scrum-at-scale', description: 'Scaled Scrum with meta-scrums and executive action teams' },
    ];
  }
}
