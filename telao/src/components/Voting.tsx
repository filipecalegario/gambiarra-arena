import { useState, useEffect } from 'react';

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
}

function Voting() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Fetch session data
    fetch('/api/session')
      .then((res) => res.json())
      .then((data) => {
        setParticipants(data.participants || []);
      })
      .catch((err) => console.error('Failed to fetch session:', err));

    // Fetch current round
    fetch('/api/rounds/current')
      .then((res) => res.json())
      .then((data) => {
        setCurrentRound(data);
      })
      .catch((err) => console.error('Failed to fetch round:', err));
  }, []);

  const handleVote = (participantId: string, score: number) => {
    setVotes((prev) => ({
      ...prev,
      [participantId]: score,
    }));
  };

  const submitVotes = async () => {
    if (!currentRound) return;

    try {
      for (const [participantId, score] of Object.entries(votes)) {
        await fetch('/api/votes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundId: currentRound.id,
            participantId,
            score,
          }),
        });
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit votes:', err);
      alert('Erro ao enviar votos. Tente novamente.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-4xl font-bold text-primary mb-4">
            Voto enviado com sucesso!
          </h2>
          <p className="text-xl text-gray-400">
            Obrigado por participar!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-primary mb-4">
          🗳️ Votação
        </h1>
        {currentRound && (
          <div className="bg-gray-800 p-6 rounded-lg inline-block">
            <h2 className="text-2xl font-semibold mb-2">
              Rodada {currentRound.index}
            </h2>
            <p className="text-lg text-gray-300">{currentRound.prompt}</p>
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-primary">
                  {participant.nickname}
                </h3>
                <p className="text-sm text-gray-400">
                  {participant.runner} • {participant.model}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => handleVote(participant.id, score)}
                  className={`flex-1 py-3 px-4 rounded-lg text-xl font-bold transition-all ${
                    votes[participant.id] === score
                      ? 'bg-primary text-white scale-105'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={submitVotes}
          disabled={Object.keys(votes).length === 0}
          className={`px-8 py-4 rounded-lg text-xl font-bold transition-all ${
            Object.keys(votes).length > 0
              ? 'bg-primary hover:bg-secondary text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          Enviar Votos
        </button>
      </div>
    </div>
  );
}

export default Voting;
