/// <reference path="./electron.d.ts" />
import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { IdentityManager } from '@tuxnotas/shared';
import { YjsIndexedDBAdapter } from './infrastructure/persistence/IndexedDBAdapter';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (SUPABASE_URL && SUPABASE_KEY) {
  IdentityManager.initializeCloud(SUPABASE_URL, SUPABASE_KEY);
}

import { addPool, getUserProfile, saveUserProfile, type UserProfile } from './core/domain/UserProfile';
import { ProfileSetup }  from './ui/screens/ProfileSetup';
import { HomeDashboard } from './ui/screens/HomeDashboard';
import { PoolWorkspace } from './ui/screens/PoolWorkspace';
import { CalendarScreen } from './ui/screens/CalendarScreen';
import { ScheduleScreen } from './ui/screens/ScheduleScreen';
import { TasksScreen }   from './ui/screens/TasksScreen';

// ════════════════════════════════════════════════════
// MAIN APP — Screen Router
// ════════════════════════════════════════════════════

type Screen =
  | { type: 'profile' }
  | { type: 'dashboard' }
  | { type: 'workspace'; poolId: string; poolName: string; signalingUrl?: string }
  | { type: 'calendar' }
  | { type: 'notes' }
  | { type: 'tasks' }
  | { type: 'schedule' }
  | { type: 'boards' }
  | { type: 'trash' };

function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(getUserProfile());
  const [screen, setScreen] = useState<Screen>(() => {
    return getUserProfile() ? { type: 'dashboard' } : { type: 'profile' };
  });

  // In-memory Y.Doc for the personal task list (no y-indexeddb yet — sufficient for testing)
  const personalDocRef = useRef<Y.Doc | null>(null);
  if (!personalDocRef.current) {
    personalDocRef.current = new Y.Doc();
  }

  useEffect(() => {
    if (!personalDocRef.current) return;
    const adapter = new YjsIndexedDBAdapter(personalDocRef.current);
    adapter.initialize('briefly-personal-doc').then(() => {
      console.log('Personal doc persistence initialized');
    });
  }, []);

  const fetchAndSaveProfile = async (uid: string, authUser: any) => {
    const sb = IdentityManager.cloudClient;
    if (!sb) return;
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', uid).single();
      const color = data?.color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      const finalName = data?.username || data?.full_name || authUser?.email?.split('@')[0] || 'Cloud User';

      const profile: UserProfile = {
        id: uid,
        name: finalName,
        color,
        createdAt: Date.now(),
        identityType: 'cloud'
      };

      saveUserProfile(profile);
      setUserProfile(profile);

      const { data: poolsData } = await sb.from('user_pools').select('*').eq('user_id', uid);
      if (poolsData && poolsData.length > 0) {
        poolsData.forEach(p => {
          addPool({
            id: p.pool_id,
            name: p.pool_name,
            icon: 'collab',
            lastOpened: Date.now(),
            createdAt: Date.now(),
            signalingUrl: undefined
          });
        });
      }

      setScreen({ type: 'dashboard' });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    const sb = IdentityManager.cloudClient;
    if (!sb) return;

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session && !getUserProfile()) {
        fetchAndSaveProfile(session.user.id, session.user);
      }
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session && !userProfile) {
        fetchAndSaveProfile(session.user.id, session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [userProfile]);

  const handleProfileComplete = (profile: UserProfile) => {
    setUserProfile(profile);
    setScreen({ type: 'dashboard' });
  };

  const handleOpenPool = (poolId: string, poolName: string, signalingUrl?: string) => {
    setScreen({ type: 'workspace', poolId, poolName, signalingUrl });
  };

  const handleNavigate = (screenType: string) => {
    setScreen({ type: screenType as any });
  };

  const handleBack = () => {
    setScreen({ type: 'dashboard' });
  };

  const handleLogout = () => {
    setScreen({ type: 'profile' });
  };

  if (screen.type === 'profile' || !userProfile) {
    return <ProfileSetup onComplete={handleProfileComplete} />;
  }

  if (screen.type === 'dashboard') {
    return (
      <HomeDashboard
        user={userProfile}
        yjsDoc={personalDocRef.current!}
        onOpenPool={handleOpenPool}
        onLogout={handleLogout}
        onOpenCalendar={() => setScreen({ type: 'calendar' })}
        onNavigate={handleNavigate}
      />
    );
  }

  if (screen.type === 'calendar') {
    return <CalendarScreen user={userProfile} onBack={handleBack} onNavigate={handleNavigate} />;
  }

  if (screen.type === 'schedule') {
    return <ScheduleScreen user={userProfile} onBack={handleBack} onNavigate={handleNavigate} />;
  }

  if (screen.type === 'tasks') {
    return <TasksScreen user={userProfile} yjsDoc={personalDocRef.current} onBack={handleBack} onNavigate={handleNavigate} />;
  }

  // workspace — fallback (also catches notes/boards/trash while they are placeholders)
  return (
    <PoolWorkspace
      key={screen.type === 'workspace' ? screen.poolId : 'none'}
      poolId={screen.type === 'workspace' ? screen.poolId : ''}
      poolName={screen.type === 'workspace' ? screen.poolName : ''}
      user={userProfile}
      onBack={handleBack}
      signalingUrl={screen.type === 'workspace' ? screen.signalingUrl : undefined}
    />
  );
}

export default App;
