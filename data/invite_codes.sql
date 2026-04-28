-- ============================================================
-- 邀請碼系統 — 在 Supabase SQL Editor 執行此檔案
-- ============================================================

-- 1. 建表
CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT PRIMARY KEY,
  used        BOOLEAN      NOT NULL DEFAULT FALSE,
  used_by     TEXT,                          -- 使用者 email
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. 啟用 Row Level Security（客戶端無法直接讀寫）
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- 3. 不建任何 client 可用的 policy：所有操作都走 RPC（SECURITY DEFINER）

-- 4. RPC：原子性核驗並消耗邀請碼
--    返回 TRUE  = 成功（碼有效且未被使用，已標記為已用）
--    返回 FALSE = 失敗（碼不存在或已被使用）
CREATE OR REPLACE FUNCTION consume_invite_code(p_code TEXT, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER          -- 以 DB owner 身份執行，繞過 RLS
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE invite_codes
  SET
    used     = TRUE,
    used_by  = p_email,
    used_at  = NOW()
  WHERE code = p_code
    AND used = FALSE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 5. 插入 100 個預生成邀請碼
INSERT INTO invite_codes (code) VALUES
('26G2CMTR'),
('27SHQYTD'),
('2JRZZD2V'),
('2KKMLC66'),
('2LY9QQ8P'),
('2LYMSEYY'),
('2WNCA336'),
('336YG8W2'),
('34FWZ2LJ'),
('3DS284BN'),
('4JHC7A9M'),
('4U6LEWES'),
('4UK2DHWY'),
('6298SKH6'),
('6APZ2B8D'),
('6JAQCFWA'),
('6L3CKM6B'),
('73YQWL88'),
('76EMZ2Q8'),
('8BYVWCWV'),
('97B85SSM'),
('9G9EWUJR'),
('9U7ECV3B'),
('9WWLEK6L'),
('ADCRQ5FW'),
('AJCHFFJY'),
('AVHEW6XM'),
('AYZ9LXEB'),
('BQLWMBQS'),
('E4TQXULH'),
('E8Z6AZXS'),
('EVFCSNVX'),
('EXECH4D9'),
('EXP2KR82'),
('FCATKSZU'),
('G4W3HZJC'),
('GDZK5Y4C'),
('H49NW4R4'),
('HFZJLPXB'),
('HJBZXLA8'),
('HKQ29VSS'),
('HMA64EYR'),
('HRT4BZV5'),
('HUHRYF7T'),
('J3786HDG'),
('J3EJEZ7P'),
('J98WCBL5'),
('JCJ793BA'),
('JD7EKV7J'),
('K2WYHCHU'),
('KD97XGFM'),
('KJ4N3UGE'),
('KXJSUGMR'),
('L7AKADJ9'),
('LAVC5MQQ'),
('LPR7YACQ'),
('LVNJZSWX'),
('LW68WWSS'),
('M2963A3C'),
('M8AWVDYB'),
('M9MH45GR'),
('MCYFUKAR'),
('MNANFQFC'),
('NH4HZY2X'),
('NVUW59V3'),
('P5YC3AMG'),
('PBJGDF7C'),
('PCTG6GAL'),
('PEGJY93Y'),
('QC5VDF42'),
('QG9MLCXP'),
('QLL5H6BS'),
('QSCDF3PU'),
('QSJAJ567'),
('QXEM5VPE'),
('RLJCS4N4'),
('RRQL5QZ9'),
('RYTHCPHG'),
('S42JZERP'),
('S8KTWRT3'),
('SRBARSUZ'),
('U84F6H3R'),
('UMGLH3KG'),
('UUREKAZU'),
('VNDYCZG7'),
('WRG2D29C'),
('WW98LWFL'),
('WW9FXKLH'),
('XB74AW4B'),
('XD5VZCQB'),
('XFDDAL77'),
('XPLSCAVH'),
('Y4FWVLN7'),
('YC4WTWPB'),
('YZ2H9U8A'),
('Z9XDXD4X'),
('ZE279UWB'),
('ZF7G35ME'),
('ZN8W6GFM'),
('ZWDQP469')
ON CONFLICT (code) DO NOTHING;
