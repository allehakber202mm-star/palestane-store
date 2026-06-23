const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Uploads any file to GCS via the server-side proxy endpoint.
 * Avoids CORS issues that occur when uploading directly to GCS from the browser.
 * Returns the permanent serving URL (e.g. /api/storage/objects/uploads/<uuid>)
 */
export async function uploadImageToStorage(file: File): Promise<string> {
  return uploadFileToStorage(file);
}

/**
 * Uploads a file to GCS via server proxy.
 * Supports images, videos, and any other file type.
 * Returns the permanent serving URL.
 */
export async function uploadFileToStorage(file: File): Promise<string> {
  const token = localStorage.getItem("admin_token");

  console.log(`[Upload] 📁 الملف: ${file.name} | الحجم: ${(file.size / 1024 / 1024).toFixed(2)} MB | النوع: ${file.type}`);
  console.log(`[Upload] ⬆️  بدأ الرفع...`);

  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error("[Upload] ⏰ انتهت مهلة الرفع (60 ثانية)");
  }, 60_000);

  try {
    const res = await fetch(`${API_BASE}/api/storage/uploads/upload-file`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      console.error(`[Upload] ❌ فشل الرفع: ${errText}`);
      throw new Error(errText || `فشل الرفع: HTTP ${res.status}`);
    }

    const { servingUrl } = await res.json();
    console.log(`[Upload] ✅ تم الرفع بنجاح: ${servingUrl}`);
    return servingUrl;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new Error("انتهت مهلة الرفع (60 ثانية) — الملف كبير جداً أو الشبكة بطيئة");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
