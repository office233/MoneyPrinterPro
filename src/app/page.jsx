'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconUserPlus, IconUser, IconSparkles,
} from '@/components/icons';

export default function Dashboard() {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem('gemini_api_key'));
    fetch('/api/personas')
      .then((r) => r.json())
      .then((data) => {
        setPersonas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const withRef = personas.filter((p) => p.hasRefImage).length;
  const withBlueprint = personas.filter((p) => p.hasBlueprint).length;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="subtitle">Manage personas and generate AI images.</p>
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
          <div className="stat-label">With reference</div>
          <div className="stat-value">{withRef}</div>
        </div>
        <div className="stat">
          <div className="stat-label">With blueprint</div>
          <div className="stat-value">{withBlueprint}</div>
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
    </div>
  );
}
