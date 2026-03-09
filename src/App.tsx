import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { INITIAL_TIERS } from './constants';
import { Tier, Player, Region } from './types';
import { Trophy, Search, Filter, Download, X, Globe, Plus, Trash2, Settings, Lock, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [tiers, setTiers] = useState<Tier[]>(INITIAL_TIERS);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRankings = async () => {
    try {
      const response = await fetch('/api/rankings');
      const data = await response.json();
      setPlayers(data.players);
      setTiers(prev => prev.map(tier => ({
        ...tier,
        playerIds: data.assignments
          .filter((a: any) => a.tierId === tier.id)
          .map((a: any) => a.playerId)
      })));
    } catch (error) {
      console.error("Failed to fetch rankings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<LeaderboardView players={players} tiers={tiers} onUpdate={fetchRankings} />} />
      <Route path="/admin" element={<AdminRoute players={players} tiers={tiers} onUpdate={fetchRankings} />} />
    </Routes>
  );
}

function AdminRoute({ players, tiers, onUpdate }: { players: Player[], tiers: Tier[], onUpdate: () => void }) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('adminToken');
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/[0.02] border border-white/10 p-8"
        >
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center rounded-full">
              <Lock className="text-white/40" size={20} />
            </div>
          </div>
          <h2 className="text-center text-lg font-mono font-black uppercase tracking-widest mb-8">Admin Access</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-bold text-white/20 uppercase">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-white/10 p-4 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                placeholder="••••••••"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-[10px] font-mono uppercase text-center">{error}</p>}
            <button 
              disabled={isSubmitting}
              className="w-full bg-white text-black font-mono font-black text-xs uppercase py-4 hover:bg-white/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'VERIFYING...' : 'AUTHENTICATE'}
            </button>
            <Link to="/" className="block text-center text-[10px] font-mono text-white/20 hover:text-white transition-colors uppercase">Return to Leaderboard</Link>
          </form>
        </motion.div>
      </div>
    );
  }

  return <LeaderboardView players={players} tiers={tiers} onUpdate={onUpdate} isAdmin={true} token={token} onLogout={handleLogout} />;
}

