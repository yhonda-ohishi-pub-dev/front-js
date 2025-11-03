import { useEffect, useState } from 'react';
import { fetchTunnels, type TunnelInfo } from '../api/client';

interface TunnelListProps {
  onSelectTunnel: (clientId: string) => void;
  selectedTunnel?: string;
}

export function TunnelList({ onSelectTunnel, selectedTunnel }: TunnelListProps) {
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTunnels();
  }, []);

  async function loadTunnels() {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching tunnels...');
      const response = await fetchTunnels();
      console.log('Response:', response);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      setTunnels(response.data);
      console.log('Tunnels set:', response.data);
      console.log('Tunnels length:', response.data.length);
    } catch (err) {
      console.error('Error loading tunnels:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="tunnel-list loading">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="tunnel-list error">
        <p>エラー: {error}</p>
        <button onClick={loadTunnels}>再試行</button>
      </div>
    );
  }

  console.log('Rendering with tunnels:', tunnels);

  return (
    <div className="tunnel-list">
      <div className="tunnel-list-header">
        <h2>利用可能なトンネル ({tunnels.length})</h2>
        <button onClick={loadTunnels} className="refresh-button">
          🔄 更新
        </button>
      </div>
      <div className="tunnel-items">
        {tunnels.length === 0 && <p>トンネルがありません</p>}
        {tunnels.map((tunnel, index) => {
          console.log(`Rendering tunnel ${index}:`, tunnel);
          return (
            <div
              key={tunnel.clientId}
              className={`tunnel-item ${selectedTunnel === tunnel.clientId ? 'selected' : ''}`}
              onClick={() => onSelectTunnel(tunnel.clientId)}
            >
              <div className="tunnel-id">{tunnel.clientId}</div>
              <div className="tunnel-meta">
                <span>作成: {new Date(tunnel.createdAt).toLocaleString('ja-JP')}</span>
                <span>更新: {new Date(tunnel.updatedAt).toLocaleString('ja-JP')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
