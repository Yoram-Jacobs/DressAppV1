import { api } from '@/lib/api';

const FRESH_MS = 5 * 60 * 1000; // 5 minutes

export const KNOWN_WELCOME_MESSAGES = new Set([
  'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.',
  'שלום! אני עוזר המזוודה שלך. לאן נוסעים ומה התוכנית? תוכל להשתמש בשדות למעלה או פשוט לדבר איתי.',
  'مرحباً! أنا مساعد حقيبة السفر الخاص بك. إلى أين نسافر وما هي الخطة؟ يمكنك استخدام المدخلات أعلاه أو التحدث معي مباشرة.',
  '¡Hola! Soy su Asistente de Maleta. ¿A dónde viajamos y cuál es el plan? Puede usar las entradas de arriba o simplemente chatear conmigo.',
  'Bonjour ! Je suis votre assistant valise. Où voyageons-nous et quel est le programme ? Vous pouvez utiliser les champs ci-dessus ou simplement discuter avec moi.',
  'Hallo! Ich bin Ihr Koffer-Assistent. Wohin reisen wir und was ist der Plan? Sie können die Eingabefelder oben nutzen oder einfach mit mir chatten.',
  'Ciao! Sono il tuo Assistente Valigia. Dove stiamo viaggiando e qual è il piano? Puoi usare i campi sopra o semplicemente chattare con me.',
  'Olá! Sou o seu Assistente de Mala. Para onde vamos viajar e qual é o plano? Pode utilizar as entradas acima ou simplesmente falar comigo.',
  'Привет! Я ваш помощник по сборам. Куда мы едем и какие планы? Вы можете использовать поля ввода выше или просто пообщаться со мной.',
  '您好！我是您的行李箱助手。我们去哪里旅行，计划是什么？您可以使用上方的输入框或直接与我聊天。',
  'こんにちは！私はあなたのスーツケースアシスタントです。旅行先はどこで、どのような予定ですか？上の入力欄を使用するか、直接私とチャットしてください。',
  'नमस्ते! मैं आपका सूटकेस सहायक हूँ। हम कहाँ यात्रा कर रहे हैं, और क्या योजना है? आप ऊपर दिए गए इनपुट का उपयोग कर सकते हैं या बस मेरे साथ चैट कर सकते हैं।',
  'Hallo! Ik ben jouw Kofferassistent. Waar gaan we heen en wat is het plan? U kunt de bovenstaande gegevens gebruiken of gewoon met mij chatten.',
]);

export const defaultWelcomeMessage = (t) => [
  {
    role: 'assistant',
    isWelcome: true,
    text: t ? t('suitcase.welcomeChat', { defaultValue: 'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.' }) : 'Hello! I am your Suitcase Assistant. Where are we traveling, and what is the plan? You can use the inputs above or simply chat with me.'
  }
];

const LOCAL_STORAGE_KEY = 'dressapp_suitcase_store_state';

const _defaultState = {
  activeSuitcase: null,
  viewState: 'gathering', // 'gathering' | 'reviewing' | 'active'
  packingData: null,
  messages: [],
  archives: [],
  loading: false,
  archiveLoading: false,
  error: null,
  lastFullSync: 0,
};

function loadState() {
  if (typeof window === 'undefined') return { ..._defaultState };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.messages && parsed.messages.length === 1) {
        const m = parsed.messages[0];
        if (m.role === 'assistant' && (m.isWelcome || KNOWN_WELCOME_MESSAGES.has((m.text || '').trim()))) {
          m.isWelcome = true;
        }
      }
      return {
        ..._defaultState,
        ...parsed,
        loading: false,
        archiveLoading: false,
        error: null,
      };
    }
  } catch (e) {
    console.error('Failed to load suitcase state from localStorage', e);
  }
  return { ..._defaultState };
}

function saveState(state) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      activeSuitcase: state.activeSuitcase,
      viewState: state.viewState,
      packingData: state.packingData,
      messages: state.messages,
      archives: state.archives,
      lastFullSync: state.lastFullSync,
    }));
  } catch (e) {
    console.error('Failed to save suitcase state to localStorage', e);
  }
}

let _state = loadState();

const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  saveState(_state);
  _notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_STORAGE_KEY) {
      try {
        if (event.newValue === null) {
          _state = { ..._defaultState };
        } else {
          const parsed = JSON.parse(event.newValue);
          _state = {
            ..._state,
            ...parsed,
            loading: _state.loading,
            archiveLoading: _state.archiveLoading,
            error: _state.error,
          };
        }
        _notify();
      } catch (e) {
        // ignore
      }
    }
  });
}

