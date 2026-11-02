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

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'sessions', label: 'Sessions', Icon: MessageSquare },
  { id: 'library', label: 'Saved Tones', Icon: BookOpen },
  { id: 'irlab', label: 'IR Lab', Icon: Layers },
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'guide', label: 'Guide', Icon: HelpCircle },
];

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
    /* Outer wrapper — centres content on desktop, dark bg on sides */
    <div className="min-h-screen bg-[#05060a] flex justify-center">
      {/* Inner app shell — phone width on desktop, full width on mobile */}
      <div className="w-full max-w-[430px] h-screen h-[100dvh] flex flex-col bg-[#0B0D14] relative overflow-hidden">
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

        {/* Custom tab bar */}
        <div
          className="tab-bar-safe flex-shrink-0"
          style={{
            background: 'rgba(20,24,38,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex h-[64px] md:h-[52px]">
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTabChange(id)}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                  style={{ minHeight: 44 }}
                  aria-label={label}
                >
                  {/* Active indicator bar at top */}
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{ width: 24, height: 2, background: '#7C6CFF' }}
                    />
                  )}
                  <Icon size={22} color={active ? '#7C6CFF' : '#62677E'} />
                  <span
                    className="text-[10px] md:text-[11px] font-medium leading-none"
                    style={{ color: active ? '#7C6CFF' : '#62677E' }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
