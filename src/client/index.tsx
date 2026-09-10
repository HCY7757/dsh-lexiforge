import { useEffect, useState, type CSSProperties } from 'react';
import type { PackState, InstalledPack } from '../types.js';
import type { MarketPack } from '../services/market.js';

async function api<T>(body: object): Promise<T> {
  const response = await fetch('/lexiforge/api', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LexiForge': '1' }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string; value: T };
  if (!response.ok || result.error) throw new Error(result.error ?? `HTTP ${response.status}`);
  return result.value;
}

const tokens = {
  bgBase: 'var(--dsw-alias-bg-base)',
  layer1: 'var(--dsw-alias-bg-layer-1)',
  layer2: 'var(--dsw-alias-bg-layer-2)',
  border1: 'var(--dsw-alias-border-l1)',
  border2: 'var(--dsw-alias-border-l2)',
  label: 'var(--dsw-alias-label-primary)',
  label2: 'var(--dsw-alias-label-secondary)',
  caption: 'var(--dsw-alias-label-caption)',
  brand: 'var(--dsw-alias-brand-primary)',
  buttonPrimary: 'var(--dsw-alias-button-primary-fill)',
  buttonPrimaryHover: 'var(--dsw-alias-button-primary-hover)',
  ghost: 'var(--dsw-alias-button-ghost-active-fill)',
  ghostBorder: 'var(--dsw-alias-button-ghost-active-border)',
  hover: 'var(--dsw-alias-interactive-bg-hover)',
  danger: 'var(--dsw-alias-state-error-primary)',
  success: 'var(--dsw-alias-state-success-primary)',
  warn: 'var(--dsw-alias-state-warn-primary)',
};

const btn = (primary = false, danger = false): CSSProperties => ({
  borderRadius: 999,
  padding: '5px 14px',
  fontSize: 13,
  border: `1px solid ${danger ? tokens.danger : primary ? 'transparent' : tokens.border2}`,
  cursor: 'pointer',
  background: danger ? 'transparent' : primary ? tokens.buttonPrimary : tokens.ghost,
  color: danger ? tokens.danger : primary ? 'var(--dsw-alias-label-primary-inverted)' : tokens.label,
});
const input: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: `1px solid ${tokens.border2}`,
  background: tokens.bgBase,
  color: tokens.label,
  fontSize: 14,
  outline: 'none',
};
const card: React.CSSProperties = {
  border: `1px solid ${tokens.border1}`,
  borderRadius: 12,
  background: tokens.layer1,
  padding: '14px 16px',
  marginBottom: 10,
};

const MODE_HINT: Record<string, string> = { A: 'LLM 改写', B: '术语库检索', C: '本地规则', composite: '' };
const modeBadge = (mode: string): string => (mode === 'composite' ? '复合模式' : mode);
type UiState = { enabled: boolean; packs: InstalledPack[]; timeoutMs: number; debugEnabled: boolean; debugLogFile: string | null; disclaimer: { version: number; at: number } | null; disclaimerVersion: number };
type DisclaimerDoc = { version: number; sections: { title: string; body: string }[] };
type RepoPackRow = { id: string; name: string; version: string; author?: string; description?: string; mode?: string; file: string };

