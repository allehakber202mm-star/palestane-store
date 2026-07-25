import http from "node:http";
import crypto from "node:crypto";

const accounts = [
  {id:29,url:"/api/storage/objects/uploads/424d051d-f370-4f9f-84dc-eb7935ddeed4",platform:"facebook"},
  {id:34,url:"/api/storage/objects/uploads/5d5d065f-5576-4476-abb1-585c4d3d718c",platform:"facebook"},
  {id:35,url:"/api/storage/objects/uploads/3d857ca2-32f4-4b22-a82f-7f38163b9042",platform:"facebook"},
  {id:38,url:"/api/storage/objects/uploads/0b865c27-dd6c-4598-afa3-a0066f840c39",platform:"facebook"},
  {id:39,url:"/api/storage/objects/uploads/dde6f285-53cc-45b9-a017-81229f06cd35",platform:"facebook"},
  {id:40,url:"/api/storage/objects/uploads/c60b1a12-2b60-4c9d-a5f5-f14bc478e33a",platform:"facebook"},
  {id:41,url:"/api/storage/objects/uploads/0c4a6b08-8798-4e37-9a8b-25bb4ee69330",platform:"facebook"},
  {id:43,url:"/api/storage/objects/uploads/f10a19de-fff3-4dd6-823e-6ccb4e9081ed",platform:"facebook"},
  {id:44,url:"/api/storage/objects/uploads/2a4c5fbc-b236-4003-8f2d-e9c8cd4b23ac",platform:"facebook"},
  {id:45,url:"/api/storage/objects/uploads/9fe6cbdb-2486-4dbd-ab0a-b598670075ff",platform:"facebook"},
  {id:46,url:"/api/storage/objects/uploads/59b82d04-5f49-4d0a-b943-d0ac092607bd",platform:"facebook"},
  {id:47,url:"/api/storage/objects/uploads/74dab067-8dea-4c74-a9c9-951423d2f8e5",platform:"facebook"},
  {id:48,url:"/api/storage/objects/uploads/94fb3e40-419e-4ef6-9465-b20a37d09297",platform:"facebook"},
  {id:49,url:"/api/storage/objects/uploads/6b233ab8-6122-4bb8-99c0-62e6cbaa1fa1",platform:"facebook"},
  {id:50,url:"/api/storage/objects/uploads/d0e7425a-49a4-4bf4-8d5b-f674d0f68cec",platform:"facebook"},
  {id:51,url:"/api/storage/objects/uploads/be90d557-cc78-45fe-b931-6863735c15a5",platform:"facebook"},
  {id:53,url:"/api/storage/objects/uploads/58cd081e-4b33-434b-8c62-cce87cc2d89e",platform:"facebook"},
  {id:54,url:"/api/storage/objects/uploads/0af37693-6610-4a07-8f48-72e81dd800ba",platform:"facebook"},
  {id:55,url:"/api/storage/objects/uploads/1dc3f11d-8b95-4259-ba86-87e3e4a2010d",platform:"facebook"},
  {id:56,url:"/api/storage/objects/uploads/46b97067-7291-436b-94da-df33b915d479",platform:"facebook"},
  {id:58,url:"/api/storage/objects/uploads/f5a74e21-eff5-4a00-b90f-5a1826c53fbb",platform:"facebook"},
  {id:59,url:"/api/storage/objects/uploads/ba472f9f-6ee2-43d7-b473-c9a0c3bc0ccc",platform:"facebook"},
  {id:60,url:"/api/storage/objects/uploads/71123781-373c-4bc7-9d2d-3d7e5480c1e1",platform:"facebook"},
  {id:62,url:"/api/storage/objects/uploads/2a8dd6ee-4ae3-49a9-8c8f-3f99a5282684",platform:"facebook"},
  {id:109,url:"/api/storage/objects/uploads/83316f36-dee2-49b9-b49d-34b4d32eea8f",platform:"snapchat"},
  {id:122,url:"/api/storage/objects/uploads/46200b45-7fb8-4dd6-9fa8-5f364a4fcd04",platform:"snapchat"},
  {id:123,url:"/api/storage/objects/uploads/13d65cef-d2bc-4801-b138-48b19fd65847",platform:"snapchat"},
  {id:124,url:"/api/storage/objects/uploads/014df460-826d-4fd9-989b-310d8f78d298",platform:"snapchat"},
  {id:126,url:"/api/storage/objects/uploads/f702cafa-c67c-4bff-8c5d-b52c3fab2f86",platform:"snapchat"},
  {id:14,url:"/api/storage/objects/uploads/4e3d3c7f-b823-4ab4-92a4-618b88a3a0b2",platform:"tiktok"},
  {id:15,url:"/api/storage/objects/uploads/85935e5d-c5b7-40e7-bb29-10510f06653a",platform:"tiktok"},
  {id:20,url:"/api/storage/objects/uploads/cec3736d-29e8-4645-a5ee-c0387398a053",platform:"tiktok"},
  {id:65,url:"/api/storage/objects/uploads/ac130931-3410-4a32-a566-6a87884d535d",platform:"tiktok"},
  {id:68,url:"/api/storage/objects/uploads/486ae201-41c5-4c2c-ba51-eed2ea12c97b",platform:"tiktok"},
  {id:69,url:"/api/storage/objects/uploads/f814eb6d-e18f-4e74-a98b-175c65e5b29f",platform:"tiktok"},
  {id:71,url:"/api/storage/objects/uploads/3aee1b4d-1f9f-4fa6-aeb1-f701172878a5",platform:"tiktok"},
  {id:72,url:"/api/storage/objects/uploads/290ea278-f735-4996-bf70-5e622fb34e00",platform:"tiktok"},
  {id:73,url:"/api/storage/objects/uploads/da1210d6-e827-4bbe-b858-06c89aad183d",platform:"tiktok"},
  {id:128,url:"/api/storage/objects/uploads/d2d1a8d5-ff8e-4204-a577-b06a56cb0348",platform:"tiktok"},
  {id:129,url:"/api/storage/objects/uploads/29284879-6cf0-474f-9b7b-12134eeffad9",platform:"tiktok"},
  {id:130,url:"/api/storage/objects/uploads/18db864c-c6c6-4646-94fe-67f0500aeaad",platform:"tiktok"},
  {id:17,url:"/api/storage/objects/uploads/914cb2d3-8396-48ac-85b9-8991344ba5b0",platform:"tiktok_monetized"},
  {id:18,url:"/api/storage/objects/uploads/cd53a87c-2ba3-4153-b30d-4cf11510626f",platform:"tiktok_monetized"},
  {id:61,url:"/api/storage/objects/uploads/eccdcd34-4a06-461a-ab82-79230a669347",platform:"tiktok_monetized"},
  {id:63,url:"/api/storage/objects/uploads/9ab9ef22-2394-4418-b9fe-f49544e509d2",platform:"tiktok_monetized"},
  {id:66,url:"/api/storage/objects/uploads/d1e1f396-f4a1-4d8c-af37-08a7ceda2548",platform:"tiktok_monetized"},
  {id:74,url:"/api/storage/objects/uploads/2d7f6159-58a8-4649-bf04-5030653d9a5b",platform:"tiktok_monetized"},
  {id:108,url:"/api/storage/objects/uploads/1adb60de-873a-4b86-86d7-3ff99079c47a",platform:"tiktok_monetized"},
  {id:125,url:"/api/storage/objects/uploads/8ba40525-354f-4ada-8b2a-7ab75b043aa9",platform:"tiktok_monetized"},
  {id:131,url:"/api/storage/objects/uploads/aebf256a-20e4-4a82-8bd0-f4a5b81ddbc5",platform:"tiktok_monetized"},
  {id:132,url:"/api/storage/objects/uploads/639a3791-39f0-44c4-b740-183a6371d746",platform:"tiktok_monetized"},
];

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    http.get({ hostname: u.hostname, port: u.port || 80, path: u.pathname }, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
    }).on("error", reject);
  });
}

