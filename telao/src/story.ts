export interface StoryResponse { participantId: string; nickname: string; model: string; content: string; voteCount: number; averageScore: number | null }
export interface StoryChapter { id: string; index: number; winningNickname: string | null; winningContent: string | null; winningScore: number | null; winningVotes: number | null; round: { id: string; votingStatus: string; responses: StoryResponse[] } }
export interface Story { id: string; title: string; seedText: string; canonText: string; totalChapters: number; currentChapter: number; status: 'ready' | 'generating' | 'voting' | 'completed'; chapters: StoryChapter[] }

export async function fetchStory(): Promise<Story | null> {
  const response = await fetch('/api/story/state');
  if (!response.ok) return null;
  return (await response.json()).story;
}

export function storyPhase(status: Story['status']) {
  return { ready: 'Pronto para o próximo capítulo', generating: 'Modelos escrevendo', voting: 'Votação comunitária', completed: 'Cânone concluído' }[status];
}