export function SettingsPanel() {
  const [state, setState] = useState<UiState>({ enabled: false, packs: [], timeoutMs: 500, debugEnabled: false, debugLogFile: null, disclaimer: null, disclaimerVersion: 1 });
  const [timeoutInput, setTimeoutInput] = useState('0.5');
  const [items, setItems] = useState<MarketPack[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [query, setQuery] = useState('');
  const [repo, setRepo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<string>();
  const [doc, setDoc] = useState<DisclaimerDoc | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docAgreed, setDocAgreed] = useState(false);
  const [pendingInstall, setPendingInstall] = useState<string | null>(null);
  const [pendingPack, setPendingPack] = useState<string | null>(null);
  const [packPick, setPackPick] = useState<{ repo: string; packs: RepoPackRow[] } | null>(null);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  useEffect(() => { let live = true; void api<UiState>({ action: 'state' }).then(s => { if (live) { setState(s); setTimeoutInput(String(s.timeoutMs / 1000)); } }).catch(e => { if (live) setError(String(e)); }); return () => { live = false; }; }, []);
  const save = (enabled: boolean, packs: InstalledPack[], timeoutMs: number = state.timeoutMs, debugEnabled: boolean = state.debugEnabled) => run(async () => {
    const updated: PackState = { enabled, packs: packs.map(({ id, enabled, priority }) => ({ id, enabled, priority })), timeoutMs, debugEnabled };
    setState(await api({ action: 'configure', state: updated }));
  });
  const commitTimeout = () => {
    const seconds = Number(timeoutInput);
    if (!Number.isFinite(seconds)) { setError('超时必须是数字（秒）'); return; }
    const clamped = Math.min(600, Math.max(0.1, seconds));
    setTimeoutInput(String(clamped));
    void save(state.enabled, state.packs, Math.round(clamped * 1000));
  };
  const search = () => run(async () => { setSearching(true); try { setItems(await api<MarketPack[]>({ action: 'search', query })); setSearched(true); } finally { setSearching(false); } });
  const openDisclaimer = async (installRepo: string | null, installPack: string | null = null) => {
    setPendingInstall(installRepo);
    setPendingPack(installPack);
    setDocAgreed(false);
    try { setDoc(await api<DisclaimerDoc>({ action: 'disclaimer' })); setDocOpen(true); } catch (e) { setError(String(e)); }
  };
  const acceptAndInstall = () => {
    if (!doc || !docAgreed) return;
    void run(async () => {
      setState(await api<UiState>({ action: 'accept-disclaimer', version: doc.version }));
      setDocOpen(false);
      if (pendingInstall) {
        setState(await api<UiState>({ action: 'install', repo: pendingInstall, pack: pendingPack ?? undefined, confirmed: true }));
        setPendingInstall(null); setPendingPack(null);
      }
    });
  };
  const startInstall = (repository: string, packId: string | null) => {
    const accepted = state.disclaimer && state.disclaimer.version >= state.disclaimerVersion;
    if (!accepted) { void openDisclaimer(repository, packId); return; }
    if (!window.confirm(`安装第三方语言包 ${repository}${packId ? ` · ${packId}` : ''}？格式校验不等于内容安全审核。其提示词可能发送文本给当前模型服务。是否承担风险并继续？`)) return;
    void run(async () => { setState(await api<UiState>({ action: 'install', repo: repository, pack: packId ?? undefined, confirmed: true })); });
  };
  const install = (repository: string) => {
    void run(async () => {
      const listing = await api<{ collection: boolean; packs: RepoPackRow[] }>({ action: 'repo-packs', repo: repository });
      if (listing.collection && listing.packs.length > 1) { setPackPick({ repo: repository, packs: listing.packs }); return; }
      startInstall(repository, null);
    });
  };
  const ordered = [...state.packs].sort((a, b) => a.priority - b.priority);
  const enabledCount = ordered.filter(p => p.enabled).length;
  const accepted = state.disclaimer !== null && state.disclaimer.version >= state.disclaimerVersion;
  const move = (from: string, to: string) => {
    const next = [...ordered]; const source = next.findIndex(p => p.id === from), target = next.findIndex(p => p.id === to);
    if (source < 0 || target < 0) return;
    next.splice(target, 0, next.splice(source, 1)[0]!);
    void save(state.enabled, next.map((p, priority) => ({ ...p, priority })));
  };
  return <section style={{ maxWidth: 860, padding: '28px 8px', margin: '0 auto', color: tokens.label, fontSize: 14, overflowWrap: 'anywhere', position: 'relative' }} aria-label="语言模组">
    <header style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>LexiForge · 语言模组</h2>
      <p style={{ margin: 0, fontSize: 12, color: tokens.label2 }}>对 AI 输出做配置驱动的语言加工；包按顺序链式处理，超时或失败回退原文。</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 12, color: tokens.label2, flexWrap: 'wrap' }}>
        <span style={{ color: state.enabled ? tokens.success : tokens.caption }}>● {state.enabled ? '已启用' : '已停用'}</span>
        <span>已装 {state.packs.length} 包 · 激活 {enabledCount} 个</span>
        <span>超时 {Math.round(state.timeoutMs) / 1000}s</span>
        <button onClick={() => void openDisclaimer(null)} style={{ ...btn(), padding: '2px 10px', fontSize: 12 }}>免责声明{state.disclaimer && state.disclaimer.version >= state.disclaimerVersion ? `（已接受 v${state.disclaimer.version}）` : '（未接受）'}</button>
      </div>
    </header>
    <p role="alert" style={{ color: tokens.danger, margin: '0 0 8px', fontSize: 12 }}>{error}</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600 }}>启用语言加工</div>
            <div style={{ fontSize: 12, color: tokens.label2, marginTop: 2 }}>开启后对每条回复应用已激活的语言包。</div>
          </div>
          <input type="checkbox" checked={state.enabled} onChange={e => void save(e.target.checked, state.packs)} style={{ width: 18, height: 18, accentColor: tokens.brand, cursor: 'pointer' }} aria-label="启用语言加工" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.border1}` }}>
          <div>
            <div style={{ fontWeight: 600 }}>处理超时（秒）</div>
            <div style={{ fontSize: 12, color: tokens.label2, marginTop: 2 }}>每个 A/B 包改写的最长等待；超时则跳过该包。范围 0.1–600，默认 0.5。改后即时生效。</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" min={0.1} max={600} step={0.1} value={timeoutInput} onChange={e => setTimeoutInput(e.target.value)} onBlur={commitTimeout} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTimeout(); } }} style={{ ...input, width: 90 }} aria-label="处理超时秒数" />
            <button style={btn(true)} onClick={commitTimeout}>应用</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.border1}` }}>
          <div>
            <div style={{ fontWeight: 600 }}>调试模式</div>
            <div style={{ fontSize: 12, color: tokens.label2, marginTop: 2 }}>开启后输出运行日志（含处理文本片段）到语言包数据目录下的 <code>{state.debugLogFile ?? '（未配置）'}</code>（相对 packagesDir 解析）。可能带来副作用：性能下降、磁盘占用、本地留下含回复内容的记录，请仅在排障时开启。</div>
          </div>
          <input type="checkbox" checked={state.debugEnabled} onChange={e => void save(state.enabled, state.packs, state.timeoutMs, e.target.checked)} style={{ width: 18, height: 18, accentColor: tokens.brand, cursor: 'pointer' }} aria-label="调试模式" />
        </div>
      </div>

      <h3 style={{ fontSize: 14, margin: '18px 2px 10px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
        已安装语言包
        <span style={{ fontSize: 12, color: tokens.caption, fontWeight: 400 }}>拖拽或上下移调整链式顺序</span>
      </h3>
      {!ordered.length && <div style={{ ...card, color: tokens.label2, fontSize: 13, textAlign: 'center' }}>暂无语言包，从下方市场安装或手动安装 ZIP。</div>}
      {ordered.map((p, index) => (
        <article key={p.id} draggable={!busy} onDragStart={() => setDrag(p.id)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag) move(drag, p.id); }} style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: busy ? 'default' : 'grab' }}>
          <span style={{ color: tokens.caption, fontSize: 12, width: 14 }}>{index + 1}</span>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.manifest.name}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }}>{modeBadge(p.manifest.mode)}{MODE_HINT[p.manifest.mode] ? ` · ${MODE_HINT[p.manifest.mode]}` : ''}</span>
              <span style={{ fontSize: 12, color: tokens.caption }}>v{p.manifest.version}</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.label2, marginTop: 3 }}>
              {p.enabled ? <span style={{ color: tokens.success }}>已激活</span> : <span style={{ color: tokens.caption }}>已停用</span>}
              <span style={{ marginLeft: 10 }}>{p.manifest.author}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={p.enabled} onChange={e => void save(state.enabled, state.packs.map(x => x.id === p.id ? { ...x, enabled: e.target.checked } : x))} style={{ accentColor: tokens.brand, cursor: 'pointer' }} />
              启用
            </label>
            <button style={btn()} disabled={index === 0} onClick={() => move(p.id, ordered[index - 1]!.id)}>上移</button>
            <button style={btn()} disabled={index === ordered.length - 1} onClick={() => move(p.id, ordered[index + 1]!.id)}>下移</button>
            <button style={btn(false, true)} onClick={() => { if (window.confirm(`卸载 ${p.manifest.name}？`)) void run(async () => setState(await api<UiState>({ action: 'uninstall', id: p.id }))); }}>卸载</button>
          </div>
        </article>
      ))}

      <h3 style={{ fontSize: 14, margin: '22px 2px 10px' }}>语言包市场</h3>
      <div style={{ ...card, padding: 12 }}>
        <form onSubmit={e => { e.preventDefault(); void search(); }} style={{ display: 'flex', gap: 8 }}>
          <input aria-label="搜索关键词" placeholder="搜索 GitHub 上的 dsh 语言包…" value={query} onChange={e => setQuery(e.target.value)} style={{ ...input, flex: 1 }} />
          <button style={btn(true)} disabled={searching}>{searching ? '搜索中…' : '搜索'}</button>
        </form>
        <p style={{ fontSize: 12, color: tokens.caption, margin: '8px 2px 0' }}>Star 仅代表流行度，不代表安全。所有来源均标记为第三方未审核。</p>
      </div>
      {items === null && <div style={{ ...card, color: tokens.caption, textAlign: 'center', fontSize: 13 }}>输入关键词搜索 <code style={{ color: tokens.label2 }}>topic:dsh-langpack</code> 仓库。</div>}
      {items !== null && !items.length && <div style={{ ...card, color: tokens.label2, textAlign: 'center', fontSize: 13 }}>没有匹配结果{searched ? '（话题下可能还没有仓库）' : ''}。</div>}
      {items?.map(item => (
        <article key={item.full_name} style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 200 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <a href={item.url} target="_blank" rel="noreferrer" style={{ color: tokens.brand, fontWeight: 600, textDecoration: 'none' }}>{item.full_name}</a>
              <span style={{ fontSize: 12, color: tokens.caption }}>★ {item.stars}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: `1px solid ${tokens.warn}55`, color: tokens.warn }}>未审核</span>
            </div>
            {item.description && <div style={{ fontSize: 12, color: tokens.label2, marginTop: 4 }}>{item.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button style={btn(true)} onClick={() => install(item.full_name)}>安装</button>
            <a href={`${item.url}/issues`} target="_blank" rel="noreferrer"><button style={btn()}>反馈 / 举报</button></a>
          </div>
        </article>
      ))}

      <h3 style={{ fontSize: 14, margin: '22px 2px 10px' }}>手动安装</h3>
      <div style={{ ...card, padding: 12 }}>
        <form onSubmit={e => { e.preventDefault(); install(repo); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input aria-label="GitHub 仓库 URL" placeholder="owner/repo 或 GitHub 仓库 URL（根目录需有 langpack.zip）" value={repo} onChange={e => setRepo(e.target.value)} style={{ ...input, flex: '1 1 280px' }} />
          <button style={btn(true)}>安装</button>
        </form>
        <p style={{ fontSize: 12, color: tokens.caption, margin: '8px 2px 0' }}>本地 ZIP 请使用 CLI：<code>lexiforge ROOT install 包.zip ID --accept-risk</code>。Token 由主机 githubToken 或 CLI GITHUB_TOKEN 提供，不发送到浏览器。</p>
      </div>
    </fieldset>

    {!accepted && (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'var(--dsw-alias-bg-mask-2)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, padding: '22px 26px', maxWidth: 520, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>功能不可用</div>
          <div style={{ fontSize: 13, color: tokens.label2, lineHeight: 1.7, marginBottom: 16 }}>首次使用前，须先阅读并接受《第三方语言包免责声明》。声明涵盖公开仓库可能存在的恶意与病毒文件、提示词注入、隐私与数据外流等风险。接受记录仅保存在本机，不会上传。</div>
          <button style={btn(true)} onClick={() => void openDisclaimer(null)}>阅读并同意</button>
        </div>
      </div>
    )}

    {packPick && packPick.packs.length > 0 && (
      <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'var(--dsw-alias-bg-mask-1)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tokens.border1}` }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>该仓库包含 {packPick.packs.length} 个语言包</div>
            <div style={{ fontSize: 12, color: tokens.label2, marginTop: 2 }}>{packPick.repo} · 请选择要安装的一个</div>
          </div>
          <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
            {packPick.packs.map(p => (
              <button key={p.id} onClick={() => { const repo = packPick.repo; setPackPick(null); startInstall(repo, p.id); }} style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', color: tokens.label, display: 'block', fontFamily: 'inherit', fontSize: 14 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }}>{p.id}</span>
                  {p.mode && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }}>{p.mode}</span>}
                  <span style={{ fontSize: 12, color: tokens.caption }}>v{p.version}</span>
                </div>
                {p.description && <div style={{ fontSize: 12, color: tokens.label2, marginTop: 4 }}>{p.description}</div>}
                {p.author && <div style={{ fontSize: 12, color: tokens.caption, marginTop: 2 }}>作者：{p.author}</div>}
              </button>
            ))}
          </div>
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${tokens.border1}` }}>
            <button style={btn()} onClick={() => setPackPick(null)}>取消</button>
          </div>
        </div>
      </div>
    )}

    {docOpen && doc && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'var(--dsw-alias-bg-mask-1)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, maxWidth: 680, width: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tokens.border1}` }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>第三方语言包免责声明 v{doc.version}</div>
          <div style={{ fontSize: 12, color: tokens.label2, marginTop: 2 }}>{pendingInstall ? `安装「${pendingInstall}${pendingPack ? ` · ${pendingPack}` : ''}」前必须通读并确认。` : '内容如下，可随时查看。'}</div>
        </div>
        <div style={{ padding: '4px 20px 12px', overflowY: 'auto', flex: 1, fontSize: 13, lineHeight: 1.7 }}>
          {doc.sections.map(s => (
            <div key={s.title} style={{ margin: '12px 0' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
              <div style={{ whiteSpace: 'pre-wrap', color: tokens.label2 }}>{s.body}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${tokens.border1}`, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: pendingInstall || !accepted ? 'pointer' : 'default', color: pendingInstall || !accepted ? tokens.label : tokens.caption }}>
            <input type="checkbox" checked={docAgreed} disabled={!pendingInstall && accepted} onChange={e => setDocAgreed(e.target.checked)} style={{ accentColor: tokens.brand }} />
            {pendingInstall || !accepted ? '我已通读并理解上述全部风险，自愿承担后果' : '（查看模式：无需确认）'}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn()} onClick={() => { setDocOpen(false); setPendingInstall(null); setDocAgreed(false); }}>关闭</button>
            {(pendingInstall !== null || !accepted) && <button style={btn(true)} disabled={!docAgreed} onClick={acceptAndInstall}>{pendingInstall !== null ? '确认并安装' : '同意并解锁'}</button>}
          </div>
        </div>
      </div>
    </div>}
  </section>;
}

interface ClientContext {
  slots: { inject(name: string, callback: () => unknown): unknown; register(options: { name: string; id: string; order: number; label: string }, component: typeof SettingsPanel): unknown };
}
export const inject = ['slots'];
export function apply(ctx: ClientContext) { ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'lexiforge', order: 50, label: '语言模组' }, SettingsPanel)); }
