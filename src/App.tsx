/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import AIAssistant from './components/AIAssistant';
import { signInWithGoogle, logOut, initAuth, getAccessToken } from './lib/firebase';
import { User } from 'firebase/auth';

import CalendarView from './components/CalendarView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [logId, setLogId] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setAuthLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setAuthLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logOut();
    setUser(null);
    setAccessToken(null);
  };

  const [workspaceTasks, setWorkspaceTasks] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);

  const fetchWorkspaceData = async (token: string) => {
    try {
      // Fetch Google Calendar Events
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + new Date().toISOString() + '&maxResults=10&singleEvents=true&orderBy=startTime', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const calData = await calRes.json();
      const events = (calData.items || []).map((e: any) => ({
        id: e.id,
        title: e.summary,
        description: e.description,
        startTime: e.start?.dateTime || e.start?.date,
        source: 'google_calendar'
      }));

      // Fetch Google Tasks
      const taskListsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const taskListsData = await taskListsRes.json();
      let gTasks: any[] = [];
      if (taskListsData.items && taskListsData.items.length > 0) {
        const defaultListId = taskListsData.items[0].id;
        const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultListId}/tasks?showCompleted=false&maxResults=10`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tasksData = await tasksRes.json();
        gTasks = (tasksData.items || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.notes,
          startTime: t.due ? t.due : new Date().toISOString(),
          source: 'google_tasks'
        }));
      }

      setWorkspaceTasks([...events, ...gTasks]);

      // Fetch Google Drive Files (including Docs)
      const driveRes = await fetch('https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=15&q=mimeType="application/vnd.google-apps.document" or mimeType="application/pdf"', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const driveData = await driveRes.json();
      if (driveData.items || driveData.files) {
        setDriveFiles(driveData.items || driveData.files || []);
      }
    } catch (err) {
      console.error('Error fetching Workspace data:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
      const logsRes = await fetch('/api/logs');
      const logsData = await logsRes.json();
      if (logsData.logs) {
        setLogs(logsData.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const seedData = async () => {
    await fetch('/api/seed', { method: 'POST' });
    fetchTasks();
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  useEffect(() => {
    if (accessToken) {
      fetchWorkspaceData(accessToken);
    }
  }, [accessToken]);

  const handleProposeChange = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/modify-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: "I can't wake up at 7 tomorrow, push everything 2 hours later." })
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
        setLogId(data.logId);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!logId) return;
    try {
      await fetch('/api/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId })
      });
      setPlan(null);
      setLogId(null);
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Life OS</h1>
        <p className="text-zinc-400 mb-8 text-center max-w-sm">Connect with Firebase Authentication to access your personalized dashboard and proactive AI agent.</p>
        <button onClick={handleLogin} className="gsi-material-button px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-3">
           <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            <path fill="none" d="M0 0h48v48H0z"></path>
          </svg>
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="h-16 glass flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center font-bold text-black">OS</div>
          <h1 className="text-lg font-semibold tracking-tight">Life OS <span className="text-xs font-normal opacity-40 ml-2">v2.4.0-stable</span></h1>
        </div>
        <div className="flex items-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Family:</span>
            <span className="font-medium">Oumoumen Workspace</span>
            <svg className="w-4 h-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">Daily Streak</span>
              <span className="text-orange-500 font-bold flex items-center gap-1">🔥 12 Days</span>
            </div>
            <div className="flex items-center gap-2 group relative cursor-pointer" onClick={logOut}>
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
                {user.photoURL ? <img src={user.photoURL} alt="User" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{user.displayName?.charAt(0) || 'U'}</div>}
              </div>
              <div className="absolute top-12 right-0 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Sign Out
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <nav className="w-60 glass border-t-0 border-l-0 border-b-0 flex flex-col p-4 shrink-0 overflow-y-auto">
          <div className="space-y-1 mb-8">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'calendar' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Calendar
            </button>
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tasks' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Tasks
            </button>
            <button 
              onClick={() => setActiveTab('drive')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'drive' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> Drive & Docs
            </button>
            <button 
              onClick={() => setActiveTab('wellness')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'wellness' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg> Wellness
            </button>
            <button 
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> AI Audit Log
            </button>
            <button 
              onClick={() => setActiveTab('assistant')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'assistant' ? 'bg-zinc-800/50 border border-zinc-700 text-white' : 'text-zinc-400 hover:text-white border border-transparent'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> AI Assistant
            </button>
          </div>
          <div className="mt-auto">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Level 14</span>
                <span className="text-[10px] font-bold text-emerald-500">2,450 XP</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[65%]"></div>
              </div>
            </div>
          </div>
        </nav>
        <section className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
          {activeTab === 'dashboard' ? (
            <div className="grid grid-cols-12 gap-6 h-full">
            <div className="col-span-8 flex flex-col gap-6 overflow-hidden">
              <div className="glass rounded-xl p-5 flex flex-col h-[60%] overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Today's Timeline <span className="text-xs font-normal text-zinc-500 ml-2">Tuesday, May 14</span>
                  </h2>
                  <div className="flex gap-1">
                    <button className="p-1 hover:bg-zinc-800 rounded"><svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
                    <button className="p-1 hover:bg-zinc-800 rounded"><svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-4">
                  {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 opacity-50">
                      <p className="text-sm mb-2">No tasks found</p>
                      <button onClick={seedData} className="px-3 py-1 bg-white/10 rounded text-xs hover:bg-white/20">Seed Test Data</button>
                    </div>
                  ) : tasks.map((task: any, i: number) => (
                    <div key={task.id || i} className={`flex gap-4 items-start relative ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                      <span className="text-xs text-zinc-600 w-10 text-right mt-1">{task.startTime ? new Date(task.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                      <div className={`flex-1 p-3 rounded-lg border-l-4 ${task.isMovable ? 'border-l-blue-500 bg-blue-500/10' : 'border-l-orange-500 bg-orange-500/10'} border border-zinc-800`}>
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</p>
                        <p className="text-[11px] text-zinc-500">{task.description} • {task.isMovable ? 'Movable' : 'Fixed'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-6 h-[40%]">
                <div className="glass rounded-xl p-5 flex-1 overflow-hidden">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Urgent Tasks</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800/50 group cursor-pointer border border-transparent hover:border-zinc-800">
                      <div className="w-4 h-4 rounded border border-zinc-600 group-hover:border-accent-blue"></div>
                      <span className="text-sm">Renew Home Insurance</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 rounded hover:bg-zinc-800/50 group cursor-pointer border border-transparent hover:border-zinc-800">
                      <div className="w-4 h-4 rounded border border-zinc-600 group-hover:border-accent-blue"></div>
                      <span className="text-sm">Book Summer Flight (Family)</span>
                    </div>
                  </div>
                </div>
                <div className="glass rounded-xl p-5 flex-1 overflow-hidden">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Sleep Wellness</h3>
                  <div className="flex items-end justify-between gap-1 h-20 mb-2">
                    <div className="flex-1 bg-zinc-800 rounded-t h-[70%]"></div>
                    <div className="flex-1 bg-zinc-800 rounded-t h-[85%]"></div>
                    <div className="flex-1 bg-zinc-800 rounded-t h-[60%]"></div>
                    <div className="flex-1 bg-zinc-800 rounded-t h-[90%]"></div>
                    <div className="flex-1 bg-accent-blue rounded-t h-[40%]"></div>
                    <div className="flex-1 bg-zinc-800 rounded-t h-[75%]"></div>
                    <div className="flex-1 bg-zinc-800 rounded-t h-[80%]"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">5h 42m</p>
                    <p className="text-[10px] text-red-400">-2h 18m below goal</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-4 flex flex-col gap-6">
              <div className="ai-gradient rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
                    <h2 className="font-bold text-sm tracking-tight">Proactive Agent <span className="text-[10px] text-indigo-300 font-normal opacity-70">Gemini 3 Flash</span></h2>
                  </div>
                  <button onClick={handleProposeChange} disabled={loading} className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50">
                    {loading ? "Thinking..." : "Simulate 'Push 2 Hours'"}
                  </button>
                </div>
                
                {plan ? (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-sm leading-relaxed text-indigo-50 space-y-2 mb-4">
                      {plan.actions.map((act: any, i: number) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="font-bold uppercase opacity-70">{act.type}</span>
                          <span>{act.reasoning}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={handleConfirm} className="flex-1 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors">Confirm & Execute</button>
                      <button onClick={() => {setPlan(null); setLogId(null);}} className="px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-xs font-medium text-white/60">Dismiss</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm leading-relaxed text-indigo-50 opacity-60 italic">"I'm monitoring your schedule. Click the button above to simulate a proactive rescheduling request based on the current timeline."</p>
                  </div>
                )}
                
                <div className="text-[10px] text-zinc-500 italic">
                  Agent memory sync: 4 minutes ago via pgvector (simulated)
                </div>
              </div>
              <div className="glass rounded-xl p-5 flex-1 overflow-hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Family Leaderboard</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-600 w-4">1</span>
                    <div className="w-8 h-8 rounded-full bg-zinc-800"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Sarah" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sarah (Child)</p>
                      <p className="text-[10px] text-zinc-500">14 Tasks completed</p>
                    </div>
                    <span className="text-sm font-bold">3,100 XP</span>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-800/40 p-2 rounded-lg -mx-2 border border-white/5">
                    <span className="text-sm font-bold text-zinc-600 w-4">2</span>
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-accent-blue"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Felix" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Felix (Admin)</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-semibold text-accent-blue">You</p>
                    </div>
                    <span className="text-sm font-bold">2,450 XP</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-600 w-4">3</span>
                    <div className="w-8 h-8 rounded-full bg-zinc-800"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Amine" alt="Amine" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Amine (Parent)</p>
                      <p className="text-[10px] text-zinc-500">8 Tasks completed</p>
                    </div>
                    <span className="text-sm font-bold">1,820 XP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : activeTab === 'assistant' ? (
            <div className="h-full flex-1">
              <AIAssistant />
            </div>
          ) : activeTab === 'calendar' ? (
            <div className="h-full flex-1 glass rounded-xl p-6 overflow-hidden">
              <CalendarView tasks={[...tasks, ...workspaceTasks]} />
            </div>
          ) : activeTab === 'tasks' ? (
            <div className="h-full flex-1 glass rounded-xl p-6 overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> All Tasks</h2>
              <div className="space-y-3">
                {[...tasks, ...workspaceTasks].map((task: any, i: number) => (
                  <div key={task.id || i} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-zinc-200">{task.title}</p>
                        {task.source === 'google_calendar' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Calendar</span>}
                        {task.source === 'google_tasks' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Tasks</span>}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{task.description}</p>
                    </div>
                    <div className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                      {task.startTime ? new Date(task.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'No Time'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'drive' ? (
            <div className="h-full flex-1 glass rounded-xl p-6 overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> Recent Drive & Docs Files</h2>
              {driveFiles.length === 0 ? (
                <div className="text-center text-zinc-500 py-12">No recent documents found or permissions not granted.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {driveFiles.map((file: any) => (
                    <div 
                      key={file.id} 
                      onClick={() => window.open(`https://docs.google.com/document/d/${file.id}/edit`, '_blank')}
                      className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-accent-blue transition-colors cursor-pointer flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-2">
                        {file.mimeType === 'application/vnd.google-apps.document' ? (
                          <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14.001 20H5.998A1.996 1.996 0 014 18.005V5.995C4 4.893 4.895 4 5.998 4h12.004A1.996 1.996 0 0120 5.995v9.117L14.001 20zm-1.002-4h5.002L13 21v-5zM8 8h8v2H8V8zm0 4h8v2H8v-2z"></path></svg>
                        ) : (
                          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"></path></svg>
                        )}
                        <h3 className="font-semibold text-zinc-200 text-sm truncate" title={file.name}>{file.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'wellness' ? (
            <div className="h-full flex-1 glass rounded-xl p-6 overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg> Wellness & Insights</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Sleep Quality</h3>
                  <div className="flex items-end justify-between gap-2 h-32 mb-3">
                    {[65, 80, 55, 90, 40, 75, 85].map((h, i) => (
                      <div key={i} className="flex-1 bg-zinc-800 rounded-t group relative">
                        <div className={`absolute bottom-0 w-full rounded-t transition-all ${i === 4 ? 'bg-red-500' : 'bg-accent-blue'}`} style={{height: `${h}%`}}></div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Weekly Avg: <strong className="text-white">6h 45m</strong></span>
                    <span className="text-emerald-500">+12% vs last week</span>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Focus Time</h3>
                  <div className="relative h-32 flex items-center justify-center">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#27272a" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="75, 100" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold">24h</span>
                      <span className="text-[10px] text-zinc-500 uppercase">This Week</span>
                    </div>
                  </div>
                  <div className="mt-3 text-center text-sm text-zinc-400">
                    You've hit your focus goal 5 days in a row!
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Mindfulness Logs</h3>
                <div className="space-y-3 text-sm">
                  <div className="p-3 border border-zinc-800 rounded-lg bg-zinc-800/20 text-zinc-300">
                    <span className="text-xs font-mono text-zinc-500 mr-2">Today, 8:00 AM</span>
                    Completed 10-minute morning meditation.
                  </div>
                  <div className="p-3 border border-zinc-800 rounded-lg bg-zinc-800/20 text-zinc-300">
                    <span className="text-xs font-mono text-zinc-500 mr-2">Yesterday, 9:30 PM</span>
                    Wind-down breathing exercise.
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'audit' ? (
            <div className="h-full flex-1 glass rounded-xl p-6 overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><svg className="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> AI Audit Log</h2>
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <div className="text-center text-zinc-500 py-12">No AI actions logged yet.</div>
                ) : logs.map((log: any, i: number) => (
                  <div key={log.id || i} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded uppercase">{log.actionType}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${log.status === 'executed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>{log.status}</span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.planPayload?.actions && (
                      <div className="mt-3 pl-3 border-l-2 border-zinc-800 space-y-2">
                        {log.planPayload.actions.map((act: any, j: number) => (
                          <div key={j} className="text-sm">
                            <span className="text-zinc-400 font-mono text-xs mr-2">[{act.type}]</span>
                            <span className="text-zinc-200">{act.reasoning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl glass h-full">
              <svg className="w-12 h-12 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              <h2 className="text-xl font-bold mb-2 capitalize">{activeTab}</h2>
              <p className="text-sm text-zinc-500">This module is currently under construction for Phase 3.</p>
            </div>
          )}
        </section>
      </main>
      <footer className="h-10 glass border-t border-zinc-800 flex items-center justify-between px-6 shrink-0 text-[10px] uppercase tracking-widest text-zinc-500">
        <div>Status: <span className="text-emerald-500">System Healthy</span></div>
        <div className="flex gap-4">
          <span>Last Backup: 12:44 UTC</span>
          <span>Region: eu-west-1</span>
          <span>Lang: English (US)</span>
        </div>
      </footer>
    </div>
  );
}
