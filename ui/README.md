# Tunnel Manager UI

Cloudflare Worker Tunnel ProxyのためのReact UIです。トンネル管理とメソッド実行のためのインターフェースを提供します。

## 機能

- **トンネルリスト表示**: 利用可能なトンネルの一覧を表示
- **トンネル選択**: クライアントIDでトンネルを選択
- **メソッド実行**: 以下のリクエストタイプをサポート
  - HTTP GET
  - HTTP POST
  - gRPC-Web
  - カスタムリクエスト（任意のHTTPメソッド、ヘッダー）

## セットアップ

### 環境変数の設定

`.env`ファイルを作成し、Worker URLを設定します:

```bash
VITE_WORKER_URL=https://front-js.m-tama-ramu.workers.dev
```

### 依存関係のインストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

開発サーバーは `http://localhost:5173` で起動します。

### プロダクションビルド

```bash
npm run build
```

ビルドされたファイルは `dist/` ディレクトリに出力されます。

## 使い方

### 1. トンネルの選択

左側のパネルから接続したいトンネルをクリックして選択します。

### 2. リクエストタイプの選択

右側のパネルで実行したいリクエストタイプを選択します:

#### HTTP GET
- **パス**: リクエストするパス（例: `/api/data?key=value`）
- シンプルなGETリクエストを実行

#### HTTP POST
- **パス**: リクエストするパス
- **リクエストボディ**: JSON形式のデータ

#### gRPC-Web
- **サービス名**: gRPCサービス名（例: `myservice.MyService`）
- **メソッド名**: gRPCメソッド名（例: `GetData`）
- **リクエストボディ**: JSON形式のリクエストデータ

#### カスタムリクエスト
- **HTTPメソッド**: GET, POST, PUT, DELETE など任意のメソッド
- **パス**: リクエストするパス
- **ヘッダー**: JSON形式のカスタムヘッダー
- **リクエストボディ**: リクエストデータ（GETメソッド以外）

### 3. 実行

「実行」ボタンをクリックしてリクエストを送信します。レスポンスは下部に表示されます。

## アーキテクチャ

```
React UI (localhost:5173)
  ↓ HTTP Request
Front-JS Worker (front-js.m-tama-ramu.workers.dev)
  ↓ Service Binding
Auth Worker (ohishi-auth.mtamaramu.com)
  ↓ Proxy
Cloudflare Tunnel
  ↓
Backend Service
```

## 開発

### ディレクトリ構造

```
ui/
├── src/
│   ├── api/
│   │   └── client.ts        # Worker APIクライアント
│   ├── components/
│   │   ├── TunnelList.tsx   # トンネルリストコンポーネント
│   │   └── MethodExecutor.tsx # メソッド実行コンポーネント
│   ├── App.tsx              # メインアプリケーション
│   ├── App.css              # スタイリング
│   └── main.tsx             # エントリーポイント
├── .env                     # 環境変数
└── package.json
```

### APIクライアント

`src/api/client.ts`では以下の関数を提供しています:

- `fetchTunnels()`: トンネルリストを取得
- `getTunnelData()`: HTTP GETリクエスト
- `postTunnelData()`: HTTP POSTリクエスト
- `executeGrpcWebRequest()`: gRPC-Webリクエスト
- `executeTunnelRequest()`: カスタムリクエスト

## セキュリティ

- すべてのリクエストはCloudflare Workerを経由
- クライアントID制限によりアクセス制御
- トンネルURLは外部に公開されない

## トラブルシューティング

### CORS エラー

Worker側でCORSが適切に設定されていることを確認してください。

### 接続エラー

1. Worker URLが正しく設定されているか確認
2. トンネルが実際にアクティブか確認
3. クライアントIDが許可リストに含まれているか確認

## ライセンス

Private
