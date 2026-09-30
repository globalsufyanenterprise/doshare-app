'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import Editor from '@monaco-editor/react';
import { Sparkles, Send, Copy, Check, FileUp, Link2, Lock, Download } from 'lucide-react';
import { decodeText, decryptBytes, deriveKey, encodeText, encryptBytes, toBuffer } from '../lib/crypto';

type Msg =
  | { type: 'code'; language: string; enc: boolean; data: ArrayBuffer | string }
  | { type: 'file-start'; id: string; name: string; size: number; mime: string; enc: boolean }
  | { type: 'chunk'; id: string; data: ArrayBuffer }
  | { type: 'file-end'; id: string };

type Incoming = { name: string; size: number; mime: string; enc: boolean; chunks: ArrayBuffer[]; got: number };
type ReceivedFile = { name: string; size: number; url: string };

const CHUNK = 16 * 1024;
const MAX_FILE = 100 * 1024 * 1024;
const LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust', 'php', 'html', 'css', 'json'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const makeCode = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const card = 'rounded-2xl border border-[#D5DBE7] bg-white p-5';
const label = 'mb-1.5 block text-sm font-medium text-[#3B4763]';
const input =
  'w-full rounded-lg border border-[#C4CCDC] bg-white px-3 py-2 text-sm outline-none focus:border-[#2F5BFF] focus:ring-2 focus:ring-[#2F5BFF]/25';
const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]';

