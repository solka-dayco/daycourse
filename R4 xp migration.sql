-- R4 레벨 및 경험치 시스템 마이그레이션
-- 적용일: 2026.03.26

-- 1-1. 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_xp integer NOT NULL DEFAULT 0;

-- 1-2. 레벨 계산 함수
CREATE OR REPLACE FUNCTION calculate_level(xp integer)
RETURNS integer AS $$
DECLARE
  thresholds integer[] := ARRAY[0,1000,2000,3000,4000,5000,6250,7500,8750,10000,
    13500,17000,20500,24000,27500,31250,35000,38750,42500,46250,
    51250,56250,61250,66250,71250,77500,83750,90000,96250,102500,
    113000,123500,134000,144500,155000,167000,179000,191000,203000,215000,
    239000,263000,287000,311000,335000,361000,387000,413000,439000,465000,
    999999999];
  i integer;
BEGIN
  FOR i IN 1..50 LOOP
    IF xp < thresholds[i+1] THEN RETURN i; END IF;
  END LOOP;
  RETURN 50;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1-3. XP 부여 RPC
CREATE OR REPLACE FUNCTION add_user_xp(p_user_id uuid, p_delta integer)
RETURNS void AS $$
DECLARE
  new_xp integer;
  new_level integer;
BEGIN
  UPDATE users
  SET user_xp = GREATEST(0, user_xp + p_delta)
  WHERE id = p_user_id
  RETURNING user_xp INTO new_xp;

  new_level := calculate_level(new_xp);

  UPDATE users SET level = new_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1-4. 일일 XP cap 체크 함수 (북마크/공유용)
CREATE OR REPLACE FUNCTION add_user_xp_capped(
  p_user_id uuid,
  p_delta integer,
  p_action text,
  p_daily_cap integer
)
RETURNS void AS $$
DECLARE
  today_count integer;
BEGIN
  SELECT COUNT(*) INTO today_count
  FROM event_logs
  WHERE user_id = p_user_id
    AND event_name = p_action
    AND created_at >= CURRENT_DATE;

  IF today_count < p_daily_cap THEN
    PERFORM add_user_xp(p_user_id, p_delta);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;