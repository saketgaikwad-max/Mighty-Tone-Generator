import { Tabbar, TabbarLink } from 'konsta/react';
import { BookOpen, Layers, MessageSquare, User } from 'lucide-react';
import { useState } from 'react';

import { IRInventory } from './screens/IRInventory.js';
import { IRPrep } from './screens/IRPrep.js';
import { Library } from './screens/Library.js';
import { Profile } from './screens/Profile.js';
import { SessionChat } from './screens/SessionChat.js';

type Tab = 'sessions' | 'library' | 'profile' | 'irlab';
type IRView = 'inventory' | 'prep';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [irView, setIrView] = useState<IRView>('inventory');

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'irlab') setIrView('inventory');
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'sessions' && <SessionChat onGoToIrLab={() => handleTabChange('irlab')} />}
        {activeTab === 'library' && <Library />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'irlab' && irView === 'inventory' && (
          <IRInventory onPrepNew={() => setIrView('prep')} />
        )}
        {activeTab === 'irlab' && irView === 'prep' && (
          <IRPrep onDone={() => setIrView('inventory')} />
        )}
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
          label="Library"
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
      </Tabbar>
    </div>
  );
}
