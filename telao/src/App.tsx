import { useState, useEffect } from 'react';
import Arena from './components/Arena';
import Voting from './components/Voting';

function App() {
  const [view, setView] = useState<'arena' | 'voting'>('arena');
  const params = new URLSearchParams(window.location.search);
  const initialView = params.get('view') as 'arena' | 'voting' | null;

  useEffect(() => {
    if (initialView) {
      setView(initialView);
    }
  }, [initialView]);

  return (
    <div className="min-h-screen bg-dark">
      {view === 'arena' ? <Arena /> : <Voting />}
    </div>
  );
}

export default App;
