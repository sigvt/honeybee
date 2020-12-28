# 収集

- [x] VideoID が入る Redis キューを監視するワーカークラスターを常時起動
  - TypeScript CLI でアクションを整理
  - [x] MongoDB に記録
- [x] 15 分ごとに配信中&配信枠のライブ URL を取得しキューに追加
- 定期的に DB 内 の重複アクションを削除

# 整形

- [x] カスタム絵文字は`:EMOJI NAME:`に置換
- スペルミスはそれ自体がミームの可能性があるので修正しない

## ラベル

- [x] binary spam flag (inbalanced data problem)
- toxiticy 0.0 -> 1.0
- [ ] prodigy で手動ラベリング

# 学習

- 本文をどのようにしてベクター化するか？
  - [x] SentenceTransformer (BERT)
    - Pre-trained model はあまり上手くスパムを分離できていない
    - Finetune する必要あり

# 展開

- ブラウザーだけで完結したい

- ライバー
  1. OBS オーバーレイ用 URL
  2. コメント確認用 Deck
  3. フィルタールール作成
- モデレーター
  - オフラインアノテーション
    - 自動 BAN の承認
  - リアルタイムアノテーション
    - BAN (YouTube API) + フラグ
    - フラグ
- マネージャー
  - コメント統計

Web と Electron はコンポーネント共通化

# References

- [bert で知る炎上とブランドイメージの関係 - にほんごのれんしゅう](https://catindog.hatenablog.com/entry/2021/02/07/180720)
- [huggingface japanese – /var/log/機械学習.gz](https://gink03.github.io/huggingface_japanese/)
