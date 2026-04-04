module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: { message: "API 키 없음" } });

  let messages;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    messages = body?.messages;
  } catch (e) {
    return res.status(400).json({ error: { message: "요청 형식 오류" } });
  }
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: { message: "messages 배열 필요" } });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: { message: data?.error?.message || "API 오류" } });
    }
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: { message: "연결 실패: " + (e.message || "오류") } });
  }
};
