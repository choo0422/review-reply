// api/coupang.js — 쿠팡 파트너스 상품 검색 (HMAC 인증)
// 공식 문서 datetime 형식: YYMMDDTHHMMSSZ (GMT 기준)
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
  const SECRET_KEY = process.env.COUPANG_SECRET_KEY;

  if (!ACCESS_KEY || !SECRET_KEY) {
    return res.status(500).json({ error: "쿠팡 API 키가 설정되지 않았습니다." });
  }

  let keyword;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    keyword = body?.keyword;
  } catch (e) {
    return res.status(400).json({ error: "요청 형식 오류" });
  }

  if (!keyword) return res.status(400).json({ error: "keyword가 필요합니다." });

  try {
    const METHOD = "GET";
    const PATH   = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
    const QUERY  = `keyword=${encodeURIComponent(keyword)}&limit=3&subId=review-reply`;

    // HMAC datetime: YYMMDDTHHmmssZ (GMT, 쿠팡 공식 형식)
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const YY  = String(now.getUTCFullYear()).slice(2);
    const MM  = pad(now.getUTCMonth() + 1);
    const DD  = pad(now.getUTCDate());
    const HH  = pad(now.getUTCHours());
    const mm  = pad(now.getUTCMinutes());
    const ss  = pad(now.getUTCSeconds());
    const datetime = `${YY}${MM}${DD}T${HH}${mm}${ss}Z`;

    // 서명: datetime + METHOD + PATH + QUERY
    const message   = datetime + METHOD + PATH + QUERY;
    const signature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(message)
      .digest("hex");

    const authorization =
      `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    const url = `https://api-gateway.coupang.com${PATH}?${QUERY}`;

    console.log("[coupang] keyword:", keyword, "/ datetime:", datetime);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json;charset=UTF-8",
      },
    });

    const data = await response.json();
    console.log("[coupang] status:", response.status);

    if (!response.ok) {
      console.error("[coupang] 오류:", JSON.stringify(data));
      return res.status(response.status).json({
        error: data.message || data.error || `쿠팡 API ${response.status}`,
        detail: data,
      });
    }

    const raw = data?.data?.productData || [];
    const products = raw.slice(0, 3).map(p => ({
      productId:    p.productId,
      productName:  p.productName,
      productPrice: p.productPrice,
      productImage: p.productImage,
      productUrl:   p.productUrl,
      isRocket:     p.isRocket,
      rating:       p.productRating,
    }));

    return res.status(200).json({ products });

  } catch (e) {
    console.error("[coupang] 서버 오류:", e);
    return res.status(500).json({ error: "API 호출 실패: " + (e.message || "오류") });
  }
};