function LeaderboardView({ 
  players, 
  tiers, 
  onUpdate, 
  isAdmin = false, 
  token = '', 
  onLogout 
}: { 
  players: Player[], 
  tiers: Tier[], 
  onUpdate: () => void,
  isAdmin?: boolean,
  token?: string,
  onLogout?: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | 'ALL'>('ALL');
  const [isManageOpen, setIsManageOpen] = useState(false);

  // Form state
  const [newUsername, setNewUsername] = useState('');
  const [newRegion, setNewRegion] = useState<Region>('NA');
  const [newTierId, setNewTierId] = useState('S+');
  const [isAdding, setIsAdding] = useState(false);

  const regions: (Region | 'ALL')[] = ['ALL', 'OCE', 'NA', 'SA', 'AS', 'EU'];

  const exportRankings = () => {
    const data = JSON.stringify(tiers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'player-rankings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername) return;
    setIsAdding(true);
    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': token
        },
        body: JSON.stringify({
          username: newUsername,
          region: newRegion,
          tierId: newTierId
        })
      });
      if (response.ok) {
        onUpdate();
        setNewUsername('');
      }
    } catch (error) {
      console.error("Failed to add player:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this player?")) return;
    try {
      const response = await fetch(`/api/players/${id}`, { 
        method: 'DELETE',
        headers: { 'X-Admin-Token': token }
      });
      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error("Failed to delete player:", error);
    }
  };

  const filteredTiers = useMemo(() => {
    return tiers.map(tier => {
      const tierPlayers = tier.playerIds
        .map(id => players.find(p => p.id === id)!)
        .filter(p => {
          if (!p) return false;
          const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesRegion = selectedRegion === 'ALL' || p.region === selectedRegion;
          return matchesSearch && matchesRegion;
        });
      return { ...tier, filteredPlayers: tierPlayers };
    });
  }, [tiers, players, searchQuery, selectedRegion]);

  return (
    <div className="min-h-screen bg-bg selection:bg-white/20">
      {/* Header */}
      <header className="border-b border-border py-4 px-4 md:px-8 bg-bg sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="text-white w-5 h-5" />
            <h1 className="text-lg font-mono font-black uppercase tracking-tighter">
              Global Player <span className="text-white/30 ml-2">Rankings</span>
              {isAdmin && <span className="ml-4 px-2 py-0.5 bg-white text-black text-[10px] font-black tracking-widest">ADMIN</span>}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setIsManageOpen(!isManageOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase transition-all border ${
                    isManageOpen ? 'bg-white text-black border-white' : 'bg-black text-white/60 border-white/10 hover:text-white hover:border-white/40'
                  }`}
                >
                  <Plus size={12} />
                  Manage
                </button>
                <button 
                  onClick={onLogout}
                  className="p-1.5 bg-white/5 text-white/40 border border-white/10 hover:text-white hover:border-white/40 transition-all"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
            <button 
              onClick={exportRankings}
              className="px-3 py-1.5 bg-white/5 text-white/40 border border-white/10 hover:text-white hover:border-white/40 text-[10px] font-mono font-bold uppercase transition-all"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-12">
        {/* Management Panel (Admin Only) */}
        <AnimatePresence>
          {isAdmin && isManageOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-12 max-w-5xl mx-auto"
            >
              <div className="bg-white/[0.02] border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-white/60">Player Management</h3>
                  <button onClick={() => setIsManageOpen(false)} className="text-white/20 hover:text-white"><X size={16} /></button>
                </div>

                <form onSubmit={handleAddPlayer} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-mono font-bold text-white/20 uppercase">Roblox Username</label>
                    <input 
                      type="text" 
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="ENTER NAME..."
                      className="w-full bg-black border border-white/10 p-3 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-mono font-bold text-white/20 uppercase">Region</label>
                    <select 
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value as Region)}
                      className="w-full bg-black border border-white/10 p-3 text-xs font-mono text-white focus:outline-none focus:border-white/40 appearance-none"
                    >
                      {['OCE', 'NA', 'SA', 'AS', 'EU'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-mono font-bold text-white/20 uppercase">Rank</label>
                    <select 
                      value={newTierId}
                      onChange={(e) => setNewTierId(e.target.value)}
                      className="w-full bg-black border border-white/10 p-3 text-xs font-mono text-white focus:outline-none focus:border-white/40 appearance-none"
                    >
                      {tiers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      disabled={isAdding}
                      className="w-full bg-white text-black font-mono font-black text-[10px] uppercase py-3 hover:bg-white/90 transition-all disabled:opacity-50"
                    >
                      {isAdding ? 'PROCESSING...' : 'ADD PLAYER'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="mb-12 flex flex-col md:flex-row gap-4 max-w-5xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input
              type="text"
              placeholder="SEARCH PLAYERS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black border border-border rounded-none py-3 pl-10 pr-4 text-xs font-mono focus:outline-none focus:border-white/40 transition-all"
            />
          </div>

          <div className="flex gap-px bg-border border border-border">
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-4 py-3 text-[10px] font-mono font-bold uppercase transition-all ${
                  selectedRegion === region ? 'bg-white text-black' : 'bg-black text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Rankings Grid */}
        <div className="pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1 bg-border border border-border shadow-2xl">
            {filteredTiers.map((tier) => (
              <div key={tier.id} className="flex flex-col bg-black min-w-0">
                {/* Tier Header */}
                <div 
                  className="h-12 flex items-center justify-center text-xl font-mono font-black text-black shrink-0 select-none"
                  style={{ backgroundColor: tier.color }}
                >
                  {tier.label}
                </div>
                
                {/* Players List */}
                <div className="h-[600px] overflow-y-auto custom-scrollbar p-1 space-y-1 bg-black/40">
                  {tier.filteredPlayers.length > 0 ? (
                    tier.filteredPlayers.map((player) => (
                      <div 
                        key={player.id} 
                        className="bg-white/[0.02] border border-white/5 p-1.5 hover:bg-white/[0.05] transition-all group relative flex items-center gap-2"
                      >
                        {/* Avatar Space */}
                        <div className="w-8 h-8 bg-white/5 border border-white/10 shrink-0 overflow-hidden">
                          {player.avatarUrl ? (
                            <img 
                              src={player.avatarUrl} 
                              alt={player.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Globe size={10} className="text-white/10" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-white/90 group-hover:text-white transition-colors truncate">
                              {player.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {isAdmin && (
                                <button 
                                  onClick={() => handleDeletePlayer(player.id)}
                                  className="p-1 text-white/20 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                              <span className="px-1 py-0.5 bg-white/5 border border-white/10 text-[6px] font-mono font-bold text-white/40 uppercase tracking-tighter rounded shrink-0">
                                {player.region}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center p-4 text-center">
                      <span className="text-[8px] font-mono text-white/5 uppercase tracking-[0.2em] leading-relaxed">
                        EMPTY
                      </span>
                    </div>
                  )}
                </div>

                {/* Tier Footer Stats */}
                <div className="p-1.5 border-t border-border bg-white/[0.01]">
                  <p className="text-[7px] font-mono text-white/10 uppercase text-center font-bold tracking-widest">
                    {tier.filteredPlayers.length} PLRS
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-border pt-12 max-w-5xl mx-auto">
          <div>
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-white/30 mb-4">Regional Codes</h4>
            <div className="space-y-2">
              {[
                { code: 'OCE', name: 'Oceania' },
                { code: 'NA', name: 'North America' },
                { code: 'SA', name: 'South America' },
                { code: 'AS', name: 'Asia' },
                { code: 'EU', name: 'Europe' }
              ].map(r => (
                <div key={r.code} className="flex items-center gap-3">
                  <span className="w-10 text-[10px] font-mono font-bold text-white/60">{r.code}</span>
                  <span className="text-[10px] font-mono text-white/20 uppercase">{r.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-white/30 mb-4">About Rankings</h4>
            <p className="text-xs text-white/40 leading-relaxed font-mono uppercase">
              Rankings are updated weekly based on tournament performance, regional dominance, and individual skill metrics. 
              S+ represents the absolute peak of global competition.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/5 py-10 px-4 text-center">
        <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-mono font-bold">
          Global Competitive Player Database • 2026
        </p>
      </footer>
    </div>
  );
}
