"""One-shot migration of the local wayfinder map into GitHub issues.

Reads .scratch/pokestats-v2/{map.md,issues/NN-*.md}, creates the map issue and
one child issue per ticket, wires GitHub-native sub-issue and blocked_by edges,
posts each resolved ticket's Answer as a resolution comment, and closes it.

Idempotence is NOT attempted: running this twice creates duplicate issues.
It exists to be run once; kept in the repo as the record of how the tracker
moved from local markdown to GitHub.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = "YuukiFST/PokeStats"
ROOT = Path(__file__).parent
BLOB = f"https://github.com/{REPO}/blob/main/.scratch/pokestats-v2"

LABELS = {
    "wayfinder:map": ("6f42c1", "The wayfinder map issue for an effort"),
    "wayfinder:research": ("0e8a16", "AFK ticket: gather a fact a decision waits on"),
    "wayfinder:grilling": ("1d76db", "HITL ticket: a decision made in conversation"),
    "wayfinder:prototype": ("d93f0b", "HITL ticket: build a rough artifact to react to"),
    "wayfinder:task": ("fbca04", "Manual work that unblocks a decision"),
}


def gh(*args, stdin=None):
    result = subprocess.run(
        ["gh", *args], capture_output=True, text=True, encoding="utf-8", input=stdin
    )
    if result.returncode != 0:
        sys.exit(f"FAILED: gh {' '.join(args)}\n{result.stderr}")
    return result.stdout.strip()


def absolutise(body: str) -> str:
    """Relative links work in the repo tree but not in an issue body."""
    body = body.replace("](../research/", f"]({BLOB}/research/")
    body = body.replace("](research/", f"]({BLOB}/research/")
    body = body.replace("](issues/", f"]({BLOB}/issues/")
    return body


def parse(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    title = lines[0].removeprefix("# ").strip()
    meta = {}
    for line in lines[1:8]:
        if ":" in line and not line.startswith("#"):
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    question = text.split("## Question", 1)[1]
    answer = None
    if "\n## Answer" in question:
        question, answer = question.split("\n## Answer", 1)
    blockers = []
    if meta.get("Blocked by", "—") != "—":
        blockers = [int(n) for n in re.findall(r"\d+", meta["Blocked by"])]
    return {
        "num": int(path.name[:2]),
        "title": title,
        "type": meta.get("Type", "grilling"),
        "resolved": meta.get("Status") == "resolved",
        "blockers": blockers,
        "question": question.strip(),
        "answer": answer.strip() if answer else None,
    }


def main():
    for name, (colour, description) in LABELS.items():
        subprocess.run(
            ["gh", "label", "create", name, "--color", colour,
             "--description", description, "--force"],
            capture_output=True, text=True,
        )
    print(f"labels ready ({len(LABELS)})")

    map_body = absolutise((ROOT / "map.md").read_text(encoding="utf-8"))
    map_body = map_body.split("\n", 2)[2].lstrip()  # drop the "# Mapa" H1
    map_url = gh("issue", "create", "--repo", REPO, "--title",
                 "Mapa: PokeStats v2", "--label", "wayfinder:map",
                 "--body-file", "-", stdin=map_body)
    map_no = int(map_url.rstrip("/").split("/")[-1])
    map_id = int(gh("api", f"repos/{REPO}/issues/{map_no}", "--jq", ".id"))
    print(f"map  -> #{map_no}")

    tickets = [parse(p) for p in sorted((ROOT / "issues").glob("*.md"))]
    created = {}

    for t in tickets:
        body = f"Part of #{map_no}\n\n## Question\n\n{absolutise(t['question'])}"
        url = gh("issue", "create", "--repo", REPO, "--title", t["title"],
                 "--label", f"wayfinder:{t['type']}", "--body-file", "-", stdin=body)
        number = int(url.rstrip("/").split("/")[-1])
        db_id = int(gh("api", f"repos/{REPO}/issues/{number}", "--jq", ".id"))
        created[t["num"]] = {"number": number, "id": db_id}
        gh("api", "--method", "POST", f"repos/{REPO}/issues/{map_no}/sub_issues",
           "-F", f"sub_issue_id={db_id}")
        print(f"  {t['num']:02d} -> #{number}  {t['title'][:58]}")

    for t in tickets:
        for blocker in t["blockers"]:
            gh("api", "--method", "POST",
               f"repos/{REPO}/issues/{created[t['num']]['number']}/dependencies/blocked_by",
               "-F", f"issue_id={created[blocker]['id']}")
        if t["blockers"]:
            print(f"  {t['num']:02d} blocked by {t['blockers']}")

    for t in tickets:
        if not t["resolved"]:
            continue
        number = created[t["num"]]["number"]
        gh("issue", "comment", str(number), "--repo", REPO,
           "--body-file", "-", stdin=f"## Answer\n\n{absolutise(t['answer'])}")
        gh("issue", "close", str(number), "--repo", REPO)
        print(f"  {t['num']:02d} -> #{number} resolved and closed")

    (ROOT / "github-issue-map.json").write_text(
        json.dumps({"map": map_no, "tickets": {str(k): v["number"]
                                               for k, v in created.items()}}, indent=2),
        encoding="utf-8",
    )
    print(f"\ndone. map #{map_no}, {len(created)} tickets")


if __name__ == "__main__":
    main()
