import { useCallback, useEffect, useState } from 'react';
import QRCodeGenerator from './QRCodeGenerator';
import { useTelaoSocket } from '../hooks/useTelaoSocket';
import { fetchStory, Story, storyPhase } from '../story';

export function StoryControl() {
  const [story, setStory] = useState<Story | null>(null);
  const [session, setSession] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [newStoryMode, setNewStoryMode] = useState(false);
  const [form, setForm] = useState({ title: 'O último roteador', seedText: 'Às 23h47, todos os computadores da arena desligaram ao mesmo tempo. Só um notebook permaneceu aceso: um Celeron de 2012 rodando um modelo que ninguém lembrava de ter instalado. Na tela apareceu: “Não desliguem o roteador. Eu tenho uma história para terminar.” Então a porta do laboratório se trancou por dentro.', totalChapters: 3, maxTokens: 500, temperature: 0.9, deadlineMs: 120000 });
  const reload = useCallback(() => fetchStory().then(setStory).catch(() => undefined), []);
  useEffect(() => { fetch('/api/session').then(r => r.ok ? r.json() : null).then(setSession); }, []);
  const connected = useTelaoSocket('story-control', useCallback((message: any) => { if (message.type === 'story_state') setStory(message.story); }, []));
  useEffect(() => { reload(); const timer = setInterval(reload, connected ? 30000 : 8000); return () => clearInterval(timer); }, [reload, connected]);

  const request = async (path: string, body?: unknown) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api${path}`, body === undefined
        ? { method: 'POST' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível executar a ação');
      await reload();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro inesperado'); return false; } finally { setBusy(false); }
  };
  const confirmAction = (key: string, label: string, warning: string, onConfirm: () => void, triggerClass: string) =>
    confirming === key
      ? <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-rose-300">{warning}</span>
          <button disabled={busy} onClick={() => { setConfirming(null); onConfirm(); }} className="px-4 py-3 bg-rose-500 text-white rounded-xl font-bold">Confirmar</button>
          <button disabled={busy} onClick={() => setConfirming(null)} className="px-4 py-3 bg-slate-700 text-white rounded-xl">Não</button>
        </span>
      : <button disabled={busy} onClick={() => setConfirming(key)} className={triggerClass}>{label}</button>;
  const clientUrl = `${location.protocol}//${location.hostname}:3000/client`;

  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10">
    <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-8">
      <div><p className="text-amber-400 uppercase tracking-[.3em] text-xs">Gambiarra Arena</p><h1 className="text-4xl font-black">Cânone comunitário</h1></div>
      <nav className="flex gap-3"><a className="px-4 py-2 rounded-xl bg-slate-800" href="/story" target="_blank">Abrir telão</a><a className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold" href="/story-voting" target="_blank">Abrir votação</a></nav>
    </header>
    <section className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        {(!story || newStoryMode) ? <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">{newStoryMode ? 'Nova história (mesma sessão)' : 'Comece uma história'}</h2>
            {newStoryMode && <button onClick={() => setNewStoryMode(false)} className="text-sm text-slate-400 hover:text-white">← voltar</button>}
          </div>
          {newStoryMode && <p className="text-sm text-slate-400">A história anterior fica salva. Ninguém precisa reconectar — o PIN e os participantes continuam os mesmos.</p>}
          {!session && <button disabled={busy} onClick={() => request('/session', { pinLength: 6 }).then(() => location.reload())} className="px-5 py-3 rounded-xl bg-amber-400 text-slate-950 font-bold">Criar sessão primeiro</button>}
          {session && <><label className="block">Título<input className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.title} onChange={e => setForm({...form, title:e.target.value})}/></label>
          <label className="block">Ponto de partida<textarea rows={7} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.seedText} onChange={e => setForm({...form, seedText:e.target.value})}/></label>
          <div className="grid sm:grid-cols-3 gap-4"><label>Capítulos<input type="number" min="1" max="10" className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.totalChapters} onChange={e => setForm({...form,totalChapters:+e.target.value})}/></label><label>Tokens<input type="number" className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.maxTokens} onChange={e => setForm({...form,maxTokens:+e.target.value})}/></label><label>Tempo (s)<input type="number" className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl p-3" value={form.deadlineMs/1000} onChange={e => setForm({...form,deadlineMs:+e.target.value*1000})}/></label></div>
          <button disabled={busy} onClick={() => request('/story', form).then(ok => { if (ok) setNewStoryMode(false); })} className="px-6 py-3 rounded-xl bg-amber-400 text-slate-950 font-black">Criar competição</button></>}
        </div> : <><div className="bg-slate-900 border border-slate-800 rounded-3xl p-7">
          <div className="flex justify-between gap-4"><div><p className="text-amber-400 font-semibold">Capítulo {story.currentChapter}/{story.totalChapters}</p><h2 className="text-3xl font-black">{story.title}</h2></div><span className="h-fit px-3 py-1 rounded-full bg-slate-800">{storyPhase(story.status)}</span></div>
          <p className="mt-5 text-slate-300 whitespace-pre-wrap max-h-64 overflow-auto">{story.canonText}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {story.status === 'ready' && <button disabled={busy} onClick={() => request(`/story/${story.id}/chapters/start`)} className="px-6 py-3 bg-emerald-400 text-slate-950 rounded-xl font-black">Iniciar capítulo {story.currentChapter + 1}</button>}
            {story.status === 'generating' && <button disabled={busy} onClick={() => request(`/story/${story.id}/chapters/stop`)} className="px-6 py-3 bg-violet-400 text-slate-950 rounded-xl font-black">Encerrar geração e abrir votação</button>}
            {story.status === 'voting' && <button disabled={busy} onClick={() => request(`/story/${story.id}/canonize`)} className="px-6 py-3 bg-amber-400 text-slate-950 rounded-xl font-black">Tornar vencedor cânone (por votos)</button>}
            {(story.status === 'generating' || story.status === 'voting') && confirmAction('cancel', 'Cancelar capítulo', 'Descartar continuações e votos deste capítulo?', () => request(`/story/${story.id}/chapters/cancel`), 'px-6 py-3 bg-rose-500/90 text-white rounded-xl font-bold')}
            {story.status === 'completed' && <p className="text-emerald-300 text-xl font-bold self-center">História concluída — pronta para leitura!</p>}
            {story.status === 'completed' && <button disabled={busy} onClick={() => { setConfirming(null); setNewStoryMode(true); }} className="px-6 py-3 bg-emerald-400 text-slate-950 rounded-xl font-black">Nova história (mesma sessão)</button>}
            {story.status === 'ready' && confirmAction('discard', 'Descartar história', 'Apagar esta história não finalizada e voltar para a criação?', () => request(`/story/${story.id}/discard`), 'px-6 py-3 bg-rose-600/90 text-white rounded-xl font-bold')}
          </div>
          {story.status === 'voting' && (() => { const resps = story.chapters[story.chapters.length - 1]?.round.responses ?? []; return resps.length > 0 && <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-sm text-slate-400 mb-2">Sem votos ou quer decidir empate? Escolha manualmente:</p><div className="flex flex-wrap gap-2">{resps.map((r, i) => <button key={r.participantId} disabled={busy} onClick={() => request(`/story/${story.id}/canonize`, { participantId: r.participantId })} className="text-sm px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700" title={r.content.slice(0, 120)}>Continuação {i + 1} · {r.nickname}{r.averageScore != null ? ` (★${r.averageScore.toFixed(1)})` : ''}</button>)}</div></div>; })()}
          {error && <p className="mt-4 text-red-300">{error}</p>}
        </div>
        <div className="grid md:grid-cols-2 gap-4">{story.chapters.map(c => <article key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-xs tracking-widest text-slate-500 uppercase">Capítulo {c.index}</p><h3 className="font-bold text-lg mt-1">{c.winningNickname ? `Cânone por ${c.winningNickname}` : `${c.round.responses.length} continuações recebidas`}</h3>{c.winningScore != null && <p className="text-amber-300">★ {c.winningScore.toFixed(2)} · {c.winningVotes} votos</p>}</article>)}</div></>}
      </div>
      <aside className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-fit"><h2 className="font-bold text-xl">Participantes</h2>{session ? <><p className="text-slate-400 mt-2">PIN da sessão: <strong className="text-white text-2xl">{session.pin}</strong></p><div className="bg-white p-4 rounded-2xl mt-5"><QRCodeGenerator value={clientUrl} size={260}/></div><p className="text-xs text-slate-400 break-all mt-3">{clientUrl}</p></> : <p className="text-slate-400 mt-3">Crie uma sessão para exibir o QR Code.</p>}<div className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-300"><p className="font-bold text-white mb-2">Critérios de voto</p><p>Coerência narrativa · 40%</p><p>Criatividade · 35%</p><p>Estilo e humor · 25%</p></div></aside>
    </section>
  </main>;
}
