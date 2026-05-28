'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconSparkles } from '@/components/icons';

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr + 'Z').getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AutopilotPage() {
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState('');
  const [outputType, setOutputType] = useState('image');
  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [queue, setQueue] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [personaStats, setPersonaStats] = useState([]);
  const [scoringAvailable, setScoringAvailable] = useState(null);

  useEffect(() => {
    // Load personas
    fetch('/api/personas')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setPersonas(list);
        if (list.length > 0) setSelectedPersona(list[0].name);
      })
      .catch(() => {});

    // Load autopilot data
    fetch('/api/autopilot')
      .then(r => r.json())
      .then(data => {
        setQueue(data.queue || []);
        setTodayStats(data.todayStats || null);
        setPersonaStats(data.personaStats || []);
      })
      .catch(() => {});

    // Check scoring service
    fetch('/api/score')
      .then(r => r.json())
      .then(data => setScoringAvailable(data.available))
      .catch(() => setScoringAvailable(false));
  }, []);

  async function handleRun() {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert('No API key set. Go to Settings first.');
      return;
    }
    if (!selectedPersona) {
      alert('Select a persona first.');
      return;
    }

    setRunning(true);
    setResults(null);
    setProgress(`Running autopilot: ${count} ${outputType}(s) for ${selectedPersona}...`);

    try {
      const res = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ persona: selectedPersona, outputType, count }),
      });
      const data = await res.json();
      setResults(data);
      setProgress(`Done! ${data.succeeded}/${data.completed} succeeded in ${formatDuration(data.duration_ms)}`);

      // Refresh queue
      const qRes = await fetch('/api/autopilot');
      const qData = await qRes.json();
      setQueue(qData.queue || []);
      setTodayStats(qData.todayStats || null);
    } catch (err) {
      setProgress(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">🚀 Autopilot</h1>
          <p className="subtitle">Batch generate content automatically.</p>
        </div>
        <Link href="/" className="btn btn-ghost"><IconArrowLeft /> Back</Link>
      </div>

      {/* Today's Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Today</div>
          <div className="stat-value">{todayStats?.total || 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Images</div>
          <div className="stat-value">{todayStats?.images || 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Videos</div>
          <div className="stat-value">{todayStats?.videos || 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Cost today</div>
          <div className="stat-value">${todayStats?.cost?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Scoring</div>
          <div className="stat-value">
            <span className={`badge ${scoringAvailable ? 'badge-success' : 'badge-warning'}`}>
              <span className="dot" /> {scoringAvailable ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="section-label">Generate Batch</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12, alignItems: 'end' }}>
          <div className="field">
            <label className="label">Persona</label>
            <select className="input" value={selectedPersona} onChange={e => setSelectedPersona(e.target.value)}>
              {personas.map(p => (
                <option key={p.name} value={p.name}>{p.displayName}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Type</label>
            <select className="input" value={outputType} onChange={e => setOutputType(e.target.value)}>
              <option value="image">📸 Images</option>
              <option value="video">🎬 Videos</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Count</label>
            <input className="input" type="number" min={1} max={10} value={count} onChange={e => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))} />
          </div>
        </div>
        <button
          className="btn btn-primary btn-lg btn-block"
          style={{ marginTop: 16 }}
          onClick={handleRun}
          disabled={running || !selectedPersona}
        >
          {running ? <><span className="spinner" /> Running...</> : <><IconSparkles /> Run Autopilot</>}
        </button>
      </div>

      {/* Progress */}
      {progress && (
        <div className="card card-tight">
          <div style={{ color: 'var(--fg)', fontSize: 14 }}>{progress}</div>
        </div>
      )}

      {/* Results */}
      {results && results.results && (
        <div className="card">
          <div className="section-label">Results</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {results.results.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ width: 24, textAlign: 'center', color: 'var(--faint)' }}>#{r.index}</span>
                {r.success ? (
                  <>
                    {r.imageUrl && <img src={r.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />}
                    <span className="badge badge-success" style={{ fontSize: 10 }}><span className="dot" /> Done</span>
                    {r.duration_ms && <span className="faint" style={{ fontSize: 12 }}>{formatDuration(r.duration_ms)}</span>}
                  </>
                ) : (
                  <>
                    <span className="badge" style={{ fontSize: 10, background: 'rgba(220,38,38,0.15)', color: 'var(--danger)' }}><span className="dot" /> Failed</span>
                    <span className="faint" style={{ fontSize: 12 }}>{r.error}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Persona Stats */}
      {personaStats.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Persona Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {personaStats.map(p => (
              <div key={p.persona} className="card card-tight">
                <div style={{ fontWeight: 500, color: 'var(--fg)', marginBottom: 4 }}>{p.persona}</div>
                <div className="faint" style={{ fontSize: 12 }}>
                  {p.total} generated · {p.done} done · {timeAgo(p.last_generated)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent Queue */}
      {queue.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Recent Queue (7 days)</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {queue.slice(0, 20).map(job => (
              <div key={job.id} className="card card-tight" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
                  {job.imageUrl ? (
                    <img src={job.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {job.output_type === 'video' ? '🎬' : '📸'}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{job.persona}</span>
                  <span className={`badge`} style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px',
                    background: job.status === 'done' ? 'rgba(34,197,94,0.15)' : job.status === 'failed' ? 'rgba(220,38,38,0.15)' : 'rgba(234,179,8,0.15)',
                    color: job.status === 'done' ? 'var(--success)' : job.status === 'failed' ? 'var(--danger)' : 'var(--warning)'
                  }}>
                    {job.status}
                  </span>
                </div>
                <span className="faint" style={{ fontSize: 11 }}>{formatDuration(job.duration_ms)}</span>
                <span className="faint" style={{ fontSize: 11 }}>{timeAgo(job.created_at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
