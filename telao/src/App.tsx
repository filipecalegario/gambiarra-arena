import { useEffect } from 'react';
import Arena from './components/Arena';
import Voting from './components/Voting';
import Scoreboard from './components/Scoreboard';
import { AdminPanel } from './components/AdminPanel';
import WorldArena from './components/WorldArena';
import { WorldControl } from './components/WorldControl';
import { StoryControl } from './components/StoryControl';
import { StoryArena } from './components/StoryArena';
import { StoryVoting } from './components/StoryVoting';

type View = 'arena' | 'voting' | 'scoreboard' | 'admin' | 'world' | 'control' | 'story' | 'story-control' | 'story-voting';

const PAGE_TITLES: Record<View, string> = {
  arena: 'Arena | Gambiarra',
  voting: 'Votação | Gambiarra',
  scoreboard: 'Placar | Gambiarra',
  admin: 'Admin | Gambiarra',
  world: 'Mundo | Gambiarra',
  control: 'Controle do Mundo | Gambiarra',
  story: 'Cânone Comunitário | Gambiarra',
  'story-control': 'Controle do Cânone | Gambiarra',
  'story-voting': 'Votação do Cânone | Gambiarra',
};

function getViewFromPath(): View {
  const path = window.location.pathname;
  if (path === '/voting') return 'voting';
  if (path === '/scoreboard') return 'scoreboard';
  if (path === '/admin') return 'admin';
  if (path === '/world') return 'world';
  if (path === '/control') return 'control';
  if (path === '/story') return 'story';
  if (path === '/story-control') return 'story-control';
  if (path === '/story-voting') return 'story-voting';
  return 'arena';
}

function App() {
  const view = getViewFromPath();

  useEffect(() => {
    document.title = PAGE_TITLES[view];
  }, [view]);

  const renderView = () => {
    switch (view) {
      case 'voting':
        return <Voting />;
      case 'scoreboard':
        return <Scoreboard />;
      case 'admin':
        return <AdminPanel />;
      case 'world':
        return <WorldArena />;
      case 'control':
        return <WorldControl />;
      case 'story':
        return <StoryArena />;
      case 'story-control':
        return <StoryControl />;
      case 'story-voting':
        return <StoryVoting />;
      default:
        return <Arena />;
    }
  };

  return (
    <div className="min-h-screen bg-dark">
      {renderView()}
    </div>
  );
}

export default App;
