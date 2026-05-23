import { useEffect, useState } from 'react';
import {
  fetchMe,
  fetchNotifications,
  fetchRaces,
  fetchTournaments,
  fetchMyPredictions,
  login,
  publishResult,
  setToken,
  type AuthUser,
} from './api/client';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('admin@demo.local');
  const [password, setPassword] = useState('Demo@123');
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetchMe()
      .then(async (u) => {
        setUser(u);
        await loadDashboard(u);
      })
      .catch(() => setToken(null));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { user: u } = await login(email, password);
      setUser(u);
      await loadDashboard(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function loadDashboard(u: AuthUser) {
    const data: Record<string, unknown> = {};
    data.tournaments = await fetchTournaments();
    data.races = await fetchRaces();
    data.notifications = await fetchNotifications();
    if (u.role === 'spectator') {
      data.predictions = await fetchMyPredictions();
    }
    setDashboard(data);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setDashboard({});
  }

  async function handlePublish() {
    const races = dashboard.races as { _id?: string; id?: string; name: string; status: string }[];
    const race = races?.[0];
    const raceId = race?._id ?? race?.id;
    if (!raceId) return;
    try {
      await publishResult(String(raceId));
      alert('Đã publish kết quả + chấm dự đoán');
      if (user) await loadDashboard(user);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  if (!user) {
    return (
      <main style={{ maxWidth: 400, margin: '2rem auto', fontFamily: 'system-ui' }}>
        <h1>Horse Racing</h1>
        <p>
          Đăng nhập demo — mật khẩu <code>Demo@123</code>
        </p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 8 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
          <button type="submit" style={{ padding: '8px 16px' }}>
            Login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Horse Racing</h1>
          <p>
            {user.fullName} — <strong>{user.role}</strong>
          </p>
        </div>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>

      {user.role === 'admin' && (
        <section style={{ marginTop: 16 }}>
          <button type="button" onClick={handlePublish}>
            Publish kết quả race đầu tiên (demo)
          </button>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Dashboard</h2>
        <pre
          style={{
            background: '#f4f4f4',
            padding: 12,
            overflow: 'auto',
            maxHeight: 480,
            fontSize: 12,
          }}
        >
          {JSON.stringify(dashboard, null, 2)}
        </pre>
      </section>
    </main>
  );
}
