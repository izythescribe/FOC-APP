import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Calendar, Trophy, Home, CheckSquare, LogOut, MessageCircle, CheckCircle2, BookOpen, ChevronRight } from 'lucide-react';

// --- Types ---
type View = 'loading' | 'auth' | 'dashboard' | 'checkin' | 'booking';

interface UserData {
  name: string;
  whatsapp: string;
  points: number;
  streak: number;
  lastCheckIn: string | null;
  checkInsThisMonth: string[];
  lastMonth: string;
}

// --- Constants & Data ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getCurrentMonthStr = () => getTodayStr().substring(0, 7);

const INITIAL_USER: UserData = {
  name: '',
  whatsapp: '',
  points: 0,
  streak: 0,
  lastCheckIn: null,
  checkInsThisMonth: [],
  lastMonth: getCurrentMonthStr()
};

const SCRIPTURES = [
  "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up. - Galatians 6:9",
  "Commit to the Lord whatever you do, and he will establish your plans. - Proverbs 16:3",
  "I can do all this through him who gives me strength. - Philippians 4:13",
  "But those who hope in the Lord will renew their strength. - Isaiah 40:31",
  "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go. - Joshua 1:9"
];

const TASKS = [
  { id: 'poll', name: 'Daily Poll', points: 5 },
  { id: 'voice', name: 'Voice Note Reflection', points: 5 },
  { id: 'scripture', name: 'Scripture Hunt', points: 10 },
  { id: 'evangelism', name: 'Evangelism/Impact', points: 20 },
];

const MOCK_LEADERBOARD = [
  { name: 'Elijah', streak: 28 },
  { name: 'Sarah', streak: 25 },
  { name: 'David', streak: 21 },
  { name: 'Ruth', streak: 15 },
  { name: 'Paul', streak: 12 },
];

