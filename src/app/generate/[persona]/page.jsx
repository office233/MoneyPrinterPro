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

const OUTPUT_TYPES = [
  { id: 'image', label: '📸 Image', desc: '~5s' },
  { id: 'video', label: '🎬 Video', desc: '~3min' },
  { id: 'both',  label: '✨ Both',  desc: '~3.5min' },
];

export default function GeneratePage({ params }) {
  const { persona: personaName } = use(params);
  const [persona, setPersona] = useState(null);
  const [outputType, setOutputType] = useState('image');
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

  async function generateImage(apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        persona: personaName,
        style,
        outputType: 'image',
        location: location || undefined,
        shotType: shotType || undefined,
        customPrompt: customPrompt || undefined,
      }),
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Image generation failed');
    return data;
  }

  async function generateVideoFromImage(apiKey, imageResult) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 360000); // 6 min timeout for video
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        persona: personaName,
        caption: location || style,
        style,
        imagePath: imageResult?.imagePath || undefined,
        promptMeta: {
          shot: shotType || 'medium shot',
          location: location || 'urban setting',
          lighting: 'natural lighting',
          motion_profile: 'subtle',
        },
      }),
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Video generation failed');
    return data;
  }

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

    const isVideo = outputType === 'video' || outputType === 'both';
    const isImage = outputType === 'image' || outputType === 'both';

    // Progress timer
    let prog = 5;
    const maxProg = isVideo ? 95 : 92;
    const interval = isVideo ? 5000 : 1500;
    const increment = isVideo ? 3 : 7;

    setProgressText(isVideo ? 'Preparing video generation…' : 'Sending to Gemini…');

    const timer = setInterval(() => {
      prog = Math.min(prog + Math.random() * increment, maxProg);
      setProgress(Math.round(prog));

      if (isVideo) {
        if (prog < 15)      setProgressText('Sending to Gemini…');
        else if (prog < 30) setProgressText(isImage ? 'Generating image…' : 'Preparing for VEO…');
        else if (prog < 50) setProgressText('Generating video with VEO…');
        else if (prog < 70) setProgressText('Still rendering… (this can take 2-5 min)');
        else if (prog < 85) setProgressText('Almost there…');
        else                setProgressText('Finalizing video…');
      } else {
        if (prog < 25)      setProgressText('Sending to Gemini…');
        else if (prog < 50) setProgressText('Generating image…');
        else if (prog < 75) setProgressText('Refining details…');
        else                setProgressText('Finalizing…');
      }
    }, interval);

    try {
      let imageData = null;
      let videoData = null;

      // Generate image (for 'image' or 'both')
      if (isImage) {
        imageData = await generateImage(apiKey);
      }

      // Generate video (for 'video' or 'both')
      if (isVideo) {
        videoData = await generateVideoFromImage(apiKey, imageData);
      }

      clearInterval(timer);

      // Build result object
      const finalResult = {
        success: true,
        outputType,
        ...(imageData ? { imageUrl: imageData.imageUrl, model: imageData.model } : {}),
        ...(videoData ? { videoUrl: videoData.videoUrl, videoModel: 'veo-3.1' } : {}),
        duration_ms: (imageData?.duration_ms || 0) + (videoData?.duration_ms || 0),
        model: videoData ? 'veo-3.1' : (imageData?.model || 'gemini'),
        usedEngines: imageData?.usedEngines || false,
      };

      setProgress(100);
      setProgressText(`Done in ${(finalResult.duration_ms / 1000).toFixed(1)}s`);
      setResult(finalResult);
      setHistory((prev) => [finalResult, ...prev].slice(0, 12));
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

  const resultIsVideo = result?.videoUrl && !result?.imageUrl;
  const resultHasVideo = !!result?.videoUrl;
  const resultHasImage = !!result?.imageUrl;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="h1">{persona.displayName}</h1>
          <p className="subtitle">{persona.description || 'Generate AI images & videos for this persona.'}</p>
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
                  <div key={i} className="thumb-wrap" onClick={() => setResult(h)}>
                    {h.imageUrl ? (
                      <img src={h.imageUrl} alt="" className="thumb" />
                    ) : (
                      <div className="thumb thumb-video">🎬</div>
                    )}
                    {h.videoUrl && h.imageUrl && (
                      <div className="thumb-badge">🎬</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="gen-main">
          {/* Output Type Selector */}
          <div className="card">
            <div className="section-label">Output Type</div>
            <div className="option-grid">
              {OUTPUT_TYPES.map((t) => (
                <div
                  key={t.id}
                  className={`option${outputType === t.id ? ' active' : ''}`}
                  onClick={() => setOutputType(t.id)}
                >
                  <div className="option-title">{t.label}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

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
            {generating ? <><span className="spinner" /> Generating…</> : <><IconSparkles /> Generate {outputType === 'video' ? 'Video' : outputType === 'both' ? 'Image + Video' : 'Image'}</>}
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
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {result.usedEngines && <span className="badge" style={{ background: 'rgba(94,106,210,0.2)', color: 'var(--accent)' }}>⚡ Engines</span>}
                  <span className="faint mono">{result.model}</span>
                </div>
              </div>

              {/* Image result */}
              {resultHasImage && (
                <img src={result.imageUrl} alt="Generated" className="result-image" />
              )}

              {/* Video result */}
              {resultHasVideo && (
                <video
                  src={result.videoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="result-image"
                  style={{ marginTop: resultHasImage ? 12 : 0 }}
                />
              )}

              <div className="row mt-12" style={{ gap: 8 }}>
                {resultHasImage && (
                  <a href={result.imageUrl} download className="btn btn-secondary">
                    <IconDownload /> Image
                  </a>
                )}
                {resultHasVideo && (
                  <a href={result.videoUrl} download className="btn btn-secondary">
                    <IconDownload /> Video
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .thumb-wrap {
          position: relative;
          cursor: pointer;
        }
        .thumb-badge {
          position: absolute;
          bottom: 2px;
          right: 2px;
          font-size: 10px;
          background: rgba(0,0,0,0.7);
          border-radius: 4px;
          padding: 1px 3px;
          line-height: 1;
        }
        .thumb-video {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(94,106,210,0.15);
          font-size: 18px;
        }
      `}</style>
    </div>
  );
}
