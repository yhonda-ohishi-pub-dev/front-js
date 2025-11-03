import { useState } from 'react';
import { TunnelList } from './components/TunnelList';
import { MethodExecutor } from './components/MethodExecutor';
import './App.css';

function App() {
  const [selectedTunnel, setSelectedTunnel] = useState<string | undefined>();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚇 Tunnel Manager</h1>
        <p>Cloudflare Worker Tunnel Proxy UI</p>
      </header>

      <div className="app-content">
        <div className="left-panel">
          <TunnelList
            onSelectTunnel={setSelectedTunnel}
            selectedTunnel={selectedTunnel}
          />
        </div>

        <div className="right-panel">
          {selectedTunnel ? (
            <MethodExecutor clientId={selectedTunnel} />
          ) : (
            <div className="no-selection">
              <p>← 左側からトンネルを選択してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
