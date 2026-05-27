'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  IconEye, IconEyeOff, IconCheck, IconExternal, IconKey,
} from '@/components/icons';

const SETUP_STEPS = [
  { num: 1, title: 'Open Google AI Studio', desc: 'Sign in with your Google account at aistudio.google.com.' },
  { num: 2, title: 'Create an API key', desc: 'Click "Get API key" → "Create API key" and select a project.' },
  { num: 3, title: 'Paste it here', desc: 'Your key is stored only in this browser. The server never persists it.' },
  { num: 4, title: 'Test the connection', desc: 'Verify the key works before generating. You will see a green indicator.' },
];

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('gemini_api_key');
    if (stored) {
      setApiKey(stored);
      setStatus('connected');
      setStatusMessage('Loaded from browser storage');
    }
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      localStorage.removeItem('gemini_api_key');
      setStatus('idle');
      setStatusMessage('');
    } else {
      localStorage.setItem('gemini_api_key', trimmed);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [apiKey]);

  const handleTest = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setStatus('error');
      setStatusMessage('Enter an API key first');
      return;
    }
    setStatus('testing');
    setStatusMessage('Verifying…');
    try {
      const res = await fetch('/api/test-key', { method: 'POST', headers: { 'x-api-key': trimmed } });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('gemini_api_key', trimmed);
        setStatus('connected');
        setStatusMessage('Connected — your key is valid');
      } else {
        setStatus('error');
        setStatusMessage(data.error || 'Invalid API key');
      }
    } catch {
      setStatus('error');
      setStatusMessage('Network error — could not reach the server');
    }
  }, [apiKey]);

  const handleClear = useCallback(() => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
    setStatus('idle');
    setStatusMessage('');
  }, []);

  const statusBadge = {
    idle:      { cls: '',              label: 'Not configured' },
    testing:   { cls: 'badge-warning', label: 'Testing' },
    connected: { cls: 'badge-success', label: 'Connected' },
    error:     { cls: 'badge-danger',  label: 'Error' },
  }[status];

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">Settings</h1>
          <p className="subtitle">Configure your Gemini API key. It lives only in your browser.</p>
        </div>
        <span className={`badge ${statusBadge.cls}`}>
          <span className="dot" /> {statusBadge.label}
        </span>
      </div>

      <div className="grid-2">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="row-between mb-12">
              <div className="row" style={{ gap: 8 }}>
                <IconKey /> <strong style={{ fontSize: 13.5 }}>Gemini API key</strong>
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ padding: '4px 8px' }}
              >
                Get a key <IconExternal size={12} />
              </a>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">API key</label>
              <div className="input-wrap">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="input input-mono"
                  placeholder="AIza…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  className="input-suffix"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Hide' : 'Show'}
                >
                  {showKey ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {(status !== 'idle' || statusMessage) && (
              <div className={`status-row ${status === 'connected' ? 'success' : status === 'error' ? 'error' : ''}`}>
                {status === 'testing' ? <span className="spinner" /> : <span className="dot" style={{ color: status === 'connected' ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--fg-faint)' }} />}
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="row mt-16" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleTest}
                disabled={status === 'testing' || !apiKey.trim()}
              >
                {status === 'testing' ? <><span className="spinner" /> Testing…</> : 'Test connection'}
              </button>
              <button className="btn btn-secondary" onClick={handleSave}>
                {saved ? <><IconCheck /> Saved</> : 'Save'}
              </button>
              {apiKey && (
                <button className="btn btn-danger" onClick={handleClear}>Clear</button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="section-label">Privacy</div>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Your API key is stored exclusively in your browser&apos;s <code>localStorage</code>.
              It is sent to the local backend via the <code>x-api-key</code> header only when
              you click <strong style={{ color: 'var(--fg)' }}>Test connection</strong> or
              generate an image. The server never logs, persists, or shares it.
            </p>
            <p className="muted mt-12" style={{ fontSize: 13, lineHeight: 1.6 }}>
              You pay Google directly for each generation. There is no middleman, no markup.
            </p>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="section-label">Get started</div>
            <div className="steps">
              {SETUP_STEPS.map((step) => (
                <div key={step.num} className="step">
                  <div className="step-num">{step.num}</div>
                  <div>
                    <div className="step-title">{step.title}</div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-label">Pricing (paid to Google)</div>
            <table className="pricing">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Per image</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Gemini 2.5 Flash Image · 512px</td>  <td className="price">$0.045</td></tr>
                <tr><td>Gemini 2.5 Flash Image · 1024px</td> <td className="price">$0.067</td></tr>
                <tr><td>Gemini 2.5 Flash Image · 2048px</td> <td className="price">$0.101</td></tr>
              </tbody>
            </table>
            <p className="faint mt-12" style={{ fontSize: 12 }}>
              Prices may change. Always check Google&apos;s official pricing page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