export const suitcaseStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false, t = null } = {}) {
    if (!force && _state.loading) return _state;
    if (!force && _state.lastFullSync && Date.now() - _state.lastFullSync < FRESH_MS) {
      return _state;
    }
    
    // Initialize messages with translated welcome if empty or if only a welcome message exists
    let initialMessages = _state.messages;
    if (!initialMessages || initialMessages.length === 0) {
      initialMessages = defaultWelcomeMessage(t);
    } else if (
      initialMessages.length === 1 &&
      initialMessages[0].role === 'assistant' &&
      (initialMessages[0].isWelcome || KNOWN_WELCOME_MESSAGES.has((initialMessages[0].text || '').trim()))
    ) {
      initialMessages = defaultWelcomeMessage(t);
    }
    _set({ messages: initialMessages, loading: true, archiveLoading: true, error: null });
    try {
      const [activeRes, archiveRes] = await Promise.all([
        api.getSuitcaseActive(),
        api.getSuitcaseArchive()
      ]);

      const activeSuitcase = activeRes.active ? activeRes.suitcase : null;
      const viewState = activeRes.active ? (activeRes.suitcase.status || 'active') : 'gathering';
      const archives = archiveRes || [];
      const rawMessages = activeSuitcase && activeSuitcase.messages && activeSuitcase.messages.length > 0
        ? activeSuitcase.messages
        : defaultWelcomeMessage(t);
      const messages = (rawMessages.length === 1 && rawMessages[0].role === 'assistant' && (rawMessages[0].isWelcome || KNOWN_WELCOME_MESSAGES.has((rawMessages[0].text || '').trim())))
        ? defaultWelcomeMessage(t)
        : rawMessages;

      let packingData = null;
      if (activeSuitcase) {
        packingData = {
          packing_list: activeSuitcase.packing_list || [],
          outfits: activeSuitcase.outfits || [],
          danger_zones_info: activeSuitcase.missing_notes || '',
          cultural_guidelines: activeSuitcase.missing_notes || '',
          local_fashion_stores: activeSuitcase.local_fashion_stores || [],
          missing_items: activeSuitcase.missing_items || []
        };
      }

      _set({
        activeSuitcase,
        viewState,
        archives,
        messages,
        packingData,
        lastFullSync: Date.now()
      });
    } catch (err) {
      console.error('Failed to prewarm suitcaseStore', err);
      _set({ error: err });
    } finally {
      _set({ loading: false, archiveLoading: false });
    }
    return _state;
  },

  updateViewState(viewState) {
    const val = typeof viewState === 'function' ? viewState(_state.viewState) : viewState;
    _set({ viewState: val });
  },

  updateActiveSuitcase(activeSuitcase) {
    const val = typeof activeSuitcase === 'function' ? activeSuitcase(_state.activeSuitcase) : activeSuitcase;
    let packingData = _state.packingData;
    if (val) {
      packingData = {
        packing_list: val.packing_list || [],
        outfits: val.outfits || [],
        danger_zones_info: val.missing_notes || '',
        cultural_guidelines: val.missing_notes || '',
        local_fashion_stores: val.local_fashion_stores || [],
        missing_items: val.missing_items || []
      };
    }
    _set({ activeSuitcase: val, packingData });
  },

  updatePackingData(packingData) {
    const val = typeof packingData === 'function' ? packingData(_state.packingData) : packingData;
    _set({ packingData: val });
  },

  updateMessages(messages) {
    const val = typeof messages === 'function' ? messages(_state.messages) : messages;
    _set({ messages: val });
  },

  updateArchives(archives) {
    const val = typeof archives === 'function' ? archives(_state.archives) : archives;
    _set({ archives: val });
  },

  setArchiveLoading(archiveLoading) {
    const val = typeof archiveLoading === 'function' ? archiveLoading(_state.archiveLoading) : archiveLoading;
    _set({ archiveLoading: val });
  },

  reset(t = null) {
    _set({
      activeSuitcase: null,
      viewState: 'gathering',
      packingData: null,
      messages: defaultWelcomeMessage(t),
      archives: [],
      loading: false,
      archiveLoading: false,
      error: null,
      lastFullSync: 0
    });
  }
};

export async function prewarmSuitcase(opts) {
  try {
    await suitcaseStore.prewarm(opts);
  } catch { /* best-effort */ }
}

export function resetSuitcase() {
  suitcaseStore.reset();
}
