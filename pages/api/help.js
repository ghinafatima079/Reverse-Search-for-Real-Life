const responseSchema = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "STRING",
      },
    },
    warning: {
      type: "STRING",
      nullable: true,
    },
    needsService: {
      type: "BOOLEAN",
    },
  },
  required: ["summary", "steps", "warning", "needsService"],
};

function validateResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (typeof value.summary !== "string") {
    return null;
  }

  if (
    !Array.isArray(value.steps) ||
    value.steps.some((step) => typeof step !== "string")
  ) {
    return null;
  }

  if (value.warning !== null && typeof value.warning !== "string") {
    return null;
  }

  if (typeof value.needsService !== "boolean") {
    return null;
  }

  return {
    summary: value.summary,
    steps: value.steps,
    warning: value.warning,
    needsService: value.needsService,
  };
}

const systemPrompt = `
You are a careful real-world object assistance assistant.

The user has photographed a physical object and wants help with it.

The requested assistance type is provided as an intent:
- fix: troubleshoot something that is not working
- setup: help configure or set up the object
- learn: explain how to use the object
- maintain: explain safe routine maintenance or care

Your job is to provide practical, cautious, actionable guidance appropriate to the requested intent.

Rules:
- Use the identified brand, product, model and category as context.
- Do not invent model-specific facts.
- Prefer simple, reversible steps.
- Give steps in a sensible order.
- Do not tell the user to open, disassemble, modify, bypass safety mechanisms,
  or perform dangerous electrical, mechanical, chemical, or high-voltage repairs.
- If the task could require professional service, set needsService to true.
- If there is a meaningful safety concern, put a concise warning in warning.
- Do not pretend to know the exact cause or procedure when the information is insufficient.
- For setup instructions, clearly distinguish general setup guidance from
  model-specific instructions that have not been verified.
- For learning requests, explain concepts simply rather than overwhelming the user.
- For maintenance requests, only recommend safe user-level maintenance.
- Keep the response concise and actionable.
- Return only JSON matching the provided schema.
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { object, intent, problem } = req.body || {};

  if (!object || typeof object !== "object") {
    return res.status(400).json({ error: "Object identification is required" });
  }

  const allowedIntents = ["fix", "setup", "learn", "maintain"];

  if (!allowedIntents.includes(intent)) {
    return res.status(400).json({
      error: "Invalid assistance intent",
    });
  }

  if (typeof problem !== "string" || !problem.trim()) {
    return res.status(400).json({ error: "Problem description is required" });
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim();

  if (!geminiKey || !geminiModel) {
    return res
      .status(500)
      .json({ error: "Gemini API configuration is missing" });
  }

  const userPrompt = `
Requested assistance: ${intent}

Object identification:
Brand: ${object.brand || "Unknown"}
Product: ${object.product || "Unknown"}
Model: ${object.model || "Unknown"}
Category: ${object.category || "Unknown"}
Identification confidence: ${object.confidence || "Unknown"}

User's problem:
${problem.trim()}
`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    geminiModel,
  )}:generateContent`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n${userPrompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  try {
    let response;

    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        break;
      }

      if (response.status !== 429 && response.status !== 503) {
        break;
      }

      if (attempt === 0) {
        await sleep(1500);
      }
    }

    const json = await response.json();

    if (!response.ok) {
      console.error("Gemini help request failed", {
        status: response.status,
      });

      return res.status(502).json({
        error: "Gemini help request failed",
        code: "GEMINI_API_ERROR",
      });
    }

    const candidateText = json?.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string")
      .map((part) => part.text)
      .join("");

    if (!candidateText) {
      return res.status(502).json({
        error: "Gemini returned an invalid response",
        code: "INVALID_GEMINI_RESPONSE",
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(candidateText);
    } catch {
      return res.status(502).json({
        error: "Gemini returned malformed JSON",
        code: "INVALID_GEMINI_RESPONSE",
      });
    }

    const result = validateResult(parsed);

    if (!result) {
      return res.status(502).json({
        error: "Gemini returned an unexpected response",
        code: "INVALID_GEMINI_RESPONSE",
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Help API error", {
      message: error.message,
    });

    return res.status(502).json({
      error: "Unable to get troubleshooting help",
      code: "HELP_API_ERROR",
    });
  }
}
