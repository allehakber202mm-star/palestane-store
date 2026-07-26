import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

// ── Gemini Vision username extractor ─────────────────────────────────────────
// Uses Gemini flash to read the social-media screenshot and extract the username.
// Much more accurate than tesseract for overlaid UI text.

let _aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (_aiClient) return _aiClient;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!baseUrl || !apiKey) return null;
  _aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "", baseUrl },
  });
  return _aiClient;
}

const PLATFORM_LABEL: Record<string, string> = {
  tiktok:           "TikTok",
  tiktok_monetized: "TikTok",
  instagram:        "Instagram",
  facebook:         "Facebook",
  snapchat:         "Snapchat",
};

/**
 * Send the image to Gemini and ask it to extract the account username.
 * Returns the bare username (no @), or null if nothing reliable found.
 */
async function extractWithGemini(
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  platform: string,
): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  const platformLabel = PLATFORM_LABEL[platform] ?? "social media";

  const prompt = `This is a screenshot of a ${platformLabel} account being sold.
Your task: extract ONLY the account username (handle) visible in the screenshot.

Rules:
- Return ONLY the username, without the @ symbol.
- If you see multiple usernames, return the MAIN account owner's username (not the viewer's or any other account).
- On TikTok it usually appears as @username below the profile picture or in the bio area.
- On Instagram it appears at the top of the profile page below the name.
- On Facebook it appears as the page/profile name or in the URL shown.
- On Snapchat it appears as the username below the display name.
- Do NOT return words like "followers", "following", "likes", the app name itself, or any Arabic text.
- If you are not confident, return exactly: NONE

Reply with just the username on a single line, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
          { text: prompt },
        ],
      }],
      config: { maxOutputTokens: 128 },
    });

    // Try multiple ways to extract text from the response
    const textFromGetter = response.text ?? "";
    const textFromCandidates = response.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? "";
    const raw = (textFromGetter || textFromCandidates).trim();

    logger.info(
      {
        platform,
        raw,
        finishReason: response.candidates?.[0]?.finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings?.map((r: any) => `${r.category}:${r.probability}`),
        partsCount: response.candidates?.[0]?.content?.parts?.length,
      },
      "[Gemini OCR] استجابة الذكاء الاصطناعي",
    );

    if (!raw || raw === "NONE" || raw.length < 2 || raw.length > 50) return null;

    // Clean up: strip @, quotes, spaces, newlines
    const username = raw
      .replace(/^@/, "")
      .replace(/['"]/g, "")
      .split(/\s/)[0]        // first word only
      .trim();

    if (!username || username === "NONE" || username.length < 2) return null;

    logger.info({ username, platform }, "[Gemini OCR] ✅ يوزرنيم مستخرج بالذكاء الاصطناعي");
    return username;
  } catch (err) {
    logger.warn({ err }, "[Gemini OCR] خطأ أثناء استدعاء Gemini");
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse an image buffer and extract a social-media username.
 * Primary: Gemini Vision. No fallback needed — tesseract was unreliable.
 */
export async function extractUsernameFromImage(
  imageBuffer: Buffer,
  platform: string,
): Promise<string | null> {
  // Detect mime type from magic bytes
  let mime: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) mime = "image/png";
  else if (
    imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 &&
    imageBuffer[8] === 0x57 && imageBuffer[9] === 0x45
  ) mime = "image/webp";

  logger.info({ platform, bytes: imageBuffer.byteLength, mime }, "[Gemini OCR] تحليل الصورة بالذكاء الاصطناعي");
  return extractWithGemini(imageBuffer, mime, platform);
}

/**
 * No-op: kept for API compatibility (was tesseract warm-up).
 */
export function warmupOcr(): void {
  // Gemini is stateless — nothing to warm up
}

/**
 * No-op: kept for API compatibility (was tesseract shutdown).
 */
export async function terminateOcrWorker(): Promise<void> {
  // Gemini is stateless — nothing to shut down
}
