import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, Calendar, Trophy, Home, CheckSquare, LogOut, 
  MessageCircle, CheckCircle2, BookOpen, ChevronRight, 
  Star, Heart, Users, Award, Target, Zap, ShieldCheck
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit,
  updateDoc,
  addDoc,
  where,
  getDocs
} from 'firebase/firestore';

// --- Types ---
interface UserData {
  uid: string;
  whatsapp: string;
  checkInsThisMonth: string[];
  lastCheckIn: string;
  lastMonth: string;
  points: number;
  streak: number;
  recognitions?: string[];
}

interface LeaderboardEntry {
  uid: string;
  name: string;
  streak: number;
  points: number;
  recognitions?: string[];
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Error Handler ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Constants & Flows ---
const DAILY_FLOW = [
  { id: 'scripture_hunt', name: 'Scripture Hunt', points: 10 },
  { id: 'inspiring_clips', name: 'Inspiring Clips', points: 5 },
  { id: 'daily_affirmations', name: 'Daily Affirmations', points: 5 },
];

const BASE_TASKS = [
  { id: 'devotion', name: 'Daily Personal Devotion', points: 10 },
  { id: 'study_3', name: 'Study 3 Chapters', points: 15 },
  { id: 'intercede', name: 'Pray for someone (Intercede)', points: 10 },
  { id: 'repost_aff', name: 'Repost Daily Affirmations', points: 5 },
];

const DAY_SPECIFIC_TASKS: Record<number, {id: string, name: string, points: number}[]> = {
  1: [{ id: 'disciple_week', name: 'Discipline of the Week + Prayer Goals', points: 10 }],
  2: [{ id: 'evangelism', name: 'Evangelism', points: 20 }, { id: 'passage_ref', name: 'Passage of the Day + Reflections', points: 10 }],
  3: [{ id: 'check_member', name: 'Check up on a member', points: 10 }, { id: 'midweek_word', name: 'Midweek Word & Prayer Call', points: 15 }],
  4: [{ id: 'evangelism_impact', name: 'Evangelism / Impact Day', points: 20 }],
  5: [{ id: 'fasting', name: 'Fasting', points: 20 }, { id: 'faith_story', name: 'Faith Story / Bible Quiz', points: 10 }],
  6: [{ id: 'check_member_sat', name: 'Check up on a member', points: 10 }, { id: 'vn_reflection', name: 'VN Reflection & Rest', points: 10 }],
};

const MONTHLY_FLOW = [
  "Theme of the Month", "Character of the Month", "Monthly Fasting & 2-Day Virtual Retreat",
  "Serve Sunday", "Kingdom Impact Challenge", "Vision & Reset Night", "Word Feast Weekend",
  "Faith Story Spotlight", "The Growth Awards", "Community Prayer Chain", "Birthday Celebration 🎉"
];

// --- Main App Component ---
function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<'auth' | 'onboarding' | 'dashboard' | 'checkin' | 'leaderboard' | 'booking' | 'messages'>('auth');
  
  const [whatsappInput, setWhatsappInput] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [evalAnswers, setEvalAnswers] = useState({ consistency: 3, evangelized: false, scriptures: false, worship: false });
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [showFireAnimation, setShowFireAnimation] = useState(false);
  const [earnedPointsDisplay, setEarnedPointsDisplay] = useState(0);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Booking State
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [adminBookings, setAdminBookings] = useState<any[]>([]);

