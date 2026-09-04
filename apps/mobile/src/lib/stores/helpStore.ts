/**
 * apps/mobile/src/lib/stores/helpStore.ts
 *
 * Global lightweight reactive store for the Help System modal & Wiki loader.
 */

import { useSyncExternalStore } from 'react';
import { api } from '@mobile/lib/api';
import { HELP_TOPICS, mapRouteToTopic } from '@mobile/lib/helpTopics';
import { getBundledWiki } from '@mobile/lib/bundledWiki';

export interface HelpState {
  isOpen: boolean;
  activeTopic: string;
  viewingGuide: boolean;
  guideContent: string;
  loadingGuide: boolean;
}

let state: HelpState = {
  isOpen: false,
  activeTopic: 'overview',
  viewingGuide: false,
  guideContent: '',
  loadingGuide: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const helpStore = {
  getSnapshot(): HelpState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  openHelp(screenTopicOrRoute?: string) {
    let topicId = 'overview';
    if (screenTopicOrRoute) {
      if (HELP_TOPICS.some((t) => t.id === screenTopicOrRoute)) {
        topicId = screenTopicOrRoute;
      } else {
        topicId = mapRouteToTopic(screenTopicOrRoute);
      }
    }
    state = {
      ...state,
      isOpen: true,
      activeTopic: topicId,
      viewingGuide: false,
      guideContent: '',
      loadingGuide: false,
    };
    emit();
  },

  closeHelp() {
    state = {
      ...state,
      isOpen: false,
      viewingGuide: false,
      guideContent: '',
      loadingGuide: false,
    };
    emit();
  },

  setTopic(topicId: string) {
    state = {
      ...state,
      activeTopic: topicId,
      viewingGuide: false,
      guideContent: '',
      loadingGuide: false,
    };
    emit();
  },

  setViewingGuide(viewing: boolean) {
    state = {
      ...state,
      viewingGuide: viewing,
    };
    emit();
  },

  async loadGuide(topicId: string, language: string = 'en') {
    const topic = HELP_TOPICS.find((t) => t.id === topicId);
    if (!topic) return;

    state = {
      ...state,
      loadingGuide: true,
      guideContent: '',
    };
    emit();

    try {
      // 1. Fast local bundled wiki guide
      const bundled = getBundledWiki(language, topic.wiki);
      if (bundled) {
        state = {
          ...state,
          loadingGuide: false,
          guideContent: bundled,
          viewingGuide: true,
        };
        emit();
        return;
      }

      // 2. Try fetching from backend /api/v1/wiki/{lang}/{wiki}
      const wikiDoc = await api.getWiki(language, topic.wiki).catch(() => null);
      if (wikiDoc) {
        state = {
          ...state,
          loadingGuide: false,
          guideContent: wikiDoc,
          viewingGuide: true,
        };
        emit();
        return;
      }

      // 3. Fallback to English bundled wiki
      const fallbackBundled = getBundledWiki('en', topic.wiki);
      if (fallbackBundled) {
        state = {
          ...state,
          loadingGuide: false,
          guideContent: fallbackBundled,
          viewingGuide: true,
        };
        emit();
        return;
      }

      // 4. Default fallback text
      state = {
        ...state,
        loadingGuide: false,
        guideContent: `# ${topic.defaultLabel}\n\nPlease visit the DressApp Wiki for full documentation on this feature.`,
        viewingGuide: true,
      };
      emit();
    } catch (err) {
      console.warn('Failed to load wiki guide:', err);
      const fallbackBundled = getBundledWiki('en', topic?.wiki || topicId);
      state = {
        ...state,
        loadingGuide: false,
        guideContent: fallbackBundled || `# ${topic.defaultLabel}\n\nCould not load detailed guide at this moment.`,
        viewingGuide: true,
      };
      emit();
    }
  },
};

export function useHelpStore(): HelpState & {
  openHelp: (screenTopicOrRoute?: string) => void;
  closeHelp: () => void;
  setTopic: (topicId: string) => void;
  setViewingGuide: (viewing: boolean) => void;
  loadGuide: (topicId: string, language?: string) => Promise<void>;
} {
  const current = useSyncExternalStore(helpStore.subscribe, helpStore.getSnapshot);
  return {
    ...current,
    openHelp: helpStore.openHelp,
    closeHelp: helpStore.closeHelp,
    setTopic: helpStore.setTopic,
    setViewingGuide: helpStore.setViewingGuide,
    loadGuide: helpStore.loadGuide,
  };
}
