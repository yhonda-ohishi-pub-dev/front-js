# Tunnel URL Service Worker

Cloudflare Workerを使用して、`ohishi-auth.mtamaramu.com`からTunnel URLリストを取得し、直接接続を提供するサービスです。

## 機能

- **Tunnel URLリストの取得**: `ohishi-auth.mtamaramu.com`からアクティブなトンネルのURLリストを取得
- **Service Binding**: Cloudflare Service Bindingを使用した効率的な内部通信
- **Tunnelプロキシ**: 特定のトンネルIDを指定して直接接続
- **CORS対応**: ブラウザからのアクセスをサポート

## エンドポイント

### GET `/tunnels`
アクティブなトンネルのリストを取得します。

**レスポンス例:**
```json
{
  "tunnels": [
    {
      "id": "tunnel-123",
      "url": "https://example.cloudflareaccess.com",
      "name": "Production Tunnel",
      "status": "active"
    }
  ]
}
```

### GET `/tunnel/:id`
特定のトンネルIDに対してリクエストをプロキシします。

**パラメータ:**
- `id`: トンネルID

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Service Bindingの設定
`wrangler.jsonc`で、`ohishi-auth` Workerへのバインディングが設定されています:

```jsonc
"services": [
  {
    "binding": "AUTH_SERVICE",
    "service": "ohishi-auth",
    "environment": "production"
  }
]
```

### 3. 型定義の生成
```bash
npm run cf-typegen
```

## 開発

### ローカル開発サーバーの起動
```bash
npm run dev
```

開発サーバーは `http://localhost:8787` で起動します。

### テストの実行
```bash
npm test
```

## デプロイ

```bash
npm run deploy
```

## アーキテクチャ

```
Client
  ↓
front-js Worker (このプロジェクト)
  ↓ (Service Binding)
ohishi-auth.mtamaramu.com
  ↓
Tunnel URLs
```

### Service Bindingの利点
- **低レイテンシ**: Worker間の直接通信により、外部HTTPリクエストより高速
- **コスト削減**: 内部通信は外部リクエストとしてカウントされない
- **セキュリティ**: 外部に公開せずにWorker間で通信可能

## セキュリティに関する注意

現在のバージョンでは、認証とセキュリティ機能は実装されていません。本番環境で使用する前に、以下の対策を実装してください:

- API認証（API Keyまたはトークンベース認証）
- レート制限
- Cloudflare Access統合
- ログと監視

## 今後の改善予定

- [ ] 認証機能の追加
- [ ] レート制限の実装
- [ ] エラーハンドリングの強化
- [ ] キャッシング戦略の最適化
- [ ] メトリクスとロギング

## ライセンス

Private
