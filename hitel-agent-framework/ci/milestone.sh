#!/usr/bin/env bash
set -Eeuo pipefail
stage="${1:?stage required}"
state="${2:-success}"
case "$state" in started|success|failure|cancelled|skipped|blocked) ;; *) exit 2;; esac
run_url="https://github.com/${GITHUB_REPOSITORY:-lyonbegin/hitel-room}/actions/runs/${GITHUB_RUN_ID:-0}"
printf '::notice title=HITEL milestone::%s — %s\n' "$stage" "$state"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '\n- **%s** — %s (%s UTC) — [run](%s)\n' "$stage" "$state" "$(date -u +%FT%T)" "$run_url" >> "$GITHUB_STEP_SUMMARY"
fi
# Optional HTTPS receiver; no credentials, logs, screenshots, or mission text are sent.
# Not a ChatGPT endpoint unless a supported incoming integration is actually configured.
if [[ "${HITEL_MILESTONE_WEBHOOK:-}" == https://* ]]; then
  payload="$(python3 -c 'import json,os,sys; print(json.dumps({"event":"hitel.milestone","stage":sys.argv[1],"status":sys.argv[2],"run_url":sys.argv[3],"sha":os.getenv("GITHUB_SHA"),"run_attempt":os.getenv("GITHUB_RUN_ATTEMPT"),"job":os.getenv("GITHUB_JOB")}))' "$stage" "$state" "$run_url")"
  if ! curl -fsS --max-time 10 --retry 1 -o /dev/null -H 'Content-Type: application/json' --data-binary "$payload" "$HITEL_MILESTONE_WEBHOOK" 2>/dev/null; then
    echo '::warning::Milestone webhook delivery failed; status remains available in Actions.'
  fi
fi

# GitHub-native event bridge for ChatGPT Work pull request comment triggers.
# The PR is a draft status feed, never merged by the workflow.
if [[ "$state" != started && "${HITEL_MILESTONE_PR:-}" =~ ^[0-9]+$ && -n "${HITEL_MILESTONE_GITHUB_TOKEN:-}" ]]; then
  body="$(printf '[HITEL MILESTONE] %s — %s\n\nRun: %s (attempt %s)\nCommit: %s\nJob: %s' "$stage" "$state" "$run_url" "${GITHUB_RUN_ATTEMPT:-1}" "${GITHUB_SHA:-unknown}" "${GITHUB_JOB:-unknown}")"
  if GH_TOKEN="$HITEL_MILESTONE_GITHUB_TOKEN" gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$HITEL_MILESTONE_PR/comments" -f "body=$body" --jq '.html_url'; then
    echo '::notice::GitHub PR milestone comment published'
  else
    echo '::warning::GitHub PR milestone comment delivery failed'
  fi
fi
