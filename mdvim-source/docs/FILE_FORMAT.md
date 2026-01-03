# mdvim ファイル形式仕様

**バージョン: 0.8.1**  
**最終更新: 2025-01-03**

## 概要

mdvimは2つのファイル形式でドキュメントを保存します：

| 形式 | 拡張子 | 用途 |
|------|--------|------|
| **mdvimプロジェクト** | `.mdvim` | 画像を含むドキュメント |
| **単一Markdown** | `.md` | 画像のないドキュメント |

`.mdvim`形式はMarkdownファイル、画像、マニフェストファイルを含むZIPアーカイブです。

---

## .mdvim形式

### 構造

```
document.mdvim (ZIPアーカイブ)
├── manifest.json          # プロジェクトメタデータ
├── content.md             # Markdownコンテンツ
└── images/                # 画像ディレクトリ
    ├── image1.png
    ├── photo.jpg
    └── ...
```

### manifest.json

```json
{
  "version": "0.8.1",
  "app": "mdvim",
  "created": "2025-01-03T12:00:00.000Z",
  "metadata": {
    "title": "ドキュメントタイトル",
    "author": "著者名",
    "language": "ja"
  },
  "content": "content.md",
  "images": [
    "image1.png",
    "photo.jpg"
  ]
}
```

### マニフェストフィールド

#### ルートフィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `version` | string | はい | mdvimバージョン |
| `app` | string | はい | 常に `"mdvim"` |
| `created` | string | はい | ISO 8601形式の作成日時 |
| `metadata` | object | はい | ドキュメントメタデータ |
| `content` | string | はい | コンテンツファイル名（通常 `"content.md"`） |
| `images` | string[] | はい | 画像ファイル名のリスト |

#### メタデータフィールド

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `title` | string | はい | ドキュメントタイトル |
| `author` | string | いいえ | 著者名 |
| `language` | string | はい | 言語コード (`en`, `ja`, `zh`, `es`, `ko`) |

### 画像参照

Markdownコンテンツ内での画像参照形式：

```markdown
![代替テキスト](images/filename.png)
```

### サポート画像形式

| 形式 | MIMEタイプ | 拡張子 |
|------|-----------|--------|
| PNG | image/png | .png |
| JPEG | image/jpeg | .jpg, .jpeg |
| GIF | image/gif | .gif |
| WebP | image/webp | .webp |
| SVG | image/svg+xml | .svg |
| BMP | image/bmp | .bmp |

---

## MDebook互換性

### mdvim → MDebook インポート

MDebookがmdvimファイルをインポートする際の処理：

```javascript
async function importMdvim(file) {
  const zip = await JSZip.loadAsync(file);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  
  // メタデータを取得
  const metadata = {
    title: manifest.metadata?.title || file.name.replace('.mdvim', ''),
    author: manifest.metadata?.author || '',
    language: manifest.metadata?.language || 'ja'
  };
  
  // コンテンツを取得
  const contentFile = manifest.content || 'content.md';
  const content = await zip.file(contentFile).async('string');
  
  // 画像を取得
  const images = new Map();
  for (const [path, entry] of Object.entries(zip.files)) {
    if (path.startsWith('images/') && !entry.dir) {
      const name = path.replace('images/', '');
      const data = await entry.async('base64');
      images.set(name, data);
    }
  }
  
  return { metadata, content, images };
}
```

### MDebook → mdvim エクスポート

MDebookがmdvim形式でエクスポートする際の処理：

```javascript
async function exportToMdvim(project) {
  const zip = new JSZip();
  
  // 複数章を結合
  const combinedContent = project.chapters
    .map(ch => ch.content)
    .join('\n\n---\n\n');
  
  // manifest.jsonを作成
  const manifest = {
    version: '0.8.1',
    app: 'mdvim',
    created: new Date().toISOString(),
    metadata: {
      title: project.metadata.title,
      author: project.metadata.author,
      language: project.metadata.language
    },
    content: 'content.md',
    images: Array.from(project.images.keys())
  };
  
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('content.md', combinedContent);
  
  // 画像を追加
  const imagesFolder = zip.folder('images');
  project.images.forEach((data, name) => {
    imagesFolder.file(name, data, { base64: true });
  });
  
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
```

---

## 後方互換性

mdvimは旧形式のmanifest.jsonも読み込み可能です：

### 旧形式（v1.0以前）

```json
{
  "version": "1.0",
  "app": "mdvim",
  "created": "2025-01-03T12:00:00.000Z"
}
```

旧形式の場合：
- `metadata`がない場合はファイル名からタイトルを取得
- `content`がない場合は`"content.md"`を使用
- `images`がない場合は`images/`フォルダを走査

---

## 圧縮

`.mdvim` ZIPアーカイブはDEFLATE圧縮を使用します。

---

## MIMEタイプ

| 形式 | MIMEタイプ |
|------|-----------|
| .mdvim | application/x-mdvim |
| .md | text/markdown |
