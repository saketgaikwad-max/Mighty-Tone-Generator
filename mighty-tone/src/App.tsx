import { Tabbar, TabbarLink } from 'konsta/react';
import { BookOpen, HelpCircle, Layers, MessageSquare, User } from 'lucide-react';
import { useState } from 'react';

import { Help } from './screens/Help.js';
import { IRInventory } from './screens/IRInventory.js';
import { IRPrep } from './screens/IRPrep.js';
import { Library } from './screens/Library.js';
import { Profile } from './screens/Profile.js';
import { SessionChat } from './screens/SessionChat.js';
import { SessionsList } from './screens/SessionsList.js';

type Tab = 'sessions' | 'library' | 'profile' | 'irlab' | 'guide';
type IRView = 'inventory' | 'prep';
type SessionsView = 'list' | 'chat';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [irView, setIrView] = useState<IRView>('inventory');
  const [sessionsView, setSessionsView] = useState<SessionsView>('list');
  const [activeChatSessionId, setActiveChatSessionId] = useState<number | undefined>(undefined);
  const [activeChatInstrumentId, setActiveChatInstrumentId] = useState<string | undefined>(undefined);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'irlab') setIrView('inventory');
    if (tab === 'sessions') setSessionsView('list');
  }

  function handleSelectSession(sessionId: number) {
    setActiveChatSessionId(sessionId);
    setActiveChatInstrumentId(undefined);
    setSessionsView('chat');
  }

  function handleNewSession(sessionId: number, instrumentId: string) {
    setActiveChatSessionId(sessionId);
    setActiveChatInstrumentId(instrumentId);
    setSessionsView('chat');
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0D14]">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'sessions' && sessionsView === 'list' && (
          <SessionsList onSelectSession={handleSelectSession} onNewSession={handleNewSession} />
        )}
        {activeTab === 'sessions' && sessionsView === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Back button */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-4 pt-3 pb-2 bg-[#0B0D14]/90 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setSessionsView('list')}
                className="flex items-center gap-1 text-[#7C6CFF] text-[15px] font-medium"
                style={{ minHeight: 44 }}
              >
                ‹ Sessions
              </button>
            </div>
            <div className="flex-1 overflow-hidden pt-12">
              <SessionChat
                sessionId={activeChatSessionId}
                instrumentId={activeChatInstrumentId}
                onGoToIrLab={() => handleTabChange('irlab')}
              />
            </div>
          </div>
        )}
        {activeTab === 'library' && <Library />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'irlab' && irView === 'inventory' && (
          <IRInventory onPrepNew={() => setIrView('prep')} />
        )}
        {activeTab === 'irlab' && irView === 'prep' && (
          <IRPrep onDone={() => setIrView('inventory')} />
        )}
        {activeTab === 'guide' && <Help />}
      </div>

      {/* Bottom tab bar */}
      <Tabbar labels>
        <TabbarLink
          active={activeTab === 'sessions'}
          onClick={() => handleTabChange('sessions')}
          label="Sessions"
          icon={<MessageSquare size={22} />}
        />
        <TabbarLink
          active={activeTab === 'library'}
          onClick={() => handleTabChange('library')}
          label="Saved Tones"
          icon={<BookOpen size={22} />}
        />
        <TabbarLink
          active={activeTab === 'profile'}
          onClick={() => handleTabChange('profile')}
          label="Profile"
          icon={<User size={22} />}
        />
        <TabbarLink
          active={activeTab === 'irlab'}
          onClick={() => handleTabChange('irlab')}
          label="IR Lab"
          icon={<Layers size={22} />}
        />
        <TabbarLink
          active={activeTab === 'guide'}
          onClick={() => handleTabChange('guide')}
          label="Guide"
          icon={<HelpCircle size={22} />}
        />
      </Tabbar>
    </div>
  );
}
