import { useState, useEffect } from 'react';
import ParticipantCard from './ParticipantCard';
import QRCodeGenerator from './QRCodeGenerator';

interface Participant {
  id: string;
  nickname: string;
  runner: string;
  model: string;
  lastSeen?: string;
  connected?: boolean;
}

interface Round {
  id: string;
  index: number;
  prompt: string;
  maxTokens: number;
  deadlineMs: number;
  svgMode: boolean;
  startedAt: string | null;
  endedAt: string | null;
  liveTokens?: Record<string, string[]>;
}

interface TokenUpdate {
  type: 'token_update';
  participant_id: string;
  round: number;
  seq: number;
  content: string;
  total_tokens: number;
}

interface Completion {
  type: 'completion';
  participant_id: string;
  round: number;
  tokens: number;
  duration_ms: number;
}

interface ParticipantState {
  tokens: number;
  isGenerating: boolean;
  content: string[];
}

function Arena() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [participantStates, setParticipantStates] = useState<Record<string, ParticipantState>>({});
  const [votingUrl, setVotingUrl] = useState('');

  useEffect(() => {
    const ONLINE_THRESHOLD_MS = 60_000; // 60s: consider participant online if seen within this window
    // Fetch session data periodically
    const fetchSession = () => {
      fetch('/api/session')
        .then((res) => res.json())
        .then((data) => {
          // Prefer explicit `connected` flag; fall back to lastSeen if absent
          const parts = (data.participants || []).filter((p: Participant) => {
            if (typeof p.connected === 'boolean') return p.connected;
            try {
              if (!p.lastSeen) return false;
              return Date.now() - new Date(p.lastSeen).getTime() < ONLINE_THRESHOLD_MS;
            } catch (e) {
              return false;
            }
          });

          setParticipants(parts);
        })
        .catch((err) => console.error('Failed to fetch session:', err));
    };

    fetchSession();
    const sessionInterval = setInterval(fetchSession, 2000);

    // Fetch current round (or latest round if none active)
    const fetchRound = () => {
      // First try to get active round
      fetch('/api/rounds/current')
        .then((res) => {
          if (res.ok) return res.json();
          // If no active round, fetch from session to get latest round
          return fetch('/api/session')
            .then((sessionRes) => sessionRes.json())
            .then((sessionData) => {
              const rounds = sessionData.rounds || [];
              // Get the most recent round (highest index)
              const latestRound = rounds.sort((a: Round, b: Round) => b.index - a.index)[0];
              return latestRound || null;
            });
        })
        .then((data) => {
          if (!data) return;
          setCurrentRound(data);
          // Initialize participant states from live tokens
          if (data.liveTokens) {
            setParticipantStates((prevStates) => {
              const newStates: Record<string, ParticipantState> = { ...prevStates };
              for (const [pid, tokens] of Object.entries(data.liveTokens)) {
                // Only update if we don't have this participant yet, or merge carefully
                const existingState = newStates[pid];
                if (!existingState) {
                  // New participant - initialize
                  newStates[pid] = {
                    tokens: (tokens as string[]).length,
                    isGenerating: !data.endedAt,
                    content: tokens as string[],
                  };
                } else {
                  // Existing participant - preserve isGenerating if already false
                  // Also preserve content if new content is empty but we have existing content
                  const newTokens = tokens as string[];
                  newStates[pid] = {
                    tokens: newTokens.length || existingState.tokens,
                    isGenerating: existingState.isGenerating === false ? false : !data.endedAt,
                    content: newTokens.length > 0 ? newTokens : existingState.content,
                  };
                }
              }
              return newStates;
            });
          }
          // If round ended and we have no liveTokens, preserve existing states but mark as not generating
          if (data.endedAt && !data.liveTokens) {
            setParticipantStates((prevStates) => {
              const newStates: Record<string, ParticipantState> = {};
              for (const [pid, state] of Object.entries(prevStates)) {
                newStates[pid] = { ...state, isGenerating: false };
              }
              return newStates;
            });
          }
        })
        .catch((err) => console.error('Failed to fetch round:', err));
    };

    fetchRound();
    const interval = setInterval(fetchRound, 2000);

    // Set voting URL
    const baseUrl = window.location.origin;
    setVotingUrl(`${baseUrl}/voting`);

    return () => {
      clearInterval(interval);
      clearInterval(sessionInterval);
    };
  }, []);

  // WebSocket for live updates (optional enhancement)
  // This would listen to the /ws endpoint for real-time token updates
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}/ws`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Failed to open WebSocket to', wsUrl, err);
      return;
    }

    ws.addEventListener('open', () => {
      // Register as telao
      ws!.send(JSON.stringify({ type: 'telao_register', view: 'arena' }));
    });

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        switch (msg.type) {
          case 'token_update': {
            const pid = msg.participant_id as string;
            setParticipantStates((prev) => {
              const next = { ...prev };
              const state = next[pid] || { tokens: 0, isGenerating: false, content: [] };
              state.tokens = msg.total_tokens;
              state.isGenerating = true;
              state.content = [...(state.content || []), msg.content];
              next[pid] = state;
              return next;
            });
            break;
          }
          case 'completion': {
            const pid = msg.participant_id as string;
            setParticipantStates((prev) => {
              const next = { ...prev };
              const state = next[pid] || { tokens: 0, isGenerating: false, content: [] };
              state.tokens = msg.tokens;
              state.isGenerating = false;
              next[pid] = state;
              return next;
            });
            break;
          }
          case 'participant_registered': {
            const p = msg.participant as Participant;
            setParticipants((prev) => {
              const exists = prev.find((x) => x.id === p.id);
              if (exists) {
                return prev.map((x) => (x.id === p.id ? { ...x, ...p } : x));
              }
              return [...prev, p];
            });
            break;
          }
          case 'participant_disconnected': {
            const pid = msg.participant_id as string;
            setParticipants((prev) => prev.filter((p) => p.id !== pid));
            setParticipantStates((prev) => {
              const next = { ...prev };
              delete next[pid];
              return next;
            });
            break;
          }
          default:
            break;
        }
      } catch (e) {
        console.error('Invalid WS message', e);
      }
    });

    ws.addEventListener('close', () => {
      console.info('Telao WS closed');
    });

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  return (
    <div className="min-h-screen p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl lg:text-5xl font-mono font-bold text-neon-orange tracking-wider glitch">
            GAMBIARRA ARENA
          </h1>
          <div className="hidden lg:flex items-center gap-4">
            <div className="px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-surface-light)] rounded font-mono text-sm">
              <span className="text-[var(--color-neon-yellow)]">{participants.length}</span>
              <span className="text-gray-400 ml-2">conectados</span>
            </div>
          </div>
        </div>

        {/* Round info card */}
        {currentRound && (
          <div className="arcade-card rounded-xl p-6 animate-fade-in-up">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-[var(--color-neon-purple)]/20 border border-[var(--color-neon-purple)] rounded font-mono font-bold text-[var(--color-neon-purple)] text-sm uppercase tracking-wider">
                    Rodada {currentRound.index}
                  </span>
                  {currentRound.startedAt && !currentRound.endedAt && (
                    <div className="live-indicator">
                      <span>AO VIVO</span>
                    </div>
                  )}
                  {currentRound.endedAt && (
                    <span className="px-3 py-1 bg-red-500/20 border border-red-500 rounded font-mono font-semibold text-red-400 text-xs uppercase tracking-wider">
                      Encerrada
                    </span>
                  )}
                </div>
                <p className="text-xl lg:text-2xl font-body text-gray-100 leading-relaxed">
                  {currentRound.prompt}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 lg:gap-6 text-sm font-mono">
                <div className="flex flex-col items-center p-3 bg-[var(--color-midnight)] rounded-lg border border-[var(--color-surface-light)]">
                  <span className="text-2xl font-mono font-bold text-neon-cyan">{currentRound.maxTokens}</span>
                  <span className="text-xs text-gray-500 uppercase">tokens</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-[var(--color-midnight)] rounded-lg border border-[var(--color-surface-light)]">
                  <span className="text-2xl font-mono font-bold text-neon-yellow">{(currentRound.deadlineMs / 1000).toFixed(0)}s</span>
                  <span className="text-xs text-gray-500 uppercase">prazo</span>
                </div>
                {currentRound.svgMode && (
                  <div className="flex flex-col items-center p-3 bg-[var(--color-neon-pink)]/10 rounded-lg border border-[var(--color-neon-pink)]">
                    <span className="text-2xl">🎨</span>
                    <span className="text-xs text-[var(--color-neon-pink)] uppercase font-semibold">SVG</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No round message */}
        {!currentRound && (
          <div className="arcade-card rounded-xl p-8 text-center animate-fade-in-up">
            <div className="text-6xl mb-4 animate-float">⏳</div>
            <h2 className="text-2xl font-mono font-bold text-gray-300 mb-2">
              Aguardando rodada
            </h2>
            <p className="text-gray-500 font-body">
              O administrador iniciará a competição em breve...
            </p>
          </div>
        )}
      </header>

      {/* Participants grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
        {participants.map((participant, index) => {
          const state = participantStates[participant.id] || {
            tokens: 0,
            isGenerating: false,
            content: [],
          };

          return (
            <div
              key={participant.id}
              className={`animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
              style={{ opacity: 0 }}
            >
              <ParticipantCard
                participant={participant}
                tokens={state.tokens}
                maxTokens={currentRound?.maxTokens || 400}
                isGenerating={state.isGenerating}
                content={state.content.join('')}
                svgMode={currentRound?.svgMode || false}
              />
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {participants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div className="text-8xl mb-6 animate-float">👾</div>
          <h2 className="text-3xl font-mono font-bold text-gray-400 mb-3">
            Nenhum participante conectado
          </h2>
          <p className="text-gray-500 font-body text-lg">
            Aguardando jogadores entrarem na arena...
          </p>
        </div>
      )}

      {/* Footer with QR code */}
      <footer className="mt-8 flex justify-center animate-fade-in">
        <div className="arcade-card rounded-xl p-6 lg:p-8 text-center max-w-md">
          <h3 className="text-xl lg:text-2xl font-mono font-bold text-neon-yellow mb-4 tracking-wider">
            VOTE NAS RESPOSTAS!
          </h3>
          <div className="p-4 bg-white rounded-lg inline-block mb-4">
            <QRCodeGenerator value={votingUrl} size={180} />
          </div>
          <p className="text-sm font-mono text-gray-400">
            Escaneie o QR code ou acesse:
          </p>
          <p className="text-[var(--color-neon-cyan)] font-mono text-sm mt-1 break-all">
            {votingUrl}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Arena;
