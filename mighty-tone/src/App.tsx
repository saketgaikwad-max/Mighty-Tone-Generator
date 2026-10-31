import { Page, Tabbar, TabbarLink } from 'konsta/react';
import { BookOpen, MessageSquare, User } from 'lucide-react';
import { useState } from 'react';

import { Library } from './screens/Library.js';
import { Profile } from './screens/Profile.js';
import { SessionChat } from './screens/SessionChat.js';

type Tab = 'sessions' | 'library' | 'profile';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');

  return (
    <Page className="flex flex-col h-full">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'sessions' && <SessionChat />}
        {activeTab === 'library' && <Library />}
        {activeTab === 'profile' && <Profile />}
      </div>

      {/* Bottom tab bar */}
      <Tabbar labels>
        <TabbarLink
          active={activeTab === 'sessions'}
          onClick={() => setActiveTab('sessions')}
          label="Sessions"
          icon={<MessageSquare size={22} />}
        />
        <TabbarLink
          active={activeTab === 'library'}
          onClick={() => setActiveTab('library')}
          label="Library"
          icon={<BookOpen size={22} />}
        />
        <TabbarLink
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          label="Profile"
          icon={<User size={22} />}
        />
      </Tabbar>
    </Page>
  );
}
