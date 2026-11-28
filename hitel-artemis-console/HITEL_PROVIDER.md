# ARTEMIS — original HITEL Universal AI API client only

Original repository: https://github.com/lyonbegin/hitel-scribd-runner/tree/feature/hitel-universal-ai-ui-api-20261127

Original API guide: https://github.com/lyonbegin/hitel-scribd-runner/blob/feature/hitel-universal-ai-ui-api-20261127/docs/HITEL_UNIVERSAL_AI_PUBLIC_API_GUIDE_KO.md

ARTEMIS sends requests exclusively through the documented GitHub Contents/Actions endpoints on the original repository. No copied engine, watchdog, separate backend, direct relay calls, or local approval flags. The original repository source is not modified by this client.

The documented input is a new project JSON with provider=hitel and an already approved dedicated task_id; result is original state.json and results.csv, with events.json used for progress. The original workflow owns execution and approval. Do not reuse an unrelated task. The existing authorized GitHub connection is required for writes; runtime GH_TOKEN follows the original API guide. The GitHub Actions repository-scoped default token cannot be assumed to write to another repository. No browser token field, no OpenAI/Gemini key. This public target accepts only public synthetic data. Actual AI execution remains unverified until the original API returns a verified response. Push runs test the client and read existing public mock evidence only.