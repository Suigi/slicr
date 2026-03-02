import { useAppState } from './application/useAppState';
import { AppShell } from './ui/AppShell';

function App() {
  const vm = useAppState();
  return <AppShell {...vm} />;
}

export default App;
