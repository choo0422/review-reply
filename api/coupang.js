// api/coupang.js — 쿠팡 파트너스 상품 검색 (HMAC 인증)
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

  let keyword, limit;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    keyword = body?.keyword;
    limit   = Math.min(parseInt(body?.limit || "3"), 10); // 최대 10개
  } catch (e) {
    return res.status(400).json({ error: "요청 형식 오류" });
  }
  if (!keyword) return res.status(400).json({ error: "keyword가 필요합니다." });

  try {
    const METHOD = "GET";
    const PATH   = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
    const QUERY  = `keyword=${encodeURIComponent(keyword)}&limit=${limit}&subId=review-reply`;

    // HMAC datetime: YYMMDDTHHmmssZ (GMT)
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const datetime = `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    const message   = datetime + METHOD + PATH + QUERY;
    const signature = crypto.createHmac("sha256", SECRET_KEY).update(message).digest("hex");
    const authorization = `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    const response = await fetch(`https://api-gateway.coupang.com${PATH}?${QUERY}`, {
      method: "GET",
      headers: { Authorization: authorization, "Content-Type": "application/json;charset=UTF-8" },
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "쿠팡 API 오류", detail: data });
    }

    const products = (data?.data?.productData || []).map(p => ({
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
    return res.status(500).json({ error: "API 호출 실패: " + (e.message || "오류") });
  }
};
