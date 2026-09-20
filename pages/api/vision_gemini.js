import { fetchWithRetry } from "../../lib/utils";

const responseSchema = {
  type: "OBJECT",
  properties: {
    brand: { type: "STRING", nullable: true },
    product: { type: "STRING", nullable: true },
    model: { type: "STRING", nullable: true },
    category: { type: "STRING", nullable: true },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    needsMoreInfo: { type: "BOOLEAN" },
  },
  required: [
    "brand",
    "product",
    "model",
    "category",
    "confidence",
    "needsMoreInfo",
  ],
};

const identificationPrompt = `Identify the product or object in this image and return only JSON matching the provided schema.

- Identify only what can reasonably be inferred from the image.
- Use visible text, logos, labels, and visual characteristics.
- Distinguish exact model identification from generic product or category identification.
- Do not invent a model number. If the exact model cannot be determined, return null for model.
- If the image is unclear or is not a recognizable product, use low confidence and set needsMoreInfo to true.`;

function getImageData(image) {
  if (typeof image !== "string" || !image.trim()) return null;

  let data = image.trim();
  let declaredMimeType = null;
  const dataUrlMatch = data.match(
    /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/s,
  );
  if (dataUrlMatch) {
    declaredMimeType = dataUrlMatch[1];
    data = dataUrlMatch[2];
  }

  data = data.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;

  const bytes = Buffer.from(data, "base64");
  if (!bytes.length) return null;

  let mimeType = declaredMimeType;
  if (!mimeType && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    mimeType = "image/jpeg";
  if (
    !mimeType &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    mimeType = "image/png";
  if (!mimeType && bytes.subarray(0, 4).toString() === "GIF8")
    mimeType = "image/gif";
  if (
    !mimeType &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    mimeType = "image/webp";

  return mimeType ? { data, mimeType } : null;
}

function validateResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const nullableStrings = ["brand", "product", "model", "category"];
  if (
    nullableStrings.some(
      (key) => value[key] !== null && typeof value[key] !== "string",
    )
  )
    return null;
  if (!["high", "medium", "low"].includes(value.confidence)) return null;
  if (typeof value.needsMoreInfo !== "boolean") return null;

  return {
    brand: value.brand,
    product: value.product,
    model: value.model,
    category: value.category,
    confidence: value.confidence,
    needsMoreInfo: value.needsMoreInfo,
  };
}

export default async function handler(req, res) {
  function sendError(status, message, code = "ERROR", details) {
    const payload = { error: message, code };
    if (details) payload.details = details;
    return res.status(status).json(payload);
  }

  if (req.method !== "POST")
    return sendError(405, "Method not allowed", "METHOD_NOT_ALLOWED");

  const image = getImageData(req.body?.image);
  if (!image) return sendError(400, "Invalid image input", "INVALID_IMAGE");

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim();
  if (!geminiKey || !geminiModel) {
    return sendError(
      500,
      "Gemini API configuration is missing",
      "MISSING_GEMINI_CONFIG",
    );
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: identificationPrompt },
          { inline_data: { mime_type: image.mimeType, data: image.data } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  let json;
  try {
    const response = await fetchWithRetry(
      geminiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify(body),
      },
      2,
      15000,
    );
    json = await response.json();
  } catch (error) {
    console.error("Gemini API request failed", { status: error.status });
    return sendError(502, "Gemini API request failed", "GEMINI_API_ERROR", {
      status: error.status || 502,
    });
  }

  const candidateText = json?.candidates?.[0]?.content?.parts
    ?.filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("");

  if (!candidateText)
    return sendError(
      502,
      "Gemini returned an invalid response",
      "INVALID_GEMINI_RESPONSE",
    );

  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch (error) {
    return sendError(
      502,
      "Gemini returned malformed JSON",
      "INVALID_GEMINI_RESPONSE",
    );
  }

  const result = validateResult(parsed);
  if (!result)
    return sendError(
      502,
      "Gemini returned an unexpected response shape",
      "INVALID_GEMINI_RESPONSE",
    );

  return res.json({ ...result, raw: json });
}
