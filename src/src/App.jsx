import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Plus, 
  Trash2, 
  History,
  MoonStar,
  Sun,
  Download,
  Home,
  PlusCircle,
  List,
  User,
  LogOut,
  LogIn,
  ShieldCheck,
  Phone,
  Edit3,
  Globe,
  Smartphone,
  Lock,
  Bell,
  UserCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';

// Inisialisasi Firebase
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'keuangan-masjid-app';

// Helper Format Rupiah
const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [type, setType] = useState('pemasukan');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth State
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Tab Akun Sub-Menu
  const [accountTabMode, setAccountTabMode] = useState('profil'); // 'profil', 'password', 'notifikasi'

  // Security & Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });

  // Notifikasi State
  const [notifPreferences, setNotifPreferences] = useState({
    transaksiMasuk: true,
    transaksiKeluar: true,
    laporanBulanan: false
  });

  // State Navigasi
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', phoneNumber: '', photoURL: '' });
  const [uploadError, setUploadError] = useState('');
  const [showAppInfoModal, setShowAppInfoModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // 1. Authentication Effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching Effect
  useEffect(() => {
    if (!user) return;
    const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribe = onSnapshot(
      transactionsRef,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // 3. Profile Fetching Effect
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setProfile(null);
      return;
    }
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        setProfile({
          displayName: user.displayName || '',
          phoneNumber: user.phoneNumber || '',
          photoURL: user.photoURL || ''
        });
      }
    }, (error) => console.error("Error fetching profile:", error));
    return () => unsubscribe();
  }, [user]);

  // 4. Notification Settings Effect
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const notifRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubscribe = onSnapshot(notifRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().notifications) {
        setNotifPreferences(docSnap.data().notifications);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const totalPemasukan = transactions.filter(t => t.type === 'pemasukan').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPengeluaran = transactions.filter(t => t.type === 'pengeluaran').reduce((acc, curr) => acc + curr.amount, 0);
  const saldoAwal = totalPemasukan - totalPengeluaran;

  const formatIdentifier = (identifier) => {
    if (!identifier) return '';
    if (identifier.includes('@')) return identifier.toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, '');
    return `${cleanPhone}@phone.masjid.local`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) return;
    setAuthLoading(true); setAuthError('');
    try {
      const finalEmail = formatIdentifier(authEmail);
      const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, authPassword);
      await updateProfile(userCredential.user, { displayName: authName });
      let phone = '';
      if (!authEmail.includes('@')) phone = authEmail.replace(/\D/g, '');
      const defaultPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(authName)}&background=0D8B63&color=fff&size=200`;
      
      await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid, 'profile', 'info'), {
        displayName: authName, phoneNumber: phone, photoURL: defaultPhoto
      });
      setAuthName(''); setAuthEmail(''); setAuthPassword('');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setAuthLoading(true); setAuthError('');
    try {
      const finalEmail = formatIdentifier(authEmail);
      await signInWithEmailAndPassword(auth, finalEmail, authPassword);
      setAuthEmail(''); setAuthPassword('');
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true); setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await signInAnonymously(auth); 
      setActiveTab('dashboard');
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      await setDoc(profileRef, editForm, { merge: true });
      await updateProfile(user, { displayName: editForm.displayName, photoURL: editForm.photoURL });
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdMessage({ type: '', text: '' });
    if (newPassword !== confirmPassword) {
      return setPwdMessage({ type: 'error', text: 'Password dan konfirmasi tidak cocok.' });
    }
    if (newPassword.length < 6) {
      return setPwdMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
    }
    try {
      await updatePassword(user, newPassword);
      setPwdMessage({ type: 'success', text: 'Sandi berhasil diperbarui!' });
      setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setPwdMessage({ type: 'error', text: 'Demi keamanan, silakan logout dan login ulang sebelum mengubah password.' });
      } else {
        setPwdMessage({ type: 'error', text: error.message.replace('Firebase: ', '') });
      }
    }
  };

  const toggleNotif = async (key) => {
    const newPrefs = { ...notifPreferences, [key]: !notifPreferences[key] };
    setNotifPreferences(newPrefs);
    if (user && !user.isAnonymous) {
      const notifRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
      await setDoc(notifRef, { notifications: newPrefs }, { merge: true });
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
      setUploadError('Hanya format JPG/JPEG dan PNG yang diperbolehkan.');
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256; const MAX_HEIGHT = 256;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditForm(prev => ({ ...prev, photoURL: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startEditingProfile = () => {
    setEditForm({
      displayName: profile?.displayName || user.displayName || '',
      phoneNumber: profile?.phoneNumber || '',
      photoURL: profile?.photoURL || user.photoURL || ''
    });
    setUploadError('');
    setIsEditingProfile(true);
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Tanggal', 'Jenis', 'Keterangan', 'Nominal (Rp)'];
    const csvRows = transactions.map(trx => `"${trx.date}","${trx.type}","${trx.description.replace(/"/g, '""')}","${trx.amount}"`);
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'laporan_keuangan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToWord = () => {
    if (transactions.length === 0) return;
    const tableRows = transactions.map((trx, index) => `
      <tr>
        <td style="border: 1px solid #dddddd; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #dddddd; padding: 8px; text-align: center;">${trx.date}</td>
        <td style="border: 1px solid #dddddd; padding: 8px; text-align: center; text-transform: uppercase; font-weight: bold; color: ${trx.type === 'pemasukan' ? '#0d9488' : '#e11d48'};">${trx.type}</td>
        <td style="border: 1px solid #dddddd; padding: 8px;">${trx.description}</td>
        <td style="border: 1px solid #dddddd; padding: 8px; text-align: right; font-weight: bold;">${formatRupiah(trx.amount)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Laporan Keuangan Masjid</title></head>
      <body>
        <h2 style="text-align: center; color: #065f46;">LAPORAN KEUANGAN KAS MASJID</h2>
        <p style="text-align: center; color: #666;">Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
          <thead>
            <tr style="background-color: #065f46; color: white;">
              <th style="border: 1px solid #065f46; padding: 8px;">No</th>
              <th style="border: 1px solid #065f46; padding: 8px;">Tanggal</th>
              <th style="border: 1px solid #065f46; padding: 8px;">Jenis</th>
              <th style="border: 1px solid #065f46; padding: 8px;">Keterangan</th>
              <th style="border: 1px solid #065f46; padding: 8px;">Nominal</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'laporan_keuangan_masjid.doc');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !description || !date || !user) return;
    setIsSubmitting(true);
    try {
      const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      await addDoc(transactionsRef, {
        type, amount: Number(amount), description, date, timestamp: Date.now()
      });
      setAmount(''); setDescription('');
      if (window.innerWidth < 1024) setActiveTab('riwayat');
    } catch (error) {
      console.error("Error adding transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 text-gray-800 font-sans selection:bg-emerald-200">
      <header className="bg-gradient-to-r from-emerald-800 to-green-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5 mix-blend-overlay"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-yellow-300 opacity-10 mix-blend-overlay"></div>
        
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
              <MoonStar className="w-8 h-8 md:w-10 md:h-10 text-yellow-300" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Kas<span className="text-yellow-300">Masjid</span></h1>
                <button 
                  onClick={() => setShowAppInfoModal(true)}
                  className="bg-emerald-700/85 hover:bg-emerald-600 text-[10px] text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-500 transition-all flex items-center space-x-1"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Versi App</span>
                </button>
              </div>
              <p className="text-emerald-100 text-sm md:text-base font-medium opacity-90">Manajemen Keuangan Transparan</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 bg-black/20 hover:bg-black/30 text-yellow-300 rounded-full border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <MoonStar className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setActiveTab('akun')}
              className="hidden md:flex items-center space-x-2 text-sm text-emerald-100 hover:text-white bg-black/20 hover:bg-black/30 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md transition-all cursor-pointer"
            >
              <User className="w-4 h-4 text-emerald-300" />
              <span>{user && !user.isAnonymous ? user.email : 'Login / Daftar'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`max-w-6xl mx-auto px-4 py-8 -mt-6 relative z-20 space-y-8 pb-32 lg:pb-8 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        
        {/* Dashboard Cards */}
        <section className={`${activeTab === 'dashboard' ? 'grid' : 'hidden'} ${activeTab === 'akun' ? 'lg:hidden' : 'lg:grid'} grid-cols-1 md:grid-cols-3 gap-6`}>
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-emerald-100 text-gray-800'} rounded-3xl shadow-lg border p-6 flex flex-col justify-between relative`}>
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="p-4 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl shadow-md text-white">
                <Wallet className="w-7 h-7" strokeWidth={2} />
              </div>
            </div>
            <div className="relative z-10">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-semibold mb-1`}>Total Saldo Kas</p>
              <h2 className={`text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{formatRupiah(saldoAwal)}</h2>
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-blue-100 text-gray-800'} rounded-3xl shadow-lg border p-6 flex flex-col justify-between relative`}>
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="p-4 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl shadow-md text-white">
                <ArrowDownToLine className="w-7 h-7" strokeWidth={2} />
              </div>
            </div>
            <div className="relative z-10">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-semibold mb-1`}>Total Pemasukan</p>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{formatRupiah(totalPemasukan)}</h2>
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-rose-100 text-gray-800'} rounded-3xl shadow-lg border p-6 flex flex-col justify-between relative`}>
            <div className="flex items-start justify-between relative z-10 mb-4">
              <div className="p-4 bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl shadow-md text-white">
                <ArrowUpFromLine className="w-7 h-7" strokeWidth={2} />
              </div>
            </div>
            <div className="relative z-10">
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} font-semibold mb-1`}>Total Pengeluaran</p>
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{formatRupiah(totalPengeluaran)}</h2>
            </div>
          </div>
        </section>

        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 ${activeTab === 'akun' ? 'hidden' : ''}`}>
          
          {/* Form Input Transaksi */}
          <section className={`lg:col-span-5 xl:col-span-4 ${activeTab === 'tambah' ? 'block' : 'hidden'} lg:block`}>
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-emerald-50 text-gray-800'} rounded-3xl shadow-xl border p-6 sm:p-8 sticky top-6`}>
              <div className="flex items-center space-x-3 mb-8">
                <div className={`p-2 ${darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'} rounded-lg`}>
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Catat Transaksi</h3>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className={`${darkMode ? 'bg-gray-900' : 'bg-gray-100'} p-1 rounded-xl flex space-x-1`}>
                  <button
                    type="button"
                    onClick={() => setType('pemasukan')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${type === 'pemasukan' ? `${darkMode ? 'bg-gray-800 text-emerald-400 ring-1 ring-emerald-700' : 'bg-white text-emerald-700 ring-1 ring-emerald-200'} shadow-sm` : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`}`}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('pengeluaran')}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${type === 'pengeluaran' ? `${darkMode ? 'bg-gray-800 text-rose-400 ring-1 ring-rose-700' : 'bg-white text-rose-600 ring-1 ring-rose-200'} shadow-sm` : `${darkMode ? 'text-gray-400' : 'text-gray-500'}`}`}
                  >
                    Pengeluaran
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Tanggal</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'} border rounded-xl outline-none`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Nominal (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Rp</span>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`w-full pl-12 pr-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'} border rounded-xl outline-none font-bold text-lg`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Keterangan</label>
                    <textarea
                      required
                      rows="3"
                      placeholder="Contoh: Kotak amal jumat..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'} border rounded-xl outline-none resize-none`}
                    ></textarea>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 py-3.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Plus className="w-5 h-5" /><span>Simpan Transaksi</span></>}
                </button>
              </form>
            </div>
          </section>

          {/* Riwayat Transaksi */}
          <section className={`lg:col-span-7 xl:col-span-8 ${activeTab === 'riwayat' ? 'block' : 'hidden'} lg:block`}>
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-emerald-50 text-gray-800'} rounded-3xl shadow-xl border p-6 sm:p-8 min-h-[600px]`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'} gap-4`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 ${darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} rounded-lg`}>
                    <History className="w-6 h-6" />
                  </div>
                  <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Riwayat Terakhir</h3>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  <button 
                    onClick={exportToCSV}
                    disabled={transactions.length === 0}
                    className={`flex items-center space-x-1.5 ${darkMode ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700'} px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50`}
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                  <button 
                    onClick={exportToWord}
                    disabled={transactions.length === 0}
                    className={`flex items-center space-x-1.5 ${darkMode ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700'} px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Word</span>
                  </button>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <History className="w-12 h-12 text-gray-500 mb-4" strokeWidth={1} />
                  <p className="text-lg font-medium">Belum ada data transaksi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((trx) => (
                    <div 
                      key={trx.id} 
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'} border rounded-2xl`}
                    >
                      <div className="flex items-start space-x-4 mb-3 sm:mb-0">
                        <div className={`p-3 rounded-xl mt-1 shrink-0 ${trx.type === 'pemasukan' ? (darkMode ? 'bg-blue-950 text-blue-400' : 'bg-blue-50 text-blue-600') : (darkMode ? 'bg-rose-950 text-rose-400' : 'bg-rose-50 text-rose-600')}`}>
                          {trx.type === 'pemasukan' ? <ArrowDownToLine className="w-5 h-5" /> : <ArrowUpFromLine className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${trx.type === 'pemasukan' ? (darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700') : (darkMode ? 'bg-rose-900 text-rose-300' : 'bg-rose-100 text-rose-700')}`}>
                              {trx.type}
                            </span>
                            <span className="text-xs font-medium text-gray-400">
                              {new Date(trx.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <h4 className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} text-base`}>{trx.description}</h4>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4">
                        <span className={`font-extrabold text-lg ${trx.type === 'pemasukan' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trx.type === 'pemasukan' ? '+' : '-'}{formatRupiah(trx.amount)}
                        </span>
                        <button
                          onClick={() => { if (window.confirm('Yakin ingin menghapus?')) handleDelete(trx.id); }}
                          className="p-2 text-gray-400 hover:text-rose-500 rounded-full"
                          title="Hapus"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Bagian Akun (Dengan Sub-Menu: Data Diri, Ubah Sandi, Notifikasi) */}
        <section className={`${activeTab === 'akun' ? 'block' : 'hidden'} max-w-lg mx-auto w-full`}>
          <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-emerald-50 text-gray-800'} rounded-3xl shadow-xl border p-6 sm:p-8`}>
            <div className="flex items-center space-x-3 mb-6">
              <div className={`p-2 ${darkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'} rounded-lg`}>
                {user && !user.isAnonymous ? <ShieldCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
              </div>
              <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {user && !user.isAnonymous ? 'Pengaturan Akun' : 'Masuk / Daftar Akun'}
              </h3>
            </div>

            {user && !user.isAnonymous ? (
              <div className="space-y-6">
                
                {/* Tab Sub-Menu Akun */}
                <div className={`flex space-x-2 p-1.5 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                  <button 
                    onClick={() => setAccountTabMode('profil')} 
                    className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-xs font-bold rounded-lg transition-all ${accountTabMode === 'profil' ? (darkMode ? 'bg-gray-800 text-emerald-400 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : 'text-gray-500'}`}
                  >
                    <UserCircle className="w-4 h-4" /> <span>Data Diri</span>
                  </button>
                  <button 
                    onClick={() => setAccountTabMode('password')} 
                    className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-xs font-bold rounded-lg transition-all ${accountTabMode === 'password' ? (darkMode ? 'bg-gray-800 text-emerald-400 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : 'text-gray-500'}`}
                  >
                    <Lock className="w-4 h-4" /> <span>Ubah Sandi</span>
                  </button>
                  <button 
                    onClick={() => setAccountTabMode('notifikasi')} 
                    className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-xs font-bold rounded-lg transition-all ${accountTabMode === 'notifikasi' ? (darkMode ? 'bg-gray-800 text-emerald-400 shadow-sm' : 'bg-white text-emerald-700 shadow-sm') : 'text-gray-500'}`}
                  >
                    <Bell className="w-4 h-4" /> <span>Notifikasi</span>
                  </button>
                </div>

                {/* 1. Sub-Menu: Data Diri */}
                {accountTabMode === 'profil' && (
                  isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className={`space-y-4 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'} p-5 rounded-2xl border`}>
                      <h4 className={`font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>Edit Data Diri</h4>
                      <div className="flex flex-col items-center mb-4">
                        <img 
                          src={editForm.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.displayName || 'User')}&background=0D8B63&color=fff&size=200`} 
                          alt="Preview" 
                          className={`w-20 h-20 rounded-full object-cover border-4 ${darkMode ? 'border-gray-800' : 'border-white'} shadow-sm bg-white mb-3`}
                        />
                        <label className={`cursor-pointer ${darkMode ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-700'} px-4 py-2 rounded-lg text-xs font-bold`}>
                          Upload Foto
                          <input type="file" accept="image/jpeg, image/png" onChange={handleImageUpload} className="hidden" />
                        </label>
                        {uploadError && <p className="text-xs text-rose-400 mt-2 font-medium">{uploadError}</p>}
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>Nama Lengkap</label>
                        <input type="text" required value={editForm.displayName} onChange={(e) => setEditForm({...editForm, displayName: e.target.value})} className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'} border rounded-lg text-sm`} />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>Nomor Telepon</label>
                        <input type="text" value={editForm.phoneNumber} onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})} className={`w-full px-3 py-2 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'} border rounded-lg text-sm`} placeholder="0812..." />
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <button type="button" onClick={() => setIsEditingProfile(false)} className={`flex-1 py-2 ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'} border font-bold rounded-lg text-sm`}>Batal</button>
                        <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm">Simpan</button>
                      </div>
                    </form>
                  ) : (
                    <div className={`flex flex-col sm:flex-row items-center sm:items-start sm:space-x-5 ${darkMode ? 'bg-emerald-950/40 border-emerald-900/50' : 'bg-emerald-50/50 border-emerald-100'} p-5 rounded-3xl border relative`}>
                      <div className="relative mb-4 sm:mb-0 z-10 shrink-0">
                        <img 
                          src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || user.displayName || 'User')}&background=0D8B63&color=fff&size=200`} 
                          alt="Profile" 
                          className={`w-24 h-24 rounded-full object-cover border-4 ${darkMode ? 'border-gray-800' : 'border-white'} shadow-md bg-white`}
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left z-10">
                        <h4 className={`text-xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>{profile?.displayName || user.displayName || 'Pengguna Baru'}</h4>
                        <div className="space-y-2 mt-3">
                          <p className={`text-sm flex items-center justify-center sm:justify-start ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className={`w-6 h-6 mr-2 ${darkMode ? 'bg-gray-800 text-emerald-400' : 'bg-white text-emerald-600'} rounded-full flex items-center justify-center shadow-sm`}><User className="w-3.5 h-3.5"/></span>
                            {user.email?.endsWith('@phone.masjid.local') ? 'Login via No. Telp' : user.email}
                          </p>
                          <p className={`text-sm flex items-center justify-center sm:justify-start ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <span className={`w-6 h-6 mr-2 ${darkMode ? 'bg-gray-800 text-emerald-400' : 'bg-white text-emerald-600'} rounded-full flex items-center justify-center shadow-sm`}><Phone className="w-3.5 h-3.5"/></span>
                            {profile?.phoneNumber || <span className="text-gray-500 italic">Belum ada no. telp</span>}
                          </p>
                        </div>
                      </div>
                      <button onClick={startEditingProfile} className={`absolute top-4 right-4 sm:static p-2.5 ${darkMode ? 'bg-gray-800 text-emerald-400' : 'bg-white text-emerald-600'} shadow-sm border rounded-full`} title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                )}

                {/* 2. Sub-Menu: Ubah Sandi */}
                {accountTabMode === 'password' && (
                  <form onSubmit={handleUpdatePassword} className={`space-y-4 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'} p-5 sm:p-6 rounded-2xl border`}>
                    <h4 className={`font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2 flex items-center space-x-2`}><Lock className="w-5 h-5 text-emerald-500"/> <span>Ganti Kata Sandi</span></h4>
                    
                    {pwdMessage.text && (
                      <div className={`p-3 text-xs font-bold rounded-lg ${pwdMessage.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {pwdMessage.text}
                      </div>
                    )}
                    
                    <div>
                      <label className={`block text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1 ml-1`}>Password Baru</label>
                      <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'} border rounded-xl text-sm`} placeholder="Minimal 6 karakter" />
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1 ml-1`}>Konfirmasi Password Baru</label>
                      <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'} border rounded-xl text-sm`} placeholder="Ulangi password baru" />
                    </div>
                    <button type="submit" className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl text-sm mt-4 shadow-lg shadow-emerald-600/20">
                      Simpan Password Baru
                    </button>
                  </form>
                )}

                {/* 3. Sub-Menu: Notifikasi */}
                {accountTabMode === 'notifikasi' && (
                  <div className={`space-y-4 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'} p-5 sm:p-6 rounded-2xl border`}>
                    <h4 className={`font-bold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-4 flex items-center space-x-2`}><Bell className="w-5 h-5 text-emerald-500"/> <span>Pengaturan Pemberitahuan</span></h4>
                    
                    <div className="space-y-3">
                      {[
                        { id: 'transaksiMasuk', label: 'Infaq & Pemasukan', desc: 'Pemberitahuan ketika ada uang masuk' },
                        { id: 'transaksiKeluar', label: 'Dana Pengeluaran', desc: 'Peringatan ketika ada dana yang digunakan' },
                        { id: 'laporanBulanan', label: 'Laporan Bulanan', desc: 'Ringkasan saldo masjid di akhir bulan' }
                      ].map(item => (
                        <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className="pr-4">
                            <p className={`text-sm font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'} mb-0.5`}>{item.label}</p>
                            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{item.desc}</p>
                          </div>
                          <button onClick={() => toggleNotif(item.id)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${notifPreferences[item.id] ? 'bg-emerald-500' : (darkMode ? 'bg-gray-700' : 'bg-gray-300')}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifPreferences[item.id] ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'} mt-4`}>
                  <button onClick={handleLogout} className="w-full py-3.5 bg-rose-950/40 text-rose-400 hover:bg-rose-900/50 font-bold rounded-xl transition-all flex items-center justify-center space-x-2">
                    <LogOut className="w-5 h-5" />
                    <span>Keluar dari Akun</span>
                  </button>
                </div>

              </div>
            ) : (
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-300 bg-yellow-950/40 border-yellow-900/50' : 'text-gray-600 bg-yellow-50 border-yellow-100'} mb-6 p-4 rounded-xl border leading-relaxed`}>
                  Anda sedang mencoba aplikasi sebagai <strong>Tamu</strong>. Buat akun agar data keuangan tersimpan permanen!
                </p>

                <div className={`${darkMode ? 'bg-gray-900' : 'bg-gray-100'} p-1 rounded-xl mb-6 flex`}>
                  <button onClick={() => { setIsLoginView(true); setAuthError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold ${isLoginView ? (darkMode ? 'bg-gray-800 text-emerald-400' : 'bg-white text-emerald-700') : 'text-gray-400'}`}>Masuk</button>
                  <button onClick={() => { setIsLoginView(false); setAuthError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold ${!isLoginView ? (darkMode ? 'bg-gray-800 text-emerald-400' : 'bg-white text-emerald-700') : 'text-gray-400'}`}>Daftar Baru</button>
                </div>

                {authError && <div className="mb-4 p-3 bg-rose-900/40 border border-rose-800 text-rose-300 text-sm font-medium rounded-lg">{authError}</div>}

                <form onSubmit={isLoginView ? handleLogin : handleRegister} className="space-y-4">
                  {!isLoginView && (
                    <div>
                      <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Nama Lengkap</label>
                      <input type="text" required value={authName} onChange={(e) => setAuthName(e.target.value)} className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'} border rounded-xl outline-none`} placeholder="Budi Santoso" />
                    </div>
                  )}
                  <div>
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Email atau No. Telepon</label>
                    <input type="text" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'} border rounded-xl outline-none`} placeholder="email@anda.com atau 0812..." />
                  </div>
                  <div>
                    <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-1.5 ml-1`}>Kata Sandi</label>
                    <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} minLength="6" className={`w-full px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'} border rounded-xl outline-none`} placeholder="Minimal 6 karakter" />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2">
                    {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <>{isLoginView ? <LogIn className="w-5 h-5" /> : <User className="w-5 h-5" />}<span>{isLoginView ? 'Masuk dengan Sandi' : 'Buat Akun'}</span></>}
                  </button>
                </form>

                <div className="relative mt-6 mb-6">
                  <div className="absolute inset-0 flex items-center"><div className={`w-full border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}></div></div>
                  <div className="relative flex justify-center text-sm"><span className={`px-4 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400'} font-medium`}>Atau</span></div>
                </div>

                <button onClick={handleGoogleLogin} disabled={authLoading} type="button" className={`w-full py-3.5 ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-700'} border-2 font-bold rounded-xl transition-all flex items-center justify-center space-x-3`}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Lanjutkan dengan Google</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-emerald-50'} border-t shadow z-50 px-6 py-2 pb-5 flex justify-between items-center rounded-t-3xl`}>
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 ${activeTab === 'dashboard' ? 'text-emerald-500' : 'text-gray-400'}`}>
          <Home className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold">Ringkasan</span>
        </button>
        <button onClick={() => setActiveTab('tambah')} className={`flex flex-col items-center p-2`}>
          <div className={`p-4 rounded-full -mt-10 shadow-xl border-4 ${darkMode ? 'border-gray-800 bg-emerald-600' : 'border-white bg-gradient-to-r from-emerald-500 to-green-500'} text-white`}>
             <PlusCircle className="w-7 h-7" />
          </div>
          <span className={`text-[10px] font-bold mt-1.5 ${activeTab === 'tambah' ? 'text-emerald-500' : 'text-gray-400'}`}>Catat</span>
        </button>
        <button onClick={() => setActiveTab('riwayat')} className={`flex flex-col items-center p-2 ${activeTab === 'riwayat' ? 'text-emerald-500' : 'text-gray-400'}`}>
          <List className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold">Riwayat</span>
        </button>
        <button onClick={() => setActiveTab('akun')} className={`flex flex-col items-center p-2 ${activeTab === 'akun' ? 'text-emerald-500' : 'text-gray-400'}`}>
          <User className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold">Akun</span>
        </button>
      </nav>

      {/* Modal Info App */}
      {showAppInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-3xl max-w-md w-full p-6 shadow-2xl border`}>
            <h3 className="text-lg font-bold mb-2">Informasi Akses Aplikasi</h3>
            <p className="text-xs text-gray-400 mb-4">Aplikasi dapat diakses via browser atau di-compile ke Google Play Store menggunakan PWA / Capacitor WebView.</p>
            <button onClick={() => setShowAppInfoModal(false)} className="w-full py-2.5 bg-gray-200 text-gray-800 font-bold rounded-xl text-sm">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
