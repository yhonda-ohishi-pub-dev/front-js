# Tunnel URL Service Worker

Cloudflare Workerを使用して、`ohishi-auth.mtamaramu.com`からTunnel URLリストを取得し、直接接続を提供するサービスです。

## 機能

- **Tunnel URLリストの取得**: `ohishi-auth.mtamaramu.com`からアクティブなトンネルのURLリストを取得
- **Service Binding**: Cloudflare Service Bindingを使用した効率的な内部通信
- **Tunnelプロキシ**: 特定のトンネルIDを指定して直接接続（全HTTPメソッド、ネストされたパス対応）
- **クライアントID制限**: シークレットで許可されたクライアントIDのみアクセス可能
- **トンネルURL保護**: 外部にトンネルURLを公開しない
- **CORS対応**: ブラウザからのアクセスをサポート
- **React UI**: トンネル管理とメソッド実行のためのWebインターフェース（`ui/`ディレクトリ）

## エンドポイント

### GET `/tunnels`
アクティブなトンネルのリストを取得します。

**セキュリティ注意**: トンネルURLは応答から除外されています。

**レスポンス例:**
```json
{
  "success": true,
  "data": [
    {
      "clientId": "gowinproc",
      "updatedAt": 1762082433166,
      "createdAt": 1762082433166
    }
  ],
  "count": 1
}
```

### ALL `/tunnel/:clientId/*`
特定のクライアントIDのトンネルに対してリクエストをプロキシします。

**パラメータ:**
- `clientId`: クライアントID（許可リストに登録されている必要があります）
- `*`: 任意のパスとクエリパラメータ

**例:**
```bash
# ルートページ
GET https://front-js.m-tama-ramu.workers.dev/tunnel/gowinproc

# APIエンドポイント
POST https://front-js.m-tama-ramu.workers.dev/tunnel/gowinproc/api/endpoint

# クエリパラメータ付き
GET https://front-js.m-tama-ramu.workers.dev/tunnel/testclient/resource?key=value
```

**エラーレスポンス:**
- `403 Forbidden`: クライアントIDが許可リストにない場合
- `404 Not Found`: トンネルが見つからない場合
- `500 Internal Server Error`: プロキシ接続に失敗した場合

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Service Bindingの設定
`wrangler.jsonc`で、`cloudflare-auth-worker` Workerへのバインディングが設定されています:

```jsonc
"services": [
  {
    "binding": "AUTH_SERVICE",
    "service": "cloudflare-auth-worker"
  }
]
```

### 3. 許可されたクライアントIDの設定

**本番環境:**
```bash
wrangler secret put ALLOWED_CLIENT_IDS
# 入力: gowinproc,testclient,production-client
```

**ローカル開発環境:**

`.dev.vars` ファイルを作成（gitignore済み）:
```bash
ALLOWED_CLIENT_IDS=gowinproc,testclient
```

### 4. 型定義の生成
```bash
npm run cf-typegen
```

## 開発

### Worker開発サーバーの起動
```bash
npm run dev
```

開発サーバーは `http://localhost:8787` で起動します。

### React UI開発サーバーの起動
```bash
cd ui
npm install
npm run dev
```

UI開発サーバーは `http://localhost:5173` で起動します。

詳細は [`ui/README.md`](ui/README.md) を参照してください。

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

## セキュリティ

### 実装済みのセキュリティ機能

- ✅ **クライアントID制限**: Cloudflareシークレットで管理された許可リストによるアクセス制御
- ✅ **トンネルURL保護**: トンネルURLは外部に公開されず、Auth Worker内でのみ管理
- ✅ **プロキシ経由のみアクセス**: このWorkerを経由しないとトンネルに接続できない設計
- ✅ **CORS対応**: ブラウザアプリケーションからの安全なアクセス

### セキュリティの仕組み

```
Client Request
  ↓
[Client ID Check] ← ALLOWED_CLIENT_IDS シークレット
  ↓ (許可された場合)
[Auth Worker経由でTunnel URL取得]
  ↓
[Tunnel Server]
```

**重要:** トンネルURLは一切外部に公開されません。クライアントIDのみで接続します。

### 追加推奨セキュリティ対策

本番環境でさらにセキュリティを強化する場合:

- **Cloudflare Access**: エンドユーザー認証の追加
- **レート制限**: DDoS対策
- **WAF (Web Application Firewall)**: 攻撃パターンのフィルタリング
- **ログと監視**: Workers Analytics Engineの活用
- **API Key認証**: クライアント側での認証トークン

## 今後の改善予定

- [ ] レート制限の実装
- [ ] エラーハンドリングの強化
- [ ] キャッシング戦略の最適化
- [ ] メトリクスとロギングの強化
- [ ] Cloudflare Accessとの統合

## ライセンス

Private
