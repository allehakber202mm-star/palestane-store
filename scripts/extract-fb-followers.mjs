import http from "node:http";

const GEMINI_BASE = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const GEMINI_KEY  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const DB_URL      = process.env.DATABASE_URL;

const accounts = [
  { id: 29, url: "/api/storage/objects/uploads/424d051d-f370-4f9f-84dc-eb7935ddeed4" },
  { id: 34, url: "/api/storage/objects/uploads/5d5d065f-5576-4476-abb1-585c4d3d718c" },
  { id: 35, url: "/api/storage/objects/uploads/3d857ca2-32f4-4b22-a82f-7f38163b9042" },
  { id: 38, url: "/api/storage/objects/uploads/0b865c27-dd6c-4598-afa3-a0066f840c39" },
  { id: 39, url: "/api/storage/objects/uploads/dde6f285-53cc-45b9-a017-81229f06cd35" },
  { id: 40, url: "/api/storage/objects/uploads/c60b1a12-2b60-4c9d-a5f5-f14bc478e33a" },
  { id: 41, url: "/api/storage/objects/uploads/0c4a6b08-8798-4e37-9a8b-25bb4ee69330" },
  { id: 43, url: "/api/storage/objects/uploads/f10a19de-fff3-4dd6-823e-6ccb4e9081ed" },
  { id: 44, url: "/api/storage/objects/uploads/2a4c5fbc-b236-4003-8f2d-e9c8cd4b23ac" },
  { id: 45, url: "/api/storage/objects/uploads/9fe6cbdb-2486-4dbd-ab0a-b598670075ff" },
  { id: 46, url: "/api/storage/objects/uploads/59b82d04-5f49-4d0a-b943-d0ac092607bd" },
  { id: 47, url: "/api/storage/objects/uploads/74dab067-8dea-4c74-a9c9-951423d2f8e5" },
  { id: 48, url: "/api/storage/objects/uploads/94fb3e40-419e-4ef6-9465-b20a67d09297" },
  { id: 49, url: "/api/storage/objects/uploads/6b233ab8-6122-4bb8-99c0-62e6cbaa1fa1" },
  { id: 50, url: "/api/storage/objects/uploads/d0e7425a-49a4-4bf4-8d5b-f674d0f68cec" },
  { id: 51, url: "/api/storage/objects/uploads/be90d557-cc78-45fe-b931-6863757c15a5" },
];

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    http.get({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), ct: res.headers["content-type"] }));
    }).on("error", reject);
  });
}

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(urlStr);
    const data = JSON.stringify(body);
    const req  = http.request({
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { resolve({}); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

const results = [];

for (const acc of accounts) {
  try {
    // 1. Download image from API server
    const img = await httpGet(`http://localhost:8080${acc.url}`);
    if (img.status !== 200) {
      console.log(`❌ ID ${acc.id}: HTTP ${img.status}`);
      results.push({ id: acc.id, followers: null });
      continue;
    }

    const base64 = img.buffer.toString("base64");
    const mime   = img.ct || "image/jpeg";

    // 2. Ask Gemini Vision
    const geminiUrl = `${GEMINI_BASE}/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
    const resp = await httpPost(geminiUrl, {
      contents: [{ parts: [
        { inline_data: { mime_type: mime, data: base64 } },
        { text: "Look at this Facebook page screenshot. Find the number of followers or likes for this page. Return ONLY the plain number (e.g. 15000). If you see K multiply by 1000. If you see ألف multiply by 1000. Return 0 if not found." }
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: 20 }
    });

    const text      = resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "0";
    const followers = parseInt(text.replace(/[^0-9]/g, ""), 10) || 0;
    console.log(`✅ ID ${acc.id}: "${text}" → ${followers.toLocaleString()}`);
    results.push({ id: acc.id, followers });
  } catch (e) {
    console.log(`❌ ID ${acc.id}: ${e.message}`);
    results.push({ id: acc.id, followers: null });
  }
}

// 3. Update DB using psql for each found follower count
console.log("\n📊 النتائج:", JSON.stringify(results, null, 2));

// Build UPDATE statements
const updates = results.filter(r => r.followers && r.followers > 0);
if (updates.length > 0) {
  const cases  = updates.map(r => `WHEN id = ${r.id} THEN ${r.followers}`).join(" ");
  const ids    = updates.map(r => r.id).join(",");
  const sql    = `UPDATE accounts SET followers = CASE ${cases} END WHERE id IN (${ids}) RETURNING id, followers;`;
  console.log("\n🔄 SQL:", sql);

  // Write SQL to file for psql
  import("node:fs").then(fs => fs.writeFileSync("/tmp/update_followers.sql", sql));
}
