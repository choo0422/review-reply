// api/reply.js - Vercel Serverless Function
// Anthropic API 프록시 - API 키 보안 유지

export const config = {
  maxDuration: 60, // 최대 60초 (이미지 처리 포함)
};

export default async function handler(req, res) {
  // ── CORS 헤더 ──────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // POST만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  // ── API 키 확인 ────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
    return res.status(500).json({
      error: { message: "서버 설정 오류: API 키가 없습니다. Vercel 환경변수를 확인해주세요." }
    });
  }

  // ── 요청 바디 파싱 ─────────────────────────────────────────
  let messages;
  try {
    // Vercel은 기본적으로 req.body를 파싱하지만, 혹시 모를 경우 대비
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    messages = body?.messages;
  } catch (e) {
    return res.status(400).json({ error: { message: "요청 형식이 잘못되었습니다." } });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: "messages 배열이 필요합니다." } });
  }

  // ── Anthropic API 호출 ─────────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // 빠르고 저렴한 모델
        max_tokens: 1024,
        messages: messages,
      }),
    });

    // Anthropic 응답 파싱
    const data = await response.json();

    if (!response.ok) {
      // Anthropic 에러 메시지 전달
      const errMsg = data?.error?.message || `Anthropic API 오류 (${response.status})`;
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({ error: { message: errMsg } });
    }

    // 성공 응답
    return res.status(200).json(data);

  } catch (e) {
    console.error("API 호출 실패:", e);
    return res.status(500).json({
      error: { message: "API 연결 실패: " + (e.message || "알 수 없는 오류") }
    });
  }
}
