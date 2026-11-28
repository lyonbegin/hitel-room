# ARTEMIS Web2 API source integration
Source: https://github.com/lyonbegin/hitel-scribd-runner/tree/24aed60fb99e7fc2ec3867521419a8ab51571bd8
Source branch: feature/hitel-universal-ai-ui-api-20261127
Exact commit: 24aed60fb99e7fc2ec3867521419a8ab51571bd8
Source file: universal/engine.py. The transport functions http, get, submit, result and their constants/helpers were copied without functional changes into web2_client.py; hitel_transport.py imports this local module. The provided public API contract is archived in web2-api/API.md. No Scribd batch engine, watchdog, project records, state, user sessions or credentials are activated or required by this branch.

The original API is an asynchronous text service; no server implementation, browser worker source or image upload contract is included in the supplied source. This branch does not duplicate the remote server. Live calls still require a new authorized ARTEMIS task and approved GitHub OIDC producer, as documented by the original API. No existing task is reused. No OpenAI/Gemini key or browser token input. Offline regression on push; real tests are not simulated as success. No FunctionGemma changes.

The deployed Pages site and main are intentionally unchanged by this branch-specific import.