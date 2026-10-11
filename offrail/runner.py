#!/usr/bin/env python3
"""Off-Railway research-only shadow runner. No trade execution."""
import argparse, datetime as dt, hashlib, json, os, pathlib, urllib.request, urllib.error, uuid
ROOT=pathlib.Path("offrail/ledger")
UTC=dt.timezone.utc
def now(): return dt.datetime.now(UTC)
def iso(x): return x.isoformat().replace("+00:00","Z")
def sha(x): return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"OWL-OffRail/1.0"})
    with urllib.request.urlopen(req,timeout=12) as r: return json.load(r)
def market():
    base="https://fapi.binance.com"
    book=fetch(base+"/fapi/v1/ticker/bookTicker?symbol=BTCUSDT")
    kl=fetch(base+"/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=12")
    n=now()
    assert len(kl)==12
    candles=[{"open_ms":int(x[0]),"close_ms":int(x[6]),"open":float(x[1]),"high":float(x[2]),"low":float(x[3]),"close":float(x[4])} for x in kl if int(x[6])<int(n.timestamp()*1000)]
    if len(candles)<10: raise ValueError("insufficient closed candles")
    age=(n.timestamp()*1000-candles[-1]["close_ms"])/1000
    if not 0<=age<=1050: raise ValueError("stale candles")
    bid,ask=float(book["bidPrice"]),float(book["askPrice"])
    if bid<=0 or ask<=bid or (ask-bid)/bid>0.001: raise ValueError("bad spread")
    return {"symbol":"BTCUSDT","retrieved_at":iso(n),"bid":bid,"ask":ask,"candles":candles,"source":"binance_usdm_public"}
def atomic(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj,sort_keys=True,indent=2)+"\n")
    tmp.replace(path)
def decide():
    snap=market()
    mid=sha(snap)[:20]
    p=ROOT/"market"/(mid+".json")
    if p.exists(): return
    c=snap["candles"]; trend=c[-1]["close"]/c[-9]["close"]-1
    side="LONG" if trend>0.004 else "SHORT" if trend< -0.004 else "NO_TRADE"
    t=now()
    entry=snap["ask"] if side=="LONG" else snap["bid"] if side=="SHORT" else None
    stop=(entry*(0.996 if side=="LONG" else 1.004)) if entry else None
    target=(entry*(1.006 if side=="LONG" else 0.994)) if entry else None
    d={"schema":"owl.shadow.v1","market_snapshot_id":mid,"decision_id":"D-"+mid,"created_at":iso(t),"expiry_at":iso(t+dt.timedelta(hours=4)),"symbol":"BTCUSDT","action":side,"reference_entry":entry,"stop":stop,"target":target,"status":"SHADOW_RESEARCH_ONLY","fill_status":"UNFILLED_REFERENCE_SCENARIO","strategy":"fixed_15m_momentum_v1_unvalidated","policy_hash":sha({"threshold":0.004,"tp":0.006,"sl":0.004,"horizon_h":4}),"snapshot_hash":sha(snap),"settlement_id":None}
    atomic(p,snap);atomic(ROOT/"decisions"/(mid+".json"),d)
    print(json.dumps({"decision_id":d["decision_id"],"action":side,"snapshot_id":mid}))
def settle():
    for path in sorted((ROOT/"decisions").glob("*.json")):
        d=json.loads(path.read_text())
        if d["action"]=="NO_TRADE" or (ROOT/"settlements"/path.name).exists():continue
        expiry=dt.datetime.fromisoformat(d["expiry_at"].replace("Z","+00:00"))
        if now()<expiry+dt.timedelta(minutes=2):continue
        start=int(dt.datetime.fromisoformat(d["created_at"].replace("Z","+00:00")).timestamp()*1000)
        end=int(expiry.timestamp()*1000)
        try:
            bars=fetch(f"https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1m&startTime={start}&endTime={end}&limit=300")
            # Only completely closed consecutive 1m bars are valid; never settle missing/ambiguous path.
            bar_times=[int(x[0]) for x in bars]
            if len(bars)<238 or any(b-a!=60000 for a,b in zip(bar_times,bar_times[1:])):raise ValueError("incomplete or discontinuous bar path")
            result="TIMEOUT"
            for x in bars:
                h,l=float(x[2]),float(x[3]);tp=(h>=d["target"] if d["action"]=="LONG" else l<=d["target"]);sl=(l<=d["stop"] if d["action"]=="LONG" else h>=d["stop"])
                if tp and sl:result="AMBIGUOUS";break
                if tp:result="TP_REFERENCE";break
                if sl:result="SL_REFERENCE";break
            s={"settlement_id":"S-"+path.stem,"decision_id":d["decision_id"],"outcome":result,"settled_at":iso(now()),"bars":len(bars),"disclaimer":"Reference-price scenario only; no real or simulated execution/fill confirmation."}
            atomic(ROOT/"settlements"/path.name,s)
            print(json.dumps(s))
        except Exception as exc: print("SETTLEMENT_PENDING",d["decision_id"],type(exc).__name__,str(exc))
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("mode",choices=["decide","settle"]);args=parser.parse_args()
    if args.mode=="decide":decide()
    else:settle()
