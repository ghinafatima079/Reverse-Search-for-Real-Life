import { useState } from "react";

const intents = [
  {
    key: "fix",
    title: "Fix a problem",
    description: "Something isn't working",
    color: "bg-rose-50 text-rose-700",
  },
  {
    key: "setup",
    title: "Set it up",
    description: "Get it configured",
    color: "bg-sky-50 text-sky-700",
  },
  {
    key: "learn",
    title: "Learn to use it",
    description: "Understand the basics",
    color: "bg-amber-50 text-amber-700",
  },
  {
    key: "maintain",
    title: "Maintain it",
    description: "Keep it working properly",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "tutorial",
    title: "Watch a tutorial",
    description: "Find useful videos",
    color: "bg-violet-50 text-violet-700",
  },
  {
    key: "manual",
    title: "Find the manual",
    description: "Documentation & guides",
    color: "bg-orange-50 text-orange-700",
  },
];

function formatConfidence(confidence) {
  if (!confidence) return null;
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [problem, setProblem] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpResult, setHelpResult] = useState(null);
  const [helpError, setHelpError] = useState(null);

  function handleFile(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setResult(null);
    setError(null);
    setSelectedIntent(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  }

  function resetScan() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSelectedIntent(null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const res = await fetch("/api/vision_gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setResult(data);
      } catch (err) {
        setError(
          "I could not identify that image. Try another photo with the object in good light.",
        );
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleGetHelp() {
    if (!problem.trim() || !result) return;

    setHelpLoading(true);
    setHelpError(null);
    setHelpResult(null);

    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          object: {
            brand: result.brand,
            product: result.product,
            model: result.model,
            category: result.category,
            confidence: result.confidence,
          },
          intent: selectedIntent,
          problem: problem.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to get help");
      }

      setHelpResult(data);
    } catch (err) {
      setHelpError(err.message);
    } finally {
      setHelpLoading(false);
    }
  }

  const uncertain = result?.confidence === "low" || result?.needsMoreInfo;
  const title = result?.product || result?.category || result?.brand;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
              RL
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Real Life
            </span>
          </div>
          {result && (
            <button
              type="button"
              onClick={resetScan}
              className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
            >
              New scan
            </button>
          )}
        </header>

        {!result ? (
          <section aria-labelledby="scan-heading">
            <div className="mb-8 max-w-lg">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                Object assistant
              </p>
              <h1
                id="scan-heading"
                className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
              >
                What is this thing?
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-500">
                Take a photo and I&apos;ll help you figure it out.
              </p>
            </div>

            <label className="group block cursor-pointer overflow-hidden rounded-[2rem] bg-slate-900 shadow-xl shadow-slate-200 transition hover:shadow-2xl">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFile}
                className="sr-only"
              />
              {preview ? (
                <div className="relative aspect-[4/3] w-full bg-slate-100">
                  <img
                    src={preview}
                    alt="Selected object"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    Tap to change photo
                  </span>
                </div>
              ) : (
                <div className="flex min-h-[21rem] flex-col items-center justify-center px-6 py-12 text-center text-white">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <svg
                      aria-hidden="true"
                      className="h-8 w-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h2l1.2-2h4.6l1.2 2h2A1.5 1.5 0 0 1 18 7.5v9A1.5 1.5 0 0 1 16.5 18h-11A1.5 1.5 0 0 1 4 16.5v-9Z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  </div>
                  <span className="text-xl font-semibold">Take a photo</span>
                  <span className="mt-2 text-sm text-slate-300">
                    or choose one from your camera roll
                  </span>
                </div>
              )}
            </label>

            {file && !loading && (
              <button
                type="button"
                onClick={handleSubmit}
                className="mt-5 min-h-14 w-full rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200"
              >
                Analyze photo
              </button>
            )}

            {loading && (
              <div
                className="mt-5 flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm"
                role="status"
              >
                <div className="loader h-8 w-8 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">
                    Taking a closer look
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    This usually takes a few seconds.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4"
                role="alert"
              >
                <p className="font-semibold text-rose-900">
                  Let&apos;s try that again.
                </p>
                <p className="mt-1 text-sm leading-6 text-rose-700">{error}</p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="mt-3 text-sm font-semibold text-rose-900 underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">
              For the clearest result, include the whole object and any visible
              labels.
            </p>
          </section>
        ) : (
          <section aria-labelledby="result-heading">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Identification
                </p>
                <h1
                  id="result-heading"
                  className="text-4xl font-semibold tracking-tight text-slate-950"
                >
                  I think this is...
                </h1>
              </div>
              {preview && (
                <img
                  src={preview}
                  alt="Scanned object"
                  className="h-16 w-16 rounded-2xl object-cover shadow-sm"
                />
              )}
            </div>
            <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
              {title ? (
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {title}
                </h2>
              ) : (
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  I couldn&apos;t name it yet
                </h2>
              )}
              {result.brand &&
                result.product &&
                result.brand !== result.product && (
                  <p className="mt-1 text-slate-500">{result.brand}</p>
                )}
              <dl className="mt-7 divide-y divide-slate-100">
                {result.model && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-slate-500">Model</dt>
                    <dd className="text-right text-sm font-semibold text-slate-900">
                      {result.model}
                    </dd>
                  </div>
                )}
                {result.category && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-slate-500">Category</dt>
                    <dd className="text-right text-sm font-semibold text-slate-900">
                      {result.category}
                    </dd>
                  </div>
                )}
                {formatConfidence(result.confidence) && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-slate-500">Confidence</dt>
                    <dd className="text-right text-sm font-semibold text-slate-900">
                      {formatConfidence(result.confidence)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
            {uncertain && (
              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-amber-50 px-5 py-4 text-amber-950">
                <p className="text-sm leading-6">
                  I&apos;m not fully sure. A clearer photo or a visible label
                  may help.
                </p>
                <button
                  type="button"
                  onClick={resetScan}
                  className="shrink-0 text-sm font-semibold underline underline-offset-4"
                >
                  Retake
                </button>
              </div>
            )}
            {selectedIntent === null ? (
              <div className="mt-10">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  What do you need help with?
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {intents.map((intent) => {
                    return (
                      <button
                        type="button"
                        key={intent.key}
                        onClick={() => setSelectedIntent(intent.key)}
                        className={`min-h-24 rounded-2xl p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-sky-100 ${intent.color} hover:-translate-y-0.5`}
                      >
                        <span className="text-base font-semibold">
                          {intent.title}
                        </span>

                        <span className="mt-1 block text-sm opacity-75">
                          {intent.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : selectedIntent === "fix" ? (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIntent(null);
                    setProblem("");
                    setHelpResult(null);
                    setHelpError(null);
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Fix a problem
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    What&apos;s going wrong?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    Tell me what&apos;s happening and I&apos;ll help you figure
                    out what to try.
                  </p>

                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    rows={5}
                    placeholder="For example: It turns on, but there is no sound."
                    className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />

                  <button
                    type="button"
                    onClick={handleGetHelp}
                    disabled={!problem.trim()}
                    className="mt-4 min-h-14 w-full rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200"
                  >
                    {helpLoading ? "Thinking..." : "Get help"}
                  </button>

                  {helpError && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {helpError}
                    </div>
                  )}

                  {helpResult && (
                    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Here&apos;s what you can try
                      </p>

                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {helpResult.summary}
                      </h3>

                      <div className="mt-6 space-y-4">
                        {helpResult.steps.map((step, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                              {index + 1}
                            </div>

                            <p className="pt-1 text-sm leading-6 text-slate-600">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>

                      {helpResult.warning && (
                        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                          <strong>Safety note:</strong> {helpResult.warning}
                        </div>
                      )}

                      {helpResult.needsService && (
                        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                          This may require professional service if the steps
                          above do not resolve the problem.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : selectedIntent === "setup" ? (
              // NEW setup screen
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIntent(null);
                    setProblem("");
                    setHelpResult(null);
                    setHelpError(null);
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Set it up
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    What are you trying to set up?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    Tell me what you&apos;re trying to do and I&apos;ll walk you
                    through it.
                  </p>

                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    rows={5}
                    placeholder="For example: I want to connect this TV to Wi-Fi."
                    className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />

                  <button
                    type="button"
                    onClick={handleGetHelp}
                    disabled={!problem.trim() || helpLoading}
                    className="mt-4 min-h-14 w-full rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {helpLoading ? "Thinking..." : "Get setup help"}
                  </button>

                  {helpError && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {helpError}
                    </div>
                  )}

                  {helpResult && (
                    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Here&apos;s how to get started
                      </p>

                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {helpResult.summary}
                      </h3>

                      <div className="mt-6 space-y-4">
                        {helpResult.steps.map((step, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                              {index + 1}
                            </div>

                            <p className="pt-1 text-sm leading-6 text-slate-600">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>

                      {helpResult.warning && (
                        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                          <strong>Safety note:</strong> {helpResult.warning}
                        </div>
                      )}

                      {helpResult.needsService && (
                        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                          This may require professional assistance.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : selectedIntent === "learn" ? (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIntent(null);
                    setProblem("");
                    setHelpResult(null);
                    setHelpError(null);
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Learn to use it
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    What do you want to know?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    Tell me what you&apos;re trying to do and I&apos;ll explain
                    how it works.
                  </p>

                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    rows={5}
                    placeholder="For example: How do I change the picture settings?"
                    className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />

                  <button
                    type="button"
                    onClick={handleGetHelp}
                    disabled={!problem.trim() || helpLoading}
                    className="mt-4 min-h-14 w-full rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {helpLoading ? "Thinking..." : "Get help"}
                  </button>

                  {helpError && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {helpError}
                    </div>
                  )}

                  {helpResult && (
                    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Here&apos;s how to use it
                      </p>

                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {helpResult.summary}
                      </h3>

                      <div className="mt-6 space-y-4">
                        {helpResult.steps.map((step, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                              {index + 1}
                            </div>

                            <p className="pt-1 text-sm leading-6 text-slate-600">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>

                      {helpResult.warning && (
                        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                          <strong>Safety note:</strong> {helpResult.warning}
                        </div>
                      )}

                      {helpResult.needsService && (
                        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                          This may require professional assistance.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : selectedIntent === "maintain" ? (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIntent(null);
                    setProblem("");
                    setHelpResult(null);
                    setHelpError(null);
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Maintain it
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    How do you want to take care of it?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    Tell me what you want to maintain or check and I&apos;ll
                    guide you through it.
                  </p>

                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    rows={5}
                    placeholder="For example: How should I clean this TV screen?"
                    className="mt-6 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                  />

                  <button
                    type="button"
                    onClick={handleGetHelp}
                    disabled={!problem.trim() || helpLoading}
                    className="mt-4 min-h-14 w-full rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {helpLoading ? "Thinking..." : "Get maintenance help"}
                  </button>

                  {helpError && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {helpError}
                    </div>
                  )}

                  {helpResult && (
                    <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                        Here&apos;s what to do
                      </p>

                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {helpResult.summary}
                      </h3>

                      <div className="mt-6 space-y-4">
                        {helpResult.steps.map((step, index) => (
                          <div key={index} className="flex gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                              {index + 1}
                            </div>

                            <p className="pt-1 text-sm leading-6 text-slate-600">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>

                      {helpResult.warning && (
                        <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                          <strong>Safety note:</strong> {helpResult.warning}
                        </div>
                      )}

                      {helpResult.needsService && (
                        <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
                          This may require professional assistance.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : selectedIntent === "manual" ? (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => setSelectedIntent(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Find the manual
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    Looking for the manual?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    I&apos;ll search for documentation for this exact object.
                  </p>

                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      `${result.brand || ""} ${result.product || ""} ${
                        result.model || ""
                      } manual`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700"
                  >
                    Search for the manual
                  </a>
                </div>
              </div>
            ) : selectedIntent === "tutorial" ? (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => setSelectedIntent(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>

                <div className="mt-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Watch a tutorial
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    What do you want to learn?
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-500">
                    I&apos;ll find tutorials for this exact object.
                  </p>

                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${result.brand || ""} ${result.product || ""} ${
                        result.model || ""
                      } tutorial`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-sky-600 px-6 text-base font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700"
                  >
                    Search YouTube
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-10">
                <button
                  type="button"
                  onClick={() => setSelectedIntent(null)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900"
                >
                  ← Back to options
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
