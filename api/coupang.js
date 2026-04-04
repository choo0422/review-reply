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

  let keyword;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    keyword = body?.keyword;
  } catch (e) {
    return res.status(400).json({ error: "요청 형식 오류" });
  }

  if (!keyword) return res.status(400).json({ error: "keyword가 필요합니다." });

  try {
    const method = "GET";
    const path = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
    const query = `keyword=${encodeURIComponent(keyword)}&limit=3&subId=review-reply`;

    // HMAC 서명 생성
    const datetime = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z/, "Z")
      .slice(2, 17) + "Z";  // YYMMDDTHHmmssZ 형식

    const message = datetime + method + path + query;
    const signature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(message)
      .digest("hex");

    const authorization = `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;

    const url = `https://api-gateway.coupang.com${path}?${query}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json;charset=UTF-8",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("쿠팡 API 오류:", data);
      return res.status(response.status).json({ error: data.message || "쿠팡 API 오류" });
    }

    // 상품 데이터 정리해서 반환
    const products = (data.data?.productData || []).slice(0, 3).map(p => ({
      productId: p.productId,
      productName: p.productName,
      productPrice: p.productPrice,
      productImage: p.productImage,
      productUrl: p.productUrl,   // 파트너스 링크 (이미 내 링크로 생성됨)
      isRocket: p.isRocket,
      rating: p.productRating,
    }));

    return res.status(200).json({ products });

  } catch (e) {
    console.error("서버 오류:", e);
    return res.status(500).json({ error: "API 호출 실패: " + (e.message || "오류") });
  }
};
