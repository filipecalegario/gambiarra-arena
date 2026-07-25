import { useCallback, useEffect, useState } from 'react';
import { useTelaoSocket } from '../hooks/useTelaoSocket';
import { fetchStory, Story, storyPhase } from '../story';

export function StoryArena() {
  const [story, setStory] = useState<Story | null>(null);
  const [live, setLive] = useState<Record<string,string>>({});
  const reload = useCallback(() => fetchStory().then(setStory).catch(() => undefined), []);
  const connected = useTelaoSocket('story', useCallback((message:any) => {
    if (message.type === 'story_state') setStory(message.story);
    if (message.type === 'round_started') setLive({});
    if (message.type === 'token_update') setLive(old => ({...old,[message.participant_id]:(old[message.participant_id]||'')+message.content}));
  }, []));
  useEffect(() => { reload(); const timer=setInterval(reload, connected ? 30000 : 8000); return()=>clearInterval(timer); }, [reload, connected]);
  if (!story) return <main className="min-h-screen bg-[#090b16] text-white grid place-items-center"><div className="text-center"><p className="text-7xl mb-4">📖</p><h1 className="text-4xl font-black">Cânone comunitário</h1><p className="text-slate-400 mt-3">Aguardando o começo da história…</p></div></main>;
  const chapter=story.chapters[story.chapters.length-1];
  const responses=chapter?.round.responses ?? [];
  const candidates = story.status==='generating' ? [...new Set([...responses.map(r=>r.participantId),...Object.keys(live)])].map(id=>({id,nickname:responses.find(r=>r.participantId===id)?.nickname||'Modelo escrevendo',content:live[id]||responses.find(r=>r.participantId===id)?.content||''})) : [...responses].sort((a,b)=>a.participantId.localeCompare(b.participantId)).map(r=>({id:r.participantId,nickname:r.nickname,content:r.content}));
  const revealAuthors = story.status!=='generating' && story.status!=='voting';
  return <main className="min-h-screen bg-[#090b16] text-slate-100 p-7 lg:p-12">
    <header className="flex items-end justify-between gap-6 border-b border-white/10 pb-6"><div><p className="text-amber-400 tracking-[.35em] uppercase text-sm">Cânone comunitário</p><h1 className="text-4xl lg:text-6xl font-black mt-2">{story.title}</h1></div><div className="text-right"><p className="text-2xl font-bold">{storyPhase(story.status)}</p><p className="text-slate-400">Capítulo {story.currentChapter} de {story.totalChapters}</p></div></header>
    {story.status==='completed' ? <section className="max-w-4xl mx-auto py-12"><p className="text-amber-400 uppercase tracking-widest text-center">A história escolhida pela arena</p><article className="mt-7 whitespace-pre-wrap font-serif text-2xl leading-relaxed text-slate-200">{story.canonText}</article><div className="mt-10 flex flex-wrap justify-center gap-3">{story.chapters.map(c=><span key={c.id} className="px-4 py-2 bg-amber-400/10 border border-amber-400/30 rounded-full">Cap. {c.index}: {c.winningNickname}</span>)}</div></section> : <div className="grid lg:grid-cols-[minmax(320px,.75fr)_1.6fr] gap-8 mt-8">
      <section className="bg-white/[.04] border border-white/10 rounded-3xl p-7 h-fit"><p className="text-xs uppercase tracking-[.25em] text-amber-400">O cânone até aqui</p><div className="mt-5 whitespace-pre-wrap font-serif text-lg leading-relaxed max-h-[65vh] overflow-auto pr-2">{story.canonText}</div></section>
      <section><div className="flex items-center justify-between mb-5"><h2 className="text-2xl font-black">{story.status==='ready'?'O próximo capítulo aguarda o apresentador':story.status==='voting'?'Continuações candidatas':`Capítulo ${story.currentChapter} sendo escrito ao vivo`}</h2><span className="text-slate-400">{candidates.length} textos</span></div>{candidates.length===0?<div className="border border-dashed border-white/20 rounded-3xl p-16 text-center text-slate-400">As continuações aparecerão aqui token por token.</div>:<div className="grid xl:grid-cols-2 gap-5">{candidates.map((c,i)=><article key={c.id} className="bg-white/[.05] border border-white/10 rounded-3xl p-6"><p className="text-xs uppercase tracking-widest text-violet-300">Continuação {i+1}{revealAuthors && c.nickname ? ` · ${c.nickname}` : ''}</p><p className="mt-4 whitespace-pre-wrap leading-relaxed line-clamp-[12]">{c.content || <span className="animate-pulse text-slate-500">pensando…</span>}</p></article>)}</div>}</section>
    </div>}
  </main>;
}
