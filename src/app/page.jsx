'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconUserPlus, IconUser, IconSparkles,
} from '@/components/icons';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = now - then;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function Dashboard() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobStats, setJobStats] = useState(null);

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem('gemini_api_key'));

    fetch('/api/personas')
      .then((r) => r.json())
      .then((data) => {
        setPersonas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/jobs?limit=20')
      .then((r) => r.json())
      .then((data) => {
        setJobs(data.jobs || []);
        setJobStats(data.stats || null);
      })
      .catch(() => {});
  }, []);

  const withRef = personas.filter((p) => p.hasRefImage).length;
  const withBlueprint = personas.filter((p) => p.hasBlueprint).length;
  const successRate = jobStats?.total > 0
    ? Math.round((jobStats.done / jobStats.total) * 100)
    : null;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="subtitle">Manage personas and generate AI content.</p>
        </div>
        <Link href="/personas/new" className="btn btn-primary">
          <IconUserPlus /> New persona
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Personas</div>
          <div className="stat-value">{personas.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Generations</div>
          <div className="stat-value">{jobStats?.total || 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Success rate</div>
          <div className="stat-value">
            {successRate !== null ? (
              <span style={{ color: successRate > 90 ? 'var(--success)' : successRate > 70 ? 'var(--warning)' : 'var(--danger)' }}>
                {successRate}%
              </span>
            ) : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Est. cost</div>
          <div className="stat-value">${jobStats?.totalCost?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg. time</div>
          <div className="stat-value">{jobStats?.avgDurationMs ? formatDuration(jobStats.avgDurationMs) : '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">API status</div>
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${hasApiKey ? 'badge-success' : 'badge-warning'}`}>
              <span className="dot" /> {hasApiKey ? 'Ready' : 'Not set'}
            </span>
          </div>
        </div>
      </div>

      <div className="section-label">Personas</div>

      {loading ? (
        <div className="empty">
          <div className="row" style={{ justifyContent: 'center' }}>
            <span className="spinner" /> Loading…
          </div>
        </div>
      ) : personas.length === 0 ? (
        <div className="empty">
          <IconSparkles size={28} />
          <h3>No personas yet</h3>
          <p>Create your first persona by uploading a reference photo.</p>
          <Link href="/personas/new" className="btn btn-primary">
            <IconUserPlus /> Create persona
          </Link>
        </div>
      ) : (
        <div className="personas">
          {personas.map((p) => (
            <Link key={p.name} href={`/generate/${p.name}`} className="persona">
              {p.hasRefImage ? (
                <img
                  className="persona-img"
                  src={`/api/personas/${p.name}/image`}
                  alt={p.displayName}
                  loading="lazy"
                />
              ) : (
                <div className="persona-img-empty">
                  <IconUser size={28} />
                </div>
              )}
              <div className="persona-meta">
                <div className="persona-name">{p.displayName}</div>
                <div className="persona-desc">{p.description || 'No description'}</div>
                <div className="persona-badges">
                  {p.hasRefImage && <span className="badge"><span className="dot" style={{ color: 'var(--success)' }} /> Ref</span>}
                  {p.hasBlueprint && <span className="badge"><span className="dot" style={{ color: 'var(--accent)' }} /> Blueprint</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Generations */}
      {jobs.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 32 }}>Recent Generations</div>
          <div className="jobs-grid">
            {jobs.map((job) => (
              <div key={job.id} className="card card-tight job-card">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* Thumbnail */}
                  <div className="job-thumb">
                    {job.imageUrl ? (
                      <img src={job.imageUrl} alt="" />
                    ) : (
                      <div className="job-thumb-icon">{job.output_type === 'video' ? '🎬' : '📸'}</div>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{job.persona}</span>
                      <span className={`badge badge-sm ${job.output_type === 'video' ? 'badge-accent' : ''}`}>
                        {job.output_type === 'video' ? '🎬 Video' : '📸 Image'}
                      </span>
                      <span className={`badge badge-sm ${job.status === 'done' ? 'badge-success' : job.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                        <span className="dot" /> {job.status}
                      </span>
                    </div>
                    <div className="faint" style={{ fontSize: 12, display: 'flex', gap: 12 }}>
                      <span>{formatDuration(job.duration_ms)}</span>
                      {job.cost_estimate > 0 && <span>${job.cost_estimate.toFixed(3)}</span>}
                      <span>{timeAgo(job.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx>{`
        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 8px;
        }
        .job-card {
          transition: background 0.15s;
          cursor: default;
        }
        .job-card:hover {
          background: rgba(255,255,255,0.04);
        }
        .job-thumb {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          background: rgba(255,255,255,0.04);
        }
        .job-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .job-thumb-icon {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .badge-sm {
          font-size: 10px;
          padding: 1px 6px;
        }
        .badge-accent {
          background: rgba(94,106,210,0.15);
          color: var(--accent);
        }
        .badge-danger {
          background: rgba(220,38,38,0.15);
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