export default function Home() {
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Starting up...');
  const [error, setError] = useState('');
  const [code, setCode] = useState('// Paste or write code here\nfunction add(a, b) {\n  return a + b;\n}');
  const [language, setLanguage] = useState('javascript');
  const [passcode, setPasscode] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [receiving, setReceiving] = useState<{ name: string; pct: number } | null>(null);
  const [inboxCode, setInboxCode] = useState<{ text: string; language: string } | null>(null);
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [copied, setCopied] = useState<string>('');

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const incomingRef = useRef<Map<string, Incoming>>(new Map());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const passRef = useRef('');
  const keyRef = useRef<{ pass: string; key: CryptoKey } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passRef.current = passcode;
  }, [passcode]);

  const getKey = useCallback(async () => {
    const p = passRef.current.trim();
    if (!p) return null;
    if (keyRef.current?.pass === p) return keyRef.current.key;
    const key = await deriveKey(p);
    keyRef.current = { pass: p, key };
    return key;
  }, []);

  const handleData = useCallback(
    async (raw: unknown) => {
      const msg = raw as Msg;
      try {
        if (msg.type === 'code') {
          let text: string;
          if (msg.enc) {
            const key = await getKey();
            if (!key) throw new Error('needs-passcode');
            text = decodeText(await decryptBytes(key, toBuffer(msg.data)));
          } else {
            text = String(msg.data);
          }
          setInboxCode({ text, language: msg.language });
          setStatus('Code received');
        } else if (msg.type === 'file-start') {
          incomingRef.current.set(msg.id, { name: msg.name, size: msg.size, mime: msg.mime, enc: msg.enc, chunks: [], got: 0 });
          setReceiving({ name: msg.name, pct: 0 });
        } else if (msg.type === 'chunk') {
          const inc = incomingRef.current.get(msg.id);
          if (!inc) return;
          let buf = toBuffer(msg.data);
          if (inc.enc) {
            const key = await getKey();
            if (!key) throw new Error('needs-passcode');
            buf = await decryptBytes(key, buf);
          }
          inc.chunks.push(buf);
          inc.got += buf.byteLength;
          setReceiving({ name: inc.name, pct: Math.round((inc.got / inc.size) * 100) });
        } else if (msg.type === 'file-end') {
          const inc = incomingRef.current.get(msg.id);
          if (!inc) return;
          const url = URL.createObjectURL(new Blob(inc.chunks, { type: inc.mime }));
          setFiles((f) => [{ name: inc.name, size: inc.size, url }, ...f]);
          incomingRef.current.delete(msg.id);
          setReceiving(null);
          setStatus(`Received ${inc.name}`);
        }
      } catch (e) {
        incomingRef.current.clear();
        setReceiving(null);
        setError(
          e instanceof Error && e.message === 'needs-passcode'
            ? 'The sender used a passcode. Enter it below, then ask them to send again.'
            : 'Could not decrypt. Check that both sides typed the same passcode.'
        );
      }
    },
    [getKey]
  );

  const setupConn = useCallback(
    (conn: DataConnection) => {
      connRef.current = conn;
      conn.on('open', () => {
        setConnected(true);
        setError('');
        setStatus(`Connected to ${conn.peer.replace('doshare-', '')}`);
      });
      conn.on('data', (d) => {
        queueRef.current = queueRef.current.then(() => handleData(d));
      });
      conn.on('close', () => {
        setConnected(false);
        setStatus('Connection closed');
      });
      conn.on('error', () => setError('Connection error. Try connecting again.'));
    },
    [handleData]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: PeerCtor } = await import('peerjs');
      if (cancelled) return;
      const peer = new PeerCtor(`doshare-${makeCode()}`);
      peerRef.current = peer;
      peer.on('open', (id) => {
        setMyId(id.replace('doshare-', ''));
        setStatus('Ready. Share your code or enter theirs.');
      });
      peer.on('connection', setupConn);
      peer.on('error', (err) => {
        setError(
          err.type === 'peer-unavailable'
            ? 'Nobody is online with that code. Check it and try again.'
            : `Connection service error: ${err.type}`
        );
      });
    })();
    return () => {
      cancelled = true;
      peerRef.current?.destroy();
    };
  }, [setupConn]);

  const connectToPeer = () => {
    const id = targetId.trim().toLowerCase();
    if (!id || !peerRef.current) return;
    setError('');
    setStatus(`Connecting to ${id}...`);
    setupConn(peerRef.current.connect(`doshare-${id}`, { reliable: true }));
  };

  const sendCode = async () => {
    const conn = connRef.current;
    if (!conn || !connected) return setError('Connect to someone first.');
    setError('');
    const key = await getKey();
    const data = key ? await encryptBytes(key, encodeText(code).buffer as ArrayBuffer) : code;
    conn.send({ type: 'code', language, enc: !!key, data } satisfies Msg);
    setStatus('Code sent directly to the other browser');
  };

  const sendFile = async (file: File) => {
    const conn = connRef.current;
    if (!conn || !connected) return setError('Connect to someone first.');
    if (file.size > MAX_FILE) return setError('That file is over 100 MB.');
    setError('');
    const key = await getKey();
    const id = crypto.randomUUID();
    conn.send({ type: 'file-start', id, name: file.name, size: file.size, mime: file.type || 'application/octet-stream', enc: !!key } satisfies Msg);
    let sent = 0;
    setProgress(0);
    try {
      while (sent < file.size) {
        const buf = await file.slice(sent, sent + CHUNK).arrayBuffer();
        const data = key ? await encryptBytes(key, buf) : buf;
        while (conn.dataChannel && conn.dataChannel.bufferedAmount > 1_000_000) await sleep(20);
        conn.send({ type: 'chunk', id, data } satisfies Msg);
        sent += buf.byteLength;
        setProgress(Math.round((sent / file.size) * 100));
      }
      conn.send({ type: 'file-end', id } satisfies Msg);
      setStatus(`Sent ${file.name}`);
    } catch {
      setError('Sending failed. Check the connection and try again.');
    } finally {
      setProgress(null);
    }
  };

  const shortenCodeWithAI = async () => {
    setIsShortening(true);
    setError('');
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI request failed');
      setCode(data.shortenedCode);
      setStatus('Code shortened');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setIsShortening(false);
    }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <main className="min-h-screen bg-[#EEF1F6] text-[#16213A]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">DoShare</h1>
            <p className="mt-1 text-[#3B4763]">Send code and PDFs straight to another browser. Nothing is uploaded.</p>
          </div>
          <div className="rounded-xl border border-[#D5DBE7] bg-white px-4 py-2">
            <div className="text-xs text-[#5A6784]">Your code</div>
            <button
              onClick={() => copy(myId, 'id')}
              disabled={!myId}
              className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-2xl font-semibold tracking-widest focus-visible:outline-2 focus-visible:outline-[#2F5BFF]"
              aria-label="Copy your code"
            >
              {myId || '......'}
              {copied === 'id' ? <Check size={18} className="text-[#12A150]" /> : <Copy size={18} className="text-[#5A6784]" />}
            </button>
          </div>
        </header>

        <div role="status" className="mb-4 flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-[#12A150]' : 'bg-[#B0B8CA]'}`} />
          {status}
        </div>
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-[#F0B4B4] bg-[#FDECEC] px-4 py-3 text-sm text-[#8A1F1F]">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={`${input} !w-auto`}
                aria-label="Language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={shortenCodeWithAI} disabled={isShortening} className={`${btn} border border-[#C4CCDC] bg-white hover:bg-[#F5F7FB]`}>
                  <Sparkles size={16} /> {isShortening ? 'Shortening...' : 'Shorten with AI'}
                </button>
                <button onClick={sendCode} disabled={!connected} className={`${btn} bg-[#2F5BFF] text-white hover:bg-[#2449D6]`}>
                  <Send size={16} /> Send code
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#D5DBE7]">
              <Editor
                height="420px"
                language={language}
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, automaticLayout: true }}
              />
            </div>
          </section>

          <div className="space-y-6">
            <section className={card}>
              <label htmlFor="target" className={label}>Connect to a friend</label>
              <div className="flex gap-2">
                <input
                  id="target"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && connectToPeer()}
                  placeholder="Their 6-character code"
                  className={`${input} font-[family-name:var(--font-mono)]`}
                />
                <button onClick={connectToPeer} disabled={!targetId.trim() || !myId} className={`${btn} bg-[#16213A] text-white hover:bg-[#25335A]`}>
                  <Link2 size={16} /> Connect
                </button>
              </div>

              <label htmlFor="pass" className={`${label} mt-5`}>
                <Lock size={14} className="mr-1 inline" /> Passcode (optional)
              </label>
              <input
                id="pass"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Same passcode on both sides"
                className={input}
              />
              <p className="mt-1.5 text-xs text-[#5A6784]">Adds a second layer of AES-256 encryption on top of WebRTC&apos;s built-in encryption.</p>
            </section>

            <section className={card}>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendFile(f);
                  e.target.value = '';
                }}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) sendFile(f);
                }}
                className="rounded-xl border-2 border-dashed border-[#C4CCDC] p-6 text-center"
              >
                <FileUp className="mx-auto mb-2 text-[#5A6784]" />
                <p className="text-sm">Drop a PDF here, or</p>
                <button onClick={() => fileInputRef.current?.click()} disabled={!connected} className={`${btn} mt-2 border border-[#C4CCDC] hover:bg-[#F5F7FB]`}>
                  Choose file
                </button>
                {!connected && <p className="mt-2 text-xs text-[#5A6784]">Connect to someone first.</p>}
              </div>
              {progress !== null && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-[#5A6784]">Sending... {progress}%</div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E3E8F1]">
                    <div className="h-full bg-[#2F5BFF] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <section className={`${card} mt-6`}>
          <h2 className="mb-3 text-lg font-semibold">Received</h2>
          {receiving && (
            <div className="mb-3 text-sm">
              Receiving {receiving.name}... {receiving.pct}%
            </div>
          )}
          {!inboxCode && files.length === 0 && !receiving && (
            <p className="text-sm text-[#5A6784]">Code and files sent to you will show up here.</p>
          )}
          {inboxCode && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-[#3B4763]">Code ({inboxCode.language})</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCode(inboxCode.text);
                      setLanguage(LANGUAGES.includes(inboxCode.language) ? inboxCode.language : 'javascript');
                    }}
                    className={`${btn} border border-[#C4CCDC] !py-1 hover:bg-[#F5F7FB]`}
                  >
                    Open in editor
                  </button>
                  <button onClick={() => copy(inboxCode.text, 'in')} className={`${btn} border border-[#C4CCDC] !py-1 hover:bg-[#F5F7FB]`}>
                    {copied === 'in' ? <Check size={14} /> : <Copy size={14} />} Copy
                  </button>
                </div>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg bg-[#16213A] p-4 font-[family-name:var(--font-mono)] text-sm text-[#E8ECF5]">
                {inboxCode.text}
              </pre>
            </div>
          )}
          {files.map((f) => (
            <div key={f.url} className="flex items-center justify-between border-t border-[#E3E8F1] py-2 text-sm">
              <span>
                {f.name} <span className="text-[#5A6784]">({fmtSize(f.size)})</span>
              </span>
              <a href={f.url} download={f.name} className={`${btn} bg-[#12A150] !py-1 text-white hover:bg-[#0E8642]`}>
                <Download size={14} /> Save
              </a>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