// Download in batches of 10
const BATCH = 10;
const results = [];
for (let i = 0; i < accounts.length; i += BATCH) {
  const batch = accounts.slice(i, i + BATCH);
  const settled = await Promise.allSettled(
    batch.map(async (acc) => {
      const res = await httpGet(`http://localhost:8080${acc.url}`);
      const hash = res.status === 200
        ? crypto.createHash("md5").update(res.buffer).digest("hex")
        : `FAIL-${res.status}`;
      return { ...acc, hash, size: res.buffer.length };
    })
  );
  for (const s of settled) {
    if (s.status === "fulfilled") results.push(s.value);
    else results.push({ hash: "ERROR", error: s.reason?.message });
  }
  process.stdout.write(`Progress: ${Math.min(i + BATCH, accounts.length)}/${accounts.length}\n`);
}

// Group by hash
const byHash = {};
for (const r of results) {
  if (!byHash[r.hash]) byHash[r.hash] = [];
  byHash[r.hash].push(r);
}

// Find duplicates
const dups = Object.entries(byHash).filter(([h, arr]) => arr.length > 1 && !h.startsWith("FAIL") && h !== "ERROR");
console.log(`\n=== نتيجة: ${dups.length} مجموعة صور مكررة ===\n`);

const toDelete = [];
for (const [hash, arr] of dups) {
  const keep = arr[0];
  const del  = arr.slice(1);
  console.log(`🔁 Hash: ${hash.slice(0,8)}... → ${arr.length} نسخة | يبقى ID ${keep.id} (${keep.platform}) | يُحذف: ${del.map(d=>d.id).join(", ")}`);
  toDelete.push(...del.map(d => d.id));
}

if (toDelete.length === 0) {
  console.log("✅ لا توجد صور مكررة بالمحتوى");
} else {
  console.log(`\nسيتم حذف IDs: ${toDelete.join(",")}`);
  // Write delete SQL
  import("node:fs").then(fs => {
    fs.writeFileSync("/tmp/delete_dups.sql", `DELETE FROM accounts WHERE id IN (${toDelete.join(",")}) RETURNING id, name, platform;`);
    console.log("SQL written to /tmp/delete_dups.sql");
  });
}
