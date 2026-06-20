/**
 * Uploads an image file to GCS via presigned URL and returns the permanent serving URL.
 * The serving URL is stored in the database as imageUrl.
 */
export async function uploadImageToStorage(file: File): Promise<string> {
  const token = localStorage.getItem("admin_token");

  const urlRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });

  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  const uploadRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error("Failed to upload image");

  return `/api/storage${objectPath}`;
}
