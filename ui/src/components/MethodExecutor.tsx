import { useState, useEffect } from 'react';
import {
  executeGrpcWebRequest,
  listGrpcServices,
  type GrpcService,
} from '../api/client';

interface MethodExecutorProps {
  clientId: string;
}

export function MethodExecutor({ clientId }: MethodExecutorProps) {
  const [requestBody, setRequestBody] = useState('{}');
  const [service, setService] = useState('');
  const [method, setMethod] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [grpcServices, setGrpcServices] = useState<GrpcService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    loadGrpcServices();
  }, [clientId]);

  async function loadGrpcServices() {
    setLoadingServices(true);
    try {
      const services = await listGrpcServices(clientId);
      setGrpcServices(services);
      if (services.length > 0) {
        setService(services[0].name);
      }
    } catch (err) {
      console.error('Failed to load gRPC services:', err);
    } finally {
      setLoadingServices(false);
    }
  }

  async function executeRequest() {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const grpcData = JSON.parse(requestBody);
      const result = await executeGrpcWebRequest(clientId, service, method, grpcData);
      console.log('executeGrpcWebRequest result:', result);
      setResponse(result);
    } catch (err) {
      console.error('executeGrpcWebRequest error:', err);
      setError(err instanceof Error ? err.message : 'リクエストの実行に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="method-executor">
      <div className="executor-header">
        <h2>gRPC メソッド実行</h2>
        <div className="client-id">クライアントID: <strong>{clientId}</strong></div>
      </div>

      <div className="grpc-form">
          <div className="form-group">
            <label>サービス名:</label>
            {loadingServices ? (
              <div>サービス一覧を取得中...</div>
            ) : grpcServices.length > 0 ? (
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                {grpcServices.map((svc) => (
                  <option key={svc.name} value={svc.name}>
                    {svc.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="例: myservice.MyService"
              />
            )}
            {grpcServices.length === 0 && !loadingServices && (
              <small style={{ color: '#999', fontSize: '0.85rem' }}>
                リフレクションが利用できません。手動でサービス名を入力してください。
              </small>
            )}
          </div>
        <div className="form-group">
          <label>メソッド名:</label>
          {grpcServices.length > 0 && service ? (
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="">メソッドを選択...</option>
              {grpcServices
                .find((svc) => svc.name === service)
                ?.methods.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.input_type} → {m.output_type})
                  </option>
                ))}
            </select>
          ) : (
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="例: GetData"
            />
          )}
        </div>
        <div className="form-group">
          <label>リクエストボディ (JSON):</label>
          <textarea
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            placeholder='{"key": "value"}'
            rows={10}
          />
        </div>
      </div>

      <button
        onClick={executeRequest}
        disabled={loading}
        className="execute-button"
      >
        {loading ? '実行中...' : '実行'}
      </button>

      {error && (
        <div className="error-message" style={{ color: 'red', backgroundColor: '#ffebee', padding: '15px', borderRadius: '4px', border: '1px solid #ffcdd2' }}>
          <strong>エラー:</strong> {error}
        </div>
      )}

      {response && (
        <div className="response-container">
          <h3 style={{ color: 'black' }}>レスポンス:</h3>
          <pre style={{ color: '#000000 !important', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '4px', border: '2px solid #333' }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
