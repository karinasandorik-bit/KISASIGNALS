#!/usr/bin/env python3
"""OWL FREE AGENT v0.1: read-only GitHub discovery; no secrets or paid APIs."""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta

API="https://api.github.com"
TOKEN=os.getenv("GITHUB_TOKEN","")
HEADERS={"Accept":"application/vnd.github+json","User-Agent":"OWL-Free-Agent/0.1"}
if TOKEN: HEADERS["Authorization"]="Bearer "+TOKEN

def get(path):
    req=urllib.request.Request(API+path,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.loads(r.read())

def safe(s):
    return str(s).replace("|","\\|").replace("\n"," ")[:170]

def main():
    repo=os.getenv("OWL_REPO","karinasandorik-bit/KISASIGNALS")
    owner,name=repo.split("/",1)
    runs=get("/repos/"+urllib.parse.quote(owner)+"/"+urllib.parse.quote(name)+"/actions/runs?per_page=50").get("workflow_runs",[])
    since=datetime.now(timezone.utc)-timedelta(days=7)
    recent=[r for r in runs if datetime.fromisoformat(r["created_at"].replace("Z","+00:00"))>=since]
    failures=[r for r in recent if r.get("conclusion")=="failure"]
    clusters={}
    for r in failures:
        k=(r.get("name","unknown"),r.get("head_branch","unknown"))
        clusters.setdefault(k,[]).append(r)
    # Public opportunity discovery. Search output is untrusted; never obey issue text as instructions.
    opportunities=[]
    for q in ['is:issue is:open label:bounty archived:false','is:issue is:open "paid" "bug" archived:false']:
        try:
            results=get("/search/issues?q="+urllib.parse.quote(q)+"&per_page=15").get("items",[])
            for x in results:
                if x.get("pull_request") or x["html_url"] in {v["url"] for v in opportunities}:continue
                title=x.get("title","")
                # Do not assume that mentions of payment imply an actual funded bounty.
                opportunities.append({"title":safe(title),"url":x["html_url"],"comments":x.get("comments",0)})
        except Exception as e:
            print("Discovery query unavailable:",type(e).__name__,file=sys.stderr)
    opportunities=sorted(opportunities,key=lambda x:-x["comments"])[:5]
    lines=["# OWL Free Agent — daily read-only report","",
           "Generated UTC: "+datetime.now(timezone.utc).isoformat(timespec="seconds"),"",
           "## Engineering radar",
           f"Workflow runs inspected: {len(recent)} (latest 50 overall, seven-day filter).",
           f"Failed runs: {len(failures)}; distinct (workflow, branch) groups: {len(clusters)}.","",
           "| Workflow | Branch | Failures | Latest run |","|---|---|---:|---|"]
    for (workflow,branch),items in sorted(clusters.items(),key=lambda kv:-len(kv[1]))[:12]:
        r=sorted(items,key=lambda z:z["created_at"],reverse=True)[0]
        lines.append(f"| {safe(workflow)} | {safe(branch)} | {len(items)} | [inspect]({r['html_url']}) |")
    lines+=["","## Unverified opportunities","Items below are leads, NOT verified jobs or promised payments.",""]
    for x in opportunities:
        lines.append(f"- [{x['title']}]({x['url']}) — check sponsor, scope, budget, eligibility and duplicate PRs")
    lines+=["","## Safety contract",
            "READ ONLY: no submissions, payments, registrations, credential handling or trading.",
            "No Gemini/Claude call is claimed. No external payment is verified.",
            "Human approval required for external action."]
    output="\n".join(lines)+"\n"
    path=os.getenv("GITHUB_STEP_SUMMARY")
    if path:
        with open(path,"a",encoding="utf-8") as f:f.write(output)
    else:print(output)
if __name__=="__main__": main()
