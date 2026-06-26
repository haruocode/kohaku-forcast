-- ローカル開発用のシードデータ。
-- 適用: pnpm db:seed:local（= wrangler d1 execute kohaku-db --local --file ./seed.sql）
-- 何度実行しても重複しないよう INSERT OR IGNORE を使う。

-- 受付中シーズン（prediction_close_at = NULL = 受付中）
INSERT OR IGNORE INTO seasons (id, year, title, prediction_open_at, prediction_close_at, result_confirmed_at, created_at, updated_at)
VALUES ('season-2026', 2026, '第77回紅白歌合戦', '2026-11-01T00:00:00.000Z', NULL, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- アーティスト
INSERT OR IGNORE INTO artists (id, name, name_kana, gender_group, official_url, created_at, updated_at) VALUES
  ('artist-yonezu', '米津玄師', 'よねづけんし', '白', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('artist-aimyon', 'あいみょん', 'あいみょん', '紅', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('artist-higedan', 'Official髭男dism', 'おふぃしゃるひげだんでぃずむ', '白', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('artist-backnumber', 'back number', 'ばっくなんばー', '白', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('artist-misia', 'MISIA', 'みーしゃ', '紅', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('artist-ringo', '椎名林檎', 'しいなりんご', '紅', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- 別名
INSERT OR IGNORE INTO artist_aliases (id, artist_id, alias, created_at, updated_at) VALUES
  ('alias-hachi', 'artist-yonezu', 'ハチ', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('alias-kenshi', 'artist-yonezu', 'Kenshi Yonezu', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('alias-higedan', 'artist-higedan', 'ヒゲダン', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- 曲
INSERT OR IGNORE INTO songs (id, artist_id, title, title_kana, release_year, created_at, updated_at) VALUES
  ('song-lemon', 'artist-yonezu', 'Lemon', 'れもん', 2018, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('song-kickback', 'artist-yonezu', 'KICK BACK', 'きっくばっく', 2022, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('song-marigold', 'artist-aimyon', 'マリーゴールド', 'まりーごーるど', 2018, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('song-pretender', 'artist-higedan', 'Pretender', 'ぷりてんだー', 2019, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('song-suiheisen', 'artist-backnumber', '水平線', 'すいへいせん', 2020, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