  // Messages State
  const [msgType, setMsgType] = useState<'testimony' | 'anonymous'>('testimony');
  const [msgContent, setMsgContent] = useState('');
  const [msgStatus, setMsgStatus] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setCurrentView('auth');
        setUserData(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // User Data Listener
  useEffect(() => {
    if (!isAuthReady || !authUser) return;

    const userRef = doc(db, 'users_private', authUser.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserData;
        
        // Monthly Reset Logic
        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        if (data.lastMonth !== currentMonth) {
          const updatedData = {
            ...data,
            checkInsThisMonth: [],
            lastMonth: currentMonth,
            streak: 0 // Reset streak monthly
          };
          try {
            await updateDoc(userRef, updatedData);
            await updateDoc(doc(db, 'users_public', authUser.uid), { streak: 0 });
            setUserData(updatedData);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users_private/${authUser.uid}`);
          }
        } else {
          setUserData(data);
        }
        
        if (currentView === 'auth' || currentView === 'onboarding') {
          setCurrentView('dashboard');
        }
      } else {
        setCurrentView('onboarding');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users_private/${authUser.uid}`);
    });

    return () => unsubscribe();
  }, [authUser, isAuthReady]);

  // Leaderboard Listener
  useEffect(() => {
    if (!isAuthReady || !authUser) return;

    const q = query(collection(db, 'users_public'), orderBy('points', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LeaderboardEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as LeaderboardEntry);
      });
      setLeaderboard(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users_public');
    });

    return () => unsubscribe();
  }, [authUser, isAuthReady]);

  // Admin Bookings Listener
  useEffect(() => {
    if (!isAuthReady || !authUser || authUser.email !== 'israelogbemudia190@gmail.com') return;

    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsList: any[] = [];
      snapshot.forEach((doc) => {
        bookingsList.push({ id: doc.id, ...doc.data() });
      });
      setAdminBookings(bookingsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, [authUser, isAuthReady]);

  // Handlers
  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message);
      console.error("Login failed", error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setAuthMessage('Verification email sent! Please check your inbox before logging in.');
        await signOut(auth); // Force them to verify before proceeding
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setAuthError('Please verify your email before logging in.');
          await signOut(auth);
        }
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !whatsappInput.trim()) return;

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    
    try {
      await setDoc(doc(db, 'users_private', authUser.uid), {
        uid: authUser.uid,
        whatsapp: whatsappInput,
        email: authUser.email || email || '',
        checkInsThisMonth: [],
        lastCheckIn: '',
        lastMonth: currentMonth,
        points: 0,
        streak: 0,
        recognitions: []
      });

      await setDoc(doc(db, 'users_public', authUser.uid), {
        uid: authUser.uid,
        name: authUser.displayName || 'Disciple',
        streak: 0,
        points: 0,
        recognitions: []
      });

      setCurrentView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users_private/${authUser.uid}`);
    }
  };

  const handleCheckIn = async () => {
    if (!userData || !authUser) return;
    setIsCheckingIn(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const currentDayOfWeek = new Date().getDay(); // 0 is Sunday
    
    let earnedPoints = 0;

    if (currentDayOfWeek === 0) {
      // Sunday Evaluation Points
      earnedPoints += evalAnswers.consistency * 5; // up to 25
      if (evalAnswers.evangelized) earnedPoints += 20;
      if (evalAnswers.scriptures) earnedPoints += 20;
      if (evalAnswers.worship) earnedPoints += 20;
    } else {
      // Weekday Tasks Points
      const allTasks = [...DAILY_FLOW, ...BASE_TASKS, ...(DAY_SPECIFIC_TASKS[currentDayOfWeek] || [])];
      allTasks.forEach(task => {
        if (checkedTasks[task.id]) earnedPoints += task.points;
      });
    }

    // Calculate streak
    let newStreak = userData.streak;
    const lastCheckInDate = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
    const todayDate = new Date(todayStr);
    
    if (lastCheckInDate) {
      const diffTime = Math.abs(todayDate.getTime() - lastCheckInDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const newCheckIns = [...userData.checkInsThisMonth, todayStr];
    const newTotalPoints = (userData.points || 0) + earnedPoints;

    try {
      await updateDoc(doc(db, `users_private/${authUser.uid}`), {
        points: newTotalPoints,
        streak: newStreak,
        lastCheckIn: todayStr,
        checkInsThisMonth: newCheckIns
      });

      await updateDoc(doc(db, `users_public/${authUser.uid}`), {
        points: newTotalPoints,
        streak: newStreak
      });

      setEarnedPointsDisplay(earnedPoints);
      setShowFireAnimation(true);
      setTimeout(() => {
        setShowFireAnimation(false);
        setCurrentView('dashboard');
      }, 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users_private/${authUser.uid}`);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !bookingDate || !bookingTime) return;
    
    try {
      setBookingMessage('Checking availability...');
      const q = query(collection(db, 'bookings'), where('date', '==', bookingDate), where('time', '==', bookingTime));
      const querySnapshot = await getDocs(q);
      
      const isTaken = querySnapshot.docs.some(doc => {
        const data = doc.data();
        return data.status === 'pending' || data.status === 'approved';
      });

      if (isTaken) {
        setBookingMessage('This time slot is already taken. Please select a different slot.');
        return;
      }

      await addDoc(collection(db, 'bookings'), {
        uid: authUser.uid,
        name: authUser.displayName || userData?.whatsapp || 'User',
        email: authUser.email || email || '',
        whatsapp: userData?.whatsapp || '',
        date: bookingDate,
        time: bookingTime,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      setBookingMessage('Booking requested successfully! You will be notified via email upon approval.');
      
      // Notify Admin via Email
      await fetch('/api/request-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authUser.displayName || userData?.whatsapp || 'User',
          email: authUser.email || email || '',
          date: bookingDate,
          time: bookingTime,
          userPhone: userData?.whatsapp || ''
        })
      });

      setBookingDate('');
      setBookingTime('');
    } catch (error) {
      setBookingMessage('Error requesting booking.');
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  };

  const handleApproveBooking = async (booking: any) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status: 'approved' });
      
      const res = await fetch('/api/approve-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: booking.email,
          name: booking.name,
          date: booking.date,
          time: booking.time,
          userPhone: booking.whatsapp || ''
        })
      });

      if (res.ok) {
        alert('Booking approved! Notifications and reminders have been scheduled.');
      } else {
        alert('Booking approved, but failed to schedule notifications.');
      }
    } catch (error) {
      console.error(error);
      alert('Error approving booking.');
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !msgContent.trim()) return;

    setMsgStatus('Sending...');
    try {
      const messageData: any = {
        type: msgType,
        content: msgContent,
        createdAt: new Date().toISOString()
      };

      if (msgType !== 'anonymous') {
        messageData.userName = authUser.displayName || 'User';
      }

      await addDoc(collection(db, 'messages'), messageData);

      await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msgType,
          content: msgContent,
          userName: msgType === 'anonymous' ? 'Anonymous' : (authUser.displayName || 'User')
        })
      });

      setMsgStatus('Message sent successfully!');
      setMsgContent('');
      setTimeout(() => setMsgStatus(''), 3000);
    } catch (error) {
      setMsgStatus('Failed to send message.');
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const handleSendMonthlyReports = async () => {
    if (!authUser || authUser.email !== 'israelogbemudia190@gmail.com') return;
    
    try {
      const usersSnapshot = await getDocs(collection(db, 'users_public'));
      const reports: any[] = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const publicData = userDoc.data();
        const privateSnap = await getDoc(doc(db, 'users_private', userDoc.id));
        const privateData = privateSnap.exists() ? privateSnap.data() : null;
        
        if (privateData && privateData.email) {
          reports.push({
            email: privateData.email,
            name: publicData.name,
            points: publicData.points,
            streak: publicData.streak,
            awards: publicData.recognitions || []
          });
        }
      }

      const res = await fetch('/api/send-monthly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports })
      });
      
      if (res.ok) {
        alert('Monthly reports sent successfully!');
      } else {
        alert('Failed to send reports.');
      }
    } catch (error) {
      console.error(error);
      alert('Error sending reports.');
    }
  };

  // --- Render Helpers ---
  const todayStr = new Date().toISOString().split('T')[0];
  const hasCheckedInToday = userData?.lastCheckIn === todayStr;
  const currentDayOfWeek = new Date().getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[currentDayOfWeek];

  // --- Views ---
  const renderAuth = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center overflow-y-auto">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-8 mt-8">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.3)] mb-6">
          <Flame className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">F.O.C. Portal</h1>
        <p className="text-cyan-400 font-medium tracking-wide uppercase text-sm">Accountability & Growth</p>
      </motion.div>

      <div className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl mb-6">
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          {authMessage && <p className="text-green-400 text-sm">{authMessage}</p>}
          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
          />
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-cyan-500/25 transition-all">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-4 text-sm text-cyan-400 hover:underline">
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>

      <div className="flex items-center gap-4 w-full max-w-sm mb-6">
        <div className="h-px bg-white/10 flex-1"></div>
        <span className="text-slate-500 text-sm">OR</span>
        <div className="h-px bg-white/10 flex-1"></div>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="w-full max-w-sm py-4 px-6 bg-white text-slate-900 rounded-2xl font-bold text-lg shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-3"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>
    </div>
  );

  const renderOnboarding = () => (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to the Family</h2>
        <p className="text-slate-400 mb-8">Please provide your WhatsApp number so we can connect you with your mentor.</p>
        <form onSubmit={handleOnboarding} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp Number</label>
            <input
              type="tel"
              required
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-colors"
              placeholder="+1 234 567 8900"
            />
          </div>
          <button type="submit" className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-cyan-500/25 transition-all">
            Complete Setup
          </button>
        </form>
      </motion.div>
    </div>
  );

  const renderDashboard = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <header className="flex justify-between items-center mb-8">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <h1 className="text-3xl font-bold text-white">Welcome, {authUser?.displayName?.split(' ')[0]}</h1>
          <p className="text-cyan-400">We grow daily—not by pressure, but by grace.</p>
        </motion.div>
        <motion.img 
          initial={{ scale: 0, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          transition={{ delay: 0.2, type: "spring" }}
          src={authUser?.photoURL || ''} 
          alt="Profile" 
          className="w-12 h-12 rounded-full border-2 border-cyan-400" 
          referrerPolicy="no-referrer" 
        />
      </header>

      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-orange-500/50 transition-colors"
        >
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity group-hover:scale-110 duration-500"><Flame size={48} className="text-orange-500" /></div>
          <p className="text-slate-400 font-medium mb-1">Current Streak</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{userData?.streak || 0}</span>
            <span className="text-slate-500 font-medium">days</span>
          </div>
        </motion.div>
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-cyan-400/50 transition-colors"
        >
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity group-hover:scale-110 duration-500"><Star size={48} className="text-cyan-400" /></div>
          <p className="text-slate-400 font-medium mb-1">Total Points</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{userData?.points || 0}</span>
            <span className="text-slate-500 font-medium">pts</span>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.4 }}
        className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-cyan-400" /> Today's Focus: {todayName}
          </h2>
          {hasCheckedInToday && <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">Completed</span>}
        </div>
        <p className="text-slate-300 mb-6">
          {currentDayOfWeek === 0 ? "It's Sunday! Time for our weekly evaluation and worship." : "Complete your daily altar to maintain your streak and grow in grace."}
        </p>
        <button
          onClick={() => setCurrentView('checkin')}
          disabled={hasCheckedInToday}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            hasCheckedInToday 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-[1.02]'
          }`}
        >
          {hasCheckedInToday ? <><CheckCircle2 /> Altar Completed</> : <><Zap /> Go to Daily Altar</>}
        </button>
      </motion.div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.5 }}
        className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Target className="text-purple-400" /> Our Kingdom Pulse (Monthly Flow)</h3>
        <div className="flex overflow-x-auto pb-4 gap-3 snap-x hide-scrollbar">
          {MONTHLY_FLOW.map((item, i) => (
            <div key={i} className="snap-start shrink-0 w-48 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-center text-center hover:bg-slate-800 transition-colors">
              <span className="text-sm font-medium text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  const renderCheckIn = () => {
    if (hasCheckedInToday) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Altar Completed</h2>
          <p className="text-slate-400 mb-8">You've successfully logged your activities for today. See you tomorrow!</p>
          <button onClick={() => setCurrentView('dashboard')} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors">
            Back to Dashboard
          </button>
        </div>
      );
    }

    const tasksForToday = currentDayOfWeek !== 0 ? [
      { category: 'Daily Flow - "Our Daily Bread"', tasks: DAILY_FLOW },
      { category: 'Base Tasks', tasks: BASE_TASKS },
      { category: `Today's Special (${todayName})`, tasks: DAY_SPECIFIC_TASKS[currentDayOfWeek] || [] }
    ] : [];

    return (
      <div className="max-w-2xl mx-auto pb-20">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{todayName} Altar</h1>
          <p className="text-cyan-400">Log your spiritual growth activities.</p>
        </header>

        {currentDayOfWeek === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6">Weekly Evaluation</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-300 font-medium mb-3">Rate your consistency this week (1-5)</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(num => (
                      <button 
                        key={num}
                        onClick={() => setEvalAnswers({...evalAnswers, consistency: num})}
                        className={`w-12 h-12 rounded-xl font-bold text-lg transition-all ${evalAnswers.consistency >= num ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { id: 'evangelized', label: 'Did you share the Gospel / Evangelize?' },
                  { id: 'scriptures', label: 'Did you complete all scripture readings?' },
                  { id: 'worship', label: 'Did you attend Worship & Recognition?' }
                ].map(q => (
                  <div key={q.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <span className="text-slate-200 font-medium">{q.label}</span>
                    <button 
                      onClick={() => setEvalAnswers({...evalAnswers, [q.id]: !evalAnswers[q.id as keyof typeof evalAnswers]})}
                      className={`w-14 h-8 rounded-full p-1 transition-colors ${evalAnswers[q.id as keyof typeof evalAnswers] ? 'bg-cyan-500' : 'bg-slate-700'}`}
                    >
                      <motion.div layout className="w-6 h-6 bg-white rounded-full shadow-sm" style={{ x: evalAnswers[q.id as keyof typeof evalAnswers] ? 24 : 0 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {tasksForToday.map((section, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
                <h3 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider text-sm">{section.category}</h3>
                <div className="space-y-3">
                  {section.tasks.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => setCheckedTasks(prev => ({...prev, [task.id]: !prev[task.id]}))}
                      className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                        checkedTasks[task.id] ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${checkedTasks[task.id] ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-500'}`}>
                          {checkedTasks[task.id] && <CheckSquare size={16} />}
                        </div>
                        <span className={`font-medium ${checkedTasks[task.id] ? 'text-white' : 'text-slate-300'}`}>{task.name}</span>
                      </div>
                      <span className="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">+{task.points} pts</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={handleCheckIn}
            disabled={isCheckingIn}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-cyan-500/25 transition-all flex justify-center items-center gap-2"
          >
            {isCheckingIn ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Altar'}
          </button>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    // Calculate Awards based on current standings
    const topDisciple = leaderboard[0];
    const topEvangelist = leaderboard.find(u => u.points > 100); // Mock logic
    const topConsistent = [...leaderboard].sort((a,b) => b.streak - a.streak)[0];

    return (
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Growth Awards</h1>
          <p className="text-cyan-400">Honoring growth in the Kingdom.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20 p-6 rounded-3xl text-center">
            <Award className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-amber-400 font-bold text-sm uppercase tracking-wider mb-1">Face of the Month</h3>
            <p className="text-white font-bold text-xl">{topDisciple?.name || '---'}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/5 border border-cyan-500/20 p-6 rounded-3xl text-center">
            <Flame className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
            <h3 className="text-cyan-400 font-bold text-sm uppercase tracking-wider mb-1">Consistent Attendee</h3>
            <p className="text-white font-bold text-xl">{topConsistent?.name || '---'}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-600/5 border border-purple-500/20 p-6 rounded-3xl text-center">
            <ShieldCheck className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <h3 className="text-purple-400 font-bold text-sm uppercase tracking-wider mb-1">Faithful Servant</h3>
            <p className="text-white font-bold text-xl">{leaderboard[1]?.name || '---'}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Trophy className="text-yellow-500" /> Consistency Leaderboard</h2>
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          {leaderboard.map((user, index) => (
            <motion.div 
              key={user.uid}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 ${user.uid === authUser?.uid ? 'bg-cyan-500/10' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-yellow-900' : 
                  index === 1 ? 'bg-slate-300 text-slate-800' : 
                  index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="text-white font-bold">{user.name} {user.uid === authUser?.uid && <span className="text-xs font-normal text-cyan-400 ml-2">(You)</span>}</p>
                  <p className="text-slate-400 text-sm">{user.points} pts</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-700">
                <Flame size={16} className={user.streak > 0 ? 'text-orange-500' : 'text-slate-600'} />
                <span className="text-white font-bold">{user.streak}</span>
              </div>
            </motion.div>
          ))}
          {leaderboard.length === 0 && (
            <div className="p-8 text-center text-slate-500">No disciples found.</div>
          )}
        </div>
      </div>
    );
  };

  const renderBooking = () => {
    const isAdmin = authUser?.email === 'israelogbemudia190@gmail.com';

    return (
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">1-on-1 Session</h1>
          <p className="text-cyan-400">Book a private 1-hour session to track your progress.</p>
        </header>

        {isAdmin ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Manage Bookings</h2>
            {adminBookings.length === 0 && <p className="text-slate-400">No bookings found.</p>}
            {adminBookings.map((booking) => (
              <div key={booking.id} className="bg-slate-800/50 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <p className="text-white font-bold">{booking.name}</p>
                  <p className="text-slate-400 text-sm">{booking.date} at {booking.time}</p>
                  <p className="text-slate-500 text-xs mt-1">Status: <span className={booking.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}>{booking.status}</span></p>
                </div>
                {booking.status === 'pending' && (
                  <button 
                    onClick={() => handleApproveBooking(booking)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm transition-colors"
                  >
                    Approve & Notify
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Connect with your Mentor</h2>
            <p className="text-slate-300 mb-8 text-center">Select a date and time. Sessions are 1 hour long.</p>
            
            <form onSubmit={handleBooking} className="space-y-6">
              {bookingMessage && <p className="text-cyan-400 text-center font-medium">{bookingMessage}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Date</label>
                  <input type="date" required value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Time</label>
                  <input type="time" required value={bookingTime} onChange={e => setBookingTime(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-lg transition-colors">
                Request Session
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const renderMessages = () => (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Share & Connect</h1>
        <p className="text-cyan-400">Submit testimonies or ask anonymous questions directly to your mentor.</p>
      </header>
      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
        <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-cyan-400" />
        </div>
        <form onSubmit={handleSendMessage} className="space-y-6">
          {msgStatus && (
            <div className={`p-4 rounded-xl text-center font-bold ${msgStatus.includes('Error') || msgStatus.includes('Failed') ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {msgStatus}
            </div>
          )}
          <div className="flex gap-4 mb-6">
            <button type="button" onClick={() => setMsgType('testimony')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${msgType === 'testimony' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              Testimony
            </button>
            <button type="button" onClick={() => setMsgType('anonymous')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${msgType === 'anonymous' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              Anonymous Q&A
            </button>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              {msgType === 'testimony' ? 'Your Testimony' : 'Your Anonymous Message'}
            </label>
            <textarea required rows={6} value={msgContent} onChange={e => setMsgContent(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 outline-none resize-none" placeholder={msgType === 'testimony' ? "Share what God has done in your life..." : "Ask anything anonymously. Your identity will be completely hidden from the admin..."}></textarea>
          </div>
          <button type="submit" className={`w-full py-4 text-white rounded-xl font-bold shadow-lg transition-all ${msgType === 'testimony' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500' : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500'}`}>
            Send {msgType === 'testimony' ? 'Testimony' : 'Anonymous Message'}
          </button>
        </form>
      </div>
    </div>
  );

  // --- Main Layout ---
  if (!isAuthReady) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (currentView === 'auth') return <div className="h-screen bg-[#0a0a0a]">{renderAuth()}</div>;
  if (currentView === 'onboarding') return <div className="h-screen bg-[#0a0a0a]">{renderOnboarding()}</div>;

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'checkin', icon: CheckSquare, label: 'Daily Altar' },
    { id: 'leaderboard', icon: Trophy, label: 'Awards' },
    { id: 'booking', icon: Users, label: '1-on-1' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-slate-200 font-sans selection:bg-cyan-500/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/50 border-r border-white/5 p-6">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center">
            <Flame className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">F.O.C.</span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                currentView === item.id ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>
        {authUser?.email === 'israelogbemudia190@gmail.com' && (
          <button onClick={handleSendMonthlyReports} className="flex items-center gap-3 px-4 py-3 text-cyan-400 hover:bg-white/5 transition-colors mt-auto mb-2 rounded-xl w-full">
            <Target size={20} /> Send Reports
          </button>
        )}
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 transition-colors mt-auto">
          <LogOut size={20} /> Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'checkin' && renderCheckIn()}
            {currentView === 'leaderboard' && renderLeaderboard()}
            {currentView === 'booking' && renderBooking()}
            {currentView === 'messages' && renderMessages()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 p-4 pb-safe flex justify-around items-center z-40">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id as any)}
            className={`flex flex-col items-center gap-1 p-2 ${currentView === item.id ? 'text-cyan-400' : 'text-slate-500'}`}
          >
            <item.icon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Fire Animation Overlay */}
      <AnimatePresence>
        {showFireAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: -50 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, -5, 5, 0]
                }} 
                transition={{ 
                  duration: 0.5, 
                  repeat: Infinity,
                  repeatType: "reverse" 
                }}
                className="w-32 h-32 bg-gradient-to-t from-orange-600 to-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(249,115,22,0.6)] mb-8"
              >
                <Flame className="w-20 h-20 text-white" />
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300 text-center mb-4">
                The Fire is Burning!
              </h2>
              <p className="text-xl text-white font-bold bg-white/10 px-6 py-3 rounded-full border border-white/20">
                +{earnedPointsDisplay} Points added to your Crown.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
