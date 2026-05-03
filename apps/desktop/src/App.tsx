/// <reference path="./electron.d.ts" />
import { useState, useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { IdentityManager, WorkspaceService, PlanningApiClient, ScheduleApiClient } from '@tuxnotas/shared';
import { YjsIndexedDBAdapter } from './infrastructure/persistence/IndexedDBAdapter';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (SUPABASE_URL && SUPABASE_KEY) {
  IdentityManager.initializeCloud(SUPABASE_URL, SUPABASE_KEY);
}

// Planning backend feature flag — default false preserves local/Yjs behavior
const PLANNING_BACKEND_ENABLED =
  import.meta.env.VITE_PLANNING_BACKEND_ENABLED === 'true';
const PLANNING_SERVICE_URL =
  (import.meta.env.VITE_PLANNING_SERVICE_URL as string | undefined) ||
  'http://localhost:8003';
const WORKSPACE_SERVICE_URL =
  (import.meta.env.VITE_WORKSPACE_SERVICE_URL as string | undefined) ||
  'http://localhost:8001';

// Schedule backend feature flag — default false preserves localStorage behavior
const SCHEDULE_BACKEND_ENABLED =
  import.meta.env.VITE_SCHEDULE_BACKEND_ENABLED === 'true';
const SCHEDULE_SERVICE_URL =
  (import.meta.env.VITE_SCHEDULE_SERVICE_URL as string | undefined) ||
  'http://localhost:8006';

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

  // ── Planning backend state ─────────────────────────────────────
  const [planningWorkspaceId, setPlanningWorkspaceId] = useState<string | null>(null);
  // Tracks whether Supabase auth session is available (independent of userProfile)
  const [cloudSessionAvailable, setCloudSessionAvailable] = useState(false);

  // Guard against overlapping bootstrap calls
  const bootstrapInFlight = useRef(false);

  // Stable token accessor for clients (always reads latest session)
  const getAccessToken = async (): Promise<string | null> => {
    const sb = IdentityManager.cloudClient;
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // Workspace service instance — stable across renders
  const workspaceSvc = useMemo(
    () =>
      new WorkspaceService({
        workspaceBaseUrl: WORKSPACE_SERVICE_URL,
        getAccessToken,
      }),
    [WORKSPACE_SERVICE_URL],
  );

  // Planning API client instance — stable across renders
  const planningClient = useMemo(
    () =>
      new PlanningApiClient({
        baseUrl: PLANNING_SERVICE_URL,
        getAccessToken,
      }),
    [PLANNING_SERVICE_URL],
  );

  // Schedule API client instance — stable across renders
  const scheduleClient = useMemo(
    () =>
      new ScheduleApiClient({
        baseUrl: SCHEDULE_SERVICE_URL,
        getAccessToken,
      }),
    [SCHEDULE_SERVICE_URL],
  );

  // Bootstrap: ensureActiveWorkspace when feature flag is on AND Supabase session is available
  // Depends on cloudSessionAvailable so it re-runs when session becomes available after login
  useEffect(() => {
    if (!PLANNING_BACKEND_ENABLED) return;
    if (!userProfile) return;
    if (!cloudSessionAvailable) return;
    if (bootstrapInFlight.current) return;

    bootstrapInFlight.current = true;

    let cancelled = false;

    (async () => {
      const sb = IdentityManager.cloudClient;
      if (!sb) {
        console.warn('[Planning] Supabase not configured — cloud planning disabled');
        return;
      }

      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        // Session disappeared between cloudSessionAvailable=true and now
        return;
      }

      try {
        const wid = await workspaceSvc.ensureActiveWorkspace();
        if (!cancelled) setPlanningWorkspaceId(wid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isAuthError =
          msg.includes('401') ||
          msg.includes('Unauthorized') ||
          msg.includes('No access token');
        if (!isAuthError) {
          console.error('[Planning] Failed to initialize workspace:', msg);
        }
      } finally {
        if (!cancelled) bootstrapInFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [PLANNING_BACKEND_ENABLED, userProfile, cloudSessionAvailable, workspaceSvc]);

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

    // Initialize cloudSessionAvailable from current session
    sb.auth.getSession().then(({ data: { session } }) => {
      setCloudSessionAvailable(!!session?.access_token);
      if (session && !getUserProfile()) {
        fetchAndSaveProfile(session.user.id, session.user);
      }
    });

    // Subscribe to auth changes to keep cloudSessionAvailable in sync
    // and to clear planningWorkspaceId on sign-out
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setCloudSessionAvailable(!!session?.access_token);

      if (!!session?.access_token && !userProfile) {
        // New login
        fetchAndSaveProfile(session!.user.id, session!.user);
      }

      if (event === 'SIGNED_OUT') {
        // Clear planning state on logout
        setPlanningWorkspaceId(null);
        bootstrapInFlight.current = false;
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
    setPlanningWorkspaceId(null);
    bootstrapInFlight.current = false;
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
    return (
      <ScheduleScreen
        user={userProfile}
        onBack={handleBack}
        onNavigate={handleNavigate}
        scheduleEnabled={SCHEDULE_BACKEND_ENABLED && cloudSessionAvailable && !!planningWorkspaceId}
        scheduleClient={scheduleClient}
        workspaceId={planningWorkspaceId}
      />
    );
  }

  if (screen.type === 'tasks') {
    return (
      <TasksScreen
        user={userProfile}
        yjsDoc={personalDocRef.current}
        onBack={handleBack}
        onNavigate={handleNavigate}
        planningEnabled={PLANNING_BACKEND_ENABLED}
        planningWorkspaceId={planningWorkspaceId}
        planningClient={planningClient}
      />
    );
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
      workspaceService={workspaceSvc}
      cloudWorkspaceId={planningWorkspaceId}
    />
  );
}

export default App;
