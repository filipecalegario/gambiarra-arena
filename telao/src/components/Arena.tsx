import { useState, useEffect } from 'react';
import ParticipantCard from './ParticipantCard';
import QRCodeGenerator from './QRCodeGenerator';

interface Participant {
  id: string;
  nickname: string;
  runner: string;
  model: string;
}

interface Round {
  id: string;
  index: number;
  prompt: string;
  maxTokens: number;
  deadlineMs: number;
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
    // Fetch session data
    fetch('/api/session')
      .then((res) => res.json())
      .then((data) => {
        setParticipants(data.participants || []);
      })
      .catch((err) => console.error('Failed to fetch session:', err));

    // Fetch current round
    const fetchRound = () => {
      fetch('/api/rounds/current')
        .then((res) => res.json())
        .then((data) => {
          setCurrentRound(data);
          // Initialize participant states from live tokens
          if (data.liveTokens) {
            const newStates: Record<string, ParticipantState> = {};
            for (const [pid, tokens] of Object.entries(data.liveTokens)) {
              newStates[pid] = {
                tokens: (tokens as string[]).length,
                isGenerating: !data.endedAt,
                content: tokens as string[],
              };
            }
            setParticipantStates(newStates);
          }
        })
        .catch((err) => console.error('Failed to fetch round:', err));
    };

    fetchRound();
    const interval = setInterval(fetchRound, 2000);

    // Set voting URL
    const baseUrl = window.location.origin;
    setVotingUrl(`${baseUrl}?view=voting`);

    return () => clearInterval(interval);
  }, []);

  // WebSocket for live updates (optional enhancement)
  // This would listen to the /ws endpoint for real-time token updates

  return (
    <div className="min-h-screen p-8">
      <header className="mb-8">
        <h1 className="text-6xl font-bold text-primary mb-4">
          🎮 Gambiarra LLM Club Arena
        </h1>
        {currentRound && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-3xl font-semibold mb-2">
              Rodada {currentRound.index}
            </h2>
            <p className="text-xl text-gray-300">{currentRound.prompt}</p>
            <div className="mt-4 flex gap-4 text-sm text-gray-400">
              <span>Max tokens: {currentRound.maxTokens}</span>
              <span>Prazo: {(currentRound.deadlineMs / 1000).toFixed(0)}s</span>
              {currentRound.startedAt && !currentRound.endedAt && (
                <span className="text-green-400 font-semibold">● AO VIVO</span>
              )}
              {currentRound.endedAt && (
                <span className="text-red-400">● ENCERRADA</span>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {participants.map((participant) => {
          const state = participantStates[participant.id] || {
            tokens: 0,
            isGenerating: false,
            content: [],
          };

          return (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              tokens={state.tokens}
              maxTokens={currentRound?.maxTokens || 400}
              isGenerating={state.isGenerating}
              content={state.content.join('')}
            />
          );
        })}
      </div>

      <footer className="mt-12 flex justify-center">
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <h3 className="text-2xl font-semibold mb-4">Vote nas respostas!</h3>
          <QRCodeGenerator value={votingUrl} size={200} />
          <p className="mt-4 text-gray-400">
            Escaneie o QR code ou acesse: {votingUrl}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Arena;
