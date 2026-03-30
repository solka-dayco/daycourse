-- schema_R6_security.sql — v4.32 보안 강화 (멱등성 보장)

-- ── 1. event_logs rate limit RLS ─────────────────────────
-- 동일 anonymous_id 기준 1분에 100건 초과 시 INSERT 차단
DROP POLICY IF EXISTS "rate_limit_event_logs" ON public.event_logs;

CREATE POLICY "rate_limit_event_logs"
ON public.event_logs
FOR INSERT
WITH CHECK (
  (
    SELECT COUNT(*)
    FROM public.event_logs
    WHERE anonymous_id = NEW.anonymous_id
    AND created_at > NOW() - INTERVAL '1 minute'
  ) < 100
);

-- ── 2. Storage 업로드 제한 ────────────────────────────────
-- course-photos 버킷: 5MB 이하, 이미지 MIME 타입만 허용
-- Supabase Dashboard → Storage → Policies에서 직접 적용 필요
-- 아래 정책을 참고하여 적용하세요.

/*
CREATE POLICY "restrict_upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'course-photos'
  AND auth.role() = 'authenticated'
  AND (metadata->>'size')::int < 5242880
  AND (metadata->>'mimetype') IN (
    'image/jpeg',
    'image/webp',
    'image/png'
  )
);
*/