// --- Main Application ---
export default function App() {
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<UserData>(INITIAL_USER);
  const [scripture, setScripture] = useState(SCRIPTURES[0]);
  const [showCongrats, setShowCongrats] = useState(false);

  const todayDate = new Date();
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const currentDay = todayDate.getDate();

  // Load Data on Mount
  useEffect(() => {
    const loadData = () => {
      const storedUser = localStorage.getItem('foc_user_v2');
      if (storedUser) {
        let parsedUser: UserData = JSON.parse(storedUser);
        
        // Monthly Reset Logic
        if (parsedUser.lastMonth !== getCurrentMonthStr()) {
          parsedUser = {
            ...parsedUser,
            streak: 0,
            checkInsThisMonth: [],
            lastMonth: getCurrentMonthStr()
          };
        }
        setUser(parsedUser);
        setView('dashboard');
      } else {
        setView('auth');
      }

      // Set Daily Scripture
      const dayOfYear = Math.floor((todayDate.getTime() - new Date(todayDate.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
      setScripture(SCRIPTURES[dayOfYear % SCRIPTURES.length]);
    };

    setTimeout(loadData, 1500);
  }, []);

  // Save User Data on Change
  useEffect(() => {
    if (user.name) {
      localStorage.setItem('foc_user_v2', JSON.stringify(user));
    }
  }, [user]);

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const whatsapp = formData.get('whatsapp') as string;
    if (name.trim() && whatsapp.trim()) {
      setUser({ ...INITIAL_USER, name: name.trim(), whatsapp: whatsapp.trim() });
      setView('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('foc_user_v2');
    setUser(INITIAL_USER);
    setView('auth');
  };

  const handleCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let pointsEarned = 0;
    TASKS.forEach(task => { if (formData.get(task.id)) pointsEarned += task.points; });

    if (pointsEarned === 0) return;

    const todayStr = getTodayStr();
    
    if (user.lastCheckIn !== todayStr) {
      const newCheckIns = [...new Set([...user.checkInsThisMonth, todayStr])];
      const newStreak = user.streak + 1;
      
      setUser(prev => ({
        ...prev,
        points: prev.points + pointsEarned,
        streak: newStreak,
        lastCheckIn: todayStr,
        checkInsThisMonth: newCheckIns
      }));

      // Check for full month consistency
      if (newCheckIns.length === daysInMonth) {
        setShowCongrats(true);
      }
    }

    setView('dashboard');
  };

  const handleBookSession = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const topic = formData.get('topic') as string;
    
    const message = `Hello, I am ${user.name} (${user.whatsapp}). I would like to book a 1-on-1 session on ${date} to discuss: ${topic}. Please let me know if this is approved.`;
    const whatsappUrl = `https://wa.me/2349136270533?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- Render Helpers ---
  const renderLoading = () => (
    <motion.div key="loading" exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a]">
      <Flame size={64} className="text-orange-500 animate-pulse" />
      <h1 className="text-2xl font-bold text-white mt-4">F.O.C. Portal</h1>
    </motion.div>
  );

  const renderAuth = () => (
    <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <Flame size={48} className="text-orange-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2 text-center text-white">Welcome</h1>
        <p className="text-slate-400 mb-8 text-center text-sm">Sign up to track your consistency.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Disciple Name</label>
            <input type="text" name="name" required placeholder="Enter your name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">WhatsApp Number</label>
            <input type="tel" name="whatsapp" required placeholder="e.g. +234..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none" />
          </div>
          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-4">
            Enter Portal <ChevronRight size={20} />
          </button>
        </form>
      </div>
    </motion.div>
  );

  const renderDashboard = () => {
    const allUsers = [...MOCK_LEADERBOARD];
    if (!allUsers.find(u => u.name === user.name)) {
      allUsers.push({ name: user.name, streak: user.streak });
    } else {
      const u = allUsers.find(u => u.name === user.name);
      if (u) u.streak = user.streak;
    }
    allUsers.sort((a, b) => b.streak - a.streak);

    return (
      <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-y-auto p-6 pb-24 bg-[#0a0a0a]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-slate-400 text-sm">Hello,</p>
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full">
            <LogOut size={20} />
          </button>
        </div>

        {/* Daily Motivation */}
        <div className="bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-orange-400" />
            <h3 className="text-xs text-orange-400 font-bold uppercase tracking-wider">Daily Motivation</h3>
          </div>
          <p className="text-slate-200 text-sm italic leading-relaxed">"{scripture}"</p>
        </div>

        {/* Streak UI (Matching Image) */}
        <div className="bg-[#111] border border-white/5 rounded-3xl p-5 mb-8 shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Calendar className="text-orange-500" size={20} /> Daily Streak
            </div>
            <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-lg text-xs font-bold border border-orange-500/20">
              DAY {user.checkInsThisMonth.length}/{daysInMonth}
            </div>
          </div>
          <p className="text-slate-400 text-xs mb-6">Claim rewards for {daysInMonth} consecutive days!</p>
          
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${getCurrentMonthStr()}-${dayNum.toString().padStart(2, '0')}`;
              const isCompleted = user.checkInsThisMonth.includes(dateStr);
              const isToday = dayNum === currentDay;
              
              return (
                <div key={dayNum} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isCompleted ? 'border-orange-500 bg-orange-500/10' : isToday ? 'border-orange-500/40 bg-white/5' : 'border-white/5 bg-white/5'} aspect-square`}>
                  <span className={`text-[10px] font-medium mb-1 ${isCompleted || isToday ? 'text-orange-500' : 'text-slate-500'}`}>Day {dayNum}</span>
                  {isCompleted ? (
                    <CheckCircle2 size={18} className="text-orange-500" />
                  ) : (
                    <span className="text-slate-600 text-[10px] font-bold">{dayNum * 50}</span>
                  )}
                </div>
              )
            })}
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
              <CheckCircle2 size={16} /> Next Reward in 24h
            </div>
          </div>
        </div>

        {/* Leaderboard on Dashboard */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="text-yellow-500" size={20} />
            <h2 className="text-lg font-bold text-white">Consistency Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {allUsers.slice(0, 5).map((u, i) => (
              <div key={i} className={`rounded-xl p-3 flex items-center justify-between ${u.name === user.name ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-white/5 border border-white/5'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {i + 1}
                  </div>
                  <p className={`font-medium text-sm ${u.name === user.name ? 'text-orange-400' : 'text-white'}`}>{u.name} {u.name === user.name && '(You)'}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-lg">
                  <Flame size={14} className="text-orange-500" />
                  <span className="text-white font-bold text-sm">{u.streak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderCheckIn = () => {
    const hasCheckedInToday = user.lastCheckIn === getTodayStr();

    return (
      <motion.div key="checkin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-y-auto p-6 pb-24 bg-[#0a0a0a]">
        <h1 className="text-2xl font-bold text-white mb-2">Daily Altar</h1>
        <p className="text-slate-400 mb-8 text-sm">Complete your disciplines to maintain your streak.</p>
        
        {hasCheckedInToday ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center mt-12">
            <div className="bg-orange-500/10 p-6 rounded-full mb-6">
              <CheckCircle2 size={64} className="text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Altar Completed</h2>
            <p className="text-slate-400 max-w-[250px]">You have already logged your disciplines for today. Great job maintaining your streak!</p>
          </div>
        ) : (
          <form onSubmit={handleCheckIn} className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-3 flex-1">
              {TASKS.map(task => (
                <label key={task.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-medium text-white">{task.name}</p>
                  </div>
                  <input type="checkbox" name={task.id} className="w-6 h-6 rounded border-slate-600 text-orange-500 focus:ring-orange-500 bg-slate-800 cursor-pointer" />
                </label>
              ))}
            </div>
            <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl mt-8 transition-all text-lg">
              Log Today's Altar
            </button>
          </form>
        )}
      </motion.div>
    );
  };

  const renderBooking = () => (
    <motion.div key="booking" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-y-auto p-6 pb-24 bg-[#0a0a0a]">
      <div className="flex items-center gap-3 mb-2">
        <MessageCircle className="text-orange-500" size={28} />
        <h1 className="text-2xl font-bold text-white">1-on-1 Session</h1>
      </div>
      <p className="text-slate-400 mb-8 text-sm">Book a weekly class session to discuss your progress. I will review and approve via WhatsApp.</p>
      
      <form onSubmit={handleBookSession} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Preferred Date & Time</label>
          <input type="datetime-local" name="date" required className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Topic / Area of Focus</label>
          <textarea name="topic" required rows={4} placeholder="What would you like to discuss?" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-orange-500 focus:outline-none resize-none"></textarea>
        </div>
        <button type="submit" className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
          <MessageCircle size={20} /> Request via WhatsApp
        </button>
      </form>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-0 md:p-4 font-sans text-slate-200">
      <div className="w-full h-[100dvh] md:h-[850px] md:max-h-[90vh] md:max-w-[400px] bg-[#0a0a0a] md:rounded-[2.5rem] md:shadow-2xl overflow-hidden relative md:border-[8px] border-slate-900 flex flex-col">
        
        <AnimatePresence mode="wait">
          {view === 'loading' && renderLoading()}
          {view === 'auth' && renderAuth()}
          {view === 'dashboard' && renderDashboard()}
          {view === 'checkin' && renderCheckIn()}
          {view === 'booking' && renderBooking()}
        </AnimatePresence>

        {/* Bottom Navigation */}
        <AnimatePresence>
          {['dashboard', 'checkin', 'booking'].includes(view) && (
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/10 p-2 pb-safe">
              <div className="flex justify-around items-center p-2">
                <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1.5 w-16 ${view === 'dashboard' ? 'text-orange-500' : 'text-slate-500'}`}>
                  <Home size={24} />
                  <span className="text-[10px] font-medium">Home</span>
                </button>
                <button onClick={() => setView('checkin')} className={`flex flex-col items-center gap-1.5 w-16 ${view === 'checkin' ? 'text-orange-500' : 'text-slate-500'}`}>
                  <CheckSquare size={24} />
                  <span className="text-[10px] font-medium">Altar</span>
                </button>
                <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1.5 w-16 ${view === 'booking' ? 'text-orange-500' : 'text-slate-500'}`}>
                  <MessageCircle size={24} />
                  <span className="text-[10px] font-medium">1-on-1</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Congrats Modal */}
        <AnimatePresence>
          {showCongrats && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 px-6">
              <div className="bg-[#111] border border-orange-500/30 p-8 rounded-3xl text-center max-w-sm">
                <Trophy size={64} className="text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Most Consistent Disciple!</h2>
                <p className="text-slate-300 mb-6">Congratulations! You have maintained your streak for the entire month. Your dedication is inspiring.</p>
                <button onClick={() => setShowCongrats(false)} className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold">Continue</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

