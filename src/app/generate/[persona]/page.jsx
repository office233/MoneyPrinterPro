'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft, IconUser, IconDownload, IconSparkles,
} from '@/components/icons';

const STYLES = [
  { id: 'lifestyle',        label: 'Lifestyle' },
  { id: 'urban_power',      label: 'Urban' },
  { id: 'music_life',       label: 'Music' },
  { id: 'travel',           label: 'Travel' },
  { id: 'executive',        label: 'Executive' },
  { id: 'luxury_editorial', label: 'Luxury' },
  { id: 'creative',         label: 'Creative' },
];

const SHOTS = [
  { id: '',                       label: 'Auto' },
  { id: 'three_quarter_candid',   label: '3/4 candid' },
  { id: 'full_body_walk',         label: 'Full body' },
  { id: 'portrait_close',         label: 'Close-up' },
  { id: 'portrait_three_quarter', label: 'Portrait 3/4' },
  { id: 'over_shoulder',          label: 'Over shoulder' },
];

export default function GeneratePage({ params }) {
  const { persona: personaName } = use(params);
  const [persona, setPersona] = useState(null);
  const [style, setStyle] = useState('lifestyle');
  const [location, setLocation] = useState('');
  const [shotType, setShotType] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/personas/${personaName}`)
      .then((r) => r.json())
      .then(setPersona)
      .catch(() => setPersona({ name: personaName, displayName: personaName, description: '' }));
  }, [personaName]);

  async function handleGenerate() {
    setError(null);
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('No API key set. Go to Settings to add your Gemini key.');
      return;
    }

    setGenerating(true);
    setResult(null);
    setProgress(5);
    setProgressText('Sending to Gemini…');

    let prog = 5;
    const timer = setInterval(() => {
      prog = Math.min(prog + Math.random() * 7, 92);
      setProgress(Math.round(prog));
      if (prog < 25)       setProgressText('Sending to Gemini…');
      else if (prog < 50)  setProgressText('Generating image…');
      else if (prog < 75)  setProgressText('Refining details…');
      else                 setProgressText('Finalizing…');
    }, 1500);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          persona: personaName,
          style,
          location: location || undefined,
          shotType: shotType || undefined,
          customPrompt: customPrompt || undefined,
        }),
      });
      clearTimeout(timeout);
      clearInterval(timer);
      const data = await res.json();
      if (res.ok && data.success) {
        setProgress(100);
        setProgressText(`Done in ${(data.duration_ms / 1000).toFixed(1)}s`);
        setResult(data);
        setHistory((prev) => [data, ...prev].slice(0, 12));
      } else {
        setProgress(0);
        setError(typeof data.error === 'string' ? data.error : 'Generation failed');
      }
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setError(err.name === 'AbortError' ? 'Timeout — generation took too long' : err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!persona) {
    return (
      <div className="empty">
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="spinner" /> Loading persona…
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">{persona.displayName}</h1>
          <p className="subtitle">{persona.description || 'Generate AI images for this persona.'}</p>
        </div>
        <Link href="/" className="btn btn-ghost"><IconArrowLeft /> Back</Link>
      </div>

      <div className="gen-layout">
        {/* Sidebar: reference + history */}
        <div className="gen-side">
          <div className="card card-tight">
            <div className="section-label">Reference</div>
            {persona.hasRefImage ? (
              <img
                className="ref-preview"
                src={`/api/personas/${persona.name}/image`}
                alt={persona.displayName}
              />
            ) : (
              <div className="ref-placeholder"><IconUser size={32} /></div>
            )}
            <div className="row mt-12" style={{ gap: 6, flexWrap: 'wrap' }}>
              {persona.hasRefImage  && <span className="badge"><span className="dot" style={{ color: 'var(--success)' }} /> Ref</span>}
              {persona.hasBlueprint && <span className="badge"><span className="dot" style={{ color: 'var(--accent)' }} /> Blueprint</span>}
            </div>
          </div>

          {history.length > 0 && (
            <div className="card card-tight">
              <div className="section-label">Recent ({history.length})</div>
              <div className="thumbs">
                {history.map((h, i) => (
                  <img
                    key={i}
                    src={h.imageUrl}
                    alt=""
                    className="thumb"
                    onClick={() => setResult(h)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="gen-main">
          <div className="card">
            <div className="section-label">Style</div>
            <div className="option-grid">
              {STYLES.map((s) => (
                <div
                  key={s.id}
                  className={`option${style === s.id ? ' active' : ''}`}
                  onClick={() => setStyle(s.id)}
                >
                  <div className="option-title">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-label">Shot / framing</div>
            <div className="option-grid">
              {SHOTS.map((s) => (
                <div
                  key={s.id || 'auto'}
                  className={`option${shotType === s.id ? ' active' : ''}`}
                  onClick={() => setShotType(s.id)}
                >
                  <div className="option-title">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label">Location (optional)</label>
              <input
                className="input"
                placeholder="Milan, Paris, beach, studio…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Custom prompt (optional)</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Override the auto-generated prompt…"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <><span className="spinner" /> Generating…</> : <><IconSparkles /> Generate</>}
          </button>

          {(generating || progress > 0) && (
            <div className="card card-tight">
              <div className="progress">
                <div className="progress-row">
                  <span>{progressText}</span>
                  <span className="mono">{progress}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="status-row error">
              <span className="dot" style={{ color: 'var(--danger)' }} />
              <span>{error}</span>
            </div>
          )}

          {result && result.success && (
            <div className="card">
              <div className="row-between mb-12">
                <div className="section-label" style={{ margin: 0 }}>Result</div>
                <span className="faint mono">{result.model}</span>
              </div>
              <img src={result.imageUrl} alt="Generated" className="result-image" />
              <div className="row mt-12" style={{ gap: 8 }}>
                <a href={result.imageUrl} download className="btn btn-secondary">
                  <IconDownload /> Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
