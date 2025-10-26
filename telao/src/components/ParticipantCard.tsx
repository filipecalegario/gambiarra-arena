interface Participant {
  id: string;
  nickname: string;
  runner: string;
  model: string;
}

interface ParticipantCardProps {
  participant: Participant;
  tokens: number;
  maxTokens: number;
  isGenerating: boolean;
  content: string;
}

function ParticipantCard({
  participant,
  tokens,
  maxTokens,
  isGenerating,
  content,
}: ParticipantCardProps) {
  const progress = (tokens / maxTokens) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700 hover:border-primary transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-primary">{participant.nickname}</h3>
          <p className="text-sm text-gray-400">{participant.id}</p>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-400 font-semibold">Gerando</span>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Runner: {participant.runner}</span>
          <span className="text-gray-300 font-semibold">
            {tokens} / {maxTokens} tokens
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-secondary to-primary h-full transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-2">
        Model: {participant.model}
      </div>

      {content && (
        <div className="mt-4 p-4 bg-gray-900 rounded border border-gray-700 max-h-48 overflow-y-auto">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ParticipantCard;
