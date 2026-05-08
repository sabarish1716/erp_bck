import { EndpointAction } from '@/types/hr';
import { useMemo, useState } from 'react';

type Props = {
  action: EndpointAction;
  onRun: (args: { action: EndpointAction; pathParams: Record<string, string>; query: Record<string, string>; body?: unknown }) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
};

function methodClass(method: EndpointAction['method']): string {
  if (method === 'GET') return 'bg-sky-100 text-sky-900';
  if (method === 'POST') return 'bg-emerald-100 text-emerald-900';
  if (method === 'PUT') return 'bg-amber-100 text-amber-900';
  return 'bg-rose-100 text-rose-900';
}

export function ActionCard({ action, onRun, disabled = false, disabledReason }: Props) {
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState(action.body ? JSON.stringify(action.body, null, 2) : '');
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState('');

  const hasBody = useMemo(() => Boolean(action.body), [action.body]);

  async function run() {
    if (disabled) return;
    setBusy(true);
    try {
      let body: unknown = undefined;
      if (hasBody) {
        body = bodyText.trim() ? JSON.parse(bodyText) : {};
      }
      await onRun({ action, pathParams, query, body });
      setLastRun(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-line/60 bg-panel p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold text-primary">{action.title}</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${methodClass(action.method)}`}>{action.method}</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">{action.path}</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(action.params ?? []).map((param) => (
          <label key={`path-${param}`} className="block">
            <span className="text-[11px] font-semibold text-slate-500">Path: {param}</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-xs"
              value={pathParams[param] ?? ''}
              onChange={(e) => setPathParams((prev) => ({ ...prev, [param]: e.target.value }))}
              placeholder={param}
            />
          </label>
        ))}

        {(action.query ?? []).map((param) => (
          <label key={`query-${param}`} className="block">
            <span className="text-[11px] font-semibold text-slate-500">Query: {param}</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-xs"
              value={query[param] ?? ''}
              onChange={(e) => setQuery((prev) => ({ ...prev, [param]: e.target.value }))}
              placeholder={param}
            />
          </label>
        ))}
      </div>

      {hasBody && (
        <div className="mt-3">
          <label className="text-[11px] font-semibold text-slate-500">Request Body (JSON)</label>
          <textarea
            className="mt-1 min-h-32 w-full rounded-lg border border-line bg-white p-2 text-xs"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          disabled={busy || disabled}
          onClick={run}
        >
          {busy ? 'Running...' : disabled ? 'Blocked' : 'Run'}
        </button>
        <span className="text-[11px] text-slate-500">
          {disabled ? disabledReason ?? 'Missing permission' : lastRun ? `Last run: ${lastRun}` : ''}
        </span>
      </div>
    </article>
  );
}
