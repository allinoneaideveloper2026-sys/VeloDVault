#!/usr/bin/env python3
"""Set the permanent Android package id (for example com.janedoe.velodvault). Run ONCE, before the first build you upload to Google Play.
Usage: python3 scripts/set-app-id.py com.janedoe.velodvault"""
import re, sys, os, json, shutil
if len(sys.argv) != 2 or not re.fullmatch(r"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+", sys.argv[1]):
    sys.exit("Give a package id like com.janedoe.velodvault (lower-case letters, digits, underscores, at least two parts)")
new = sys.argv[1]; root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(f"{root}/capacitor.config.json")); old = cfg["appId"]
if old == new: sys.exit("Already set to " + new)
cfg["appId"] = new; json.dump(cfg, open(f"{root}/capacitor.config.json", "w"), indent=2)
def edit(path, fn):
    s = open(path, encoding="utf8").read(); t = fn(s); open(path, "w", encoding="utf8").write(t)
edit(f"{root}/android/app/build.gradle", lambda s: s.replace(old, new))
res = f"{root}/android/app/src/main/res/values/strings.xml"
if os.path.exists(res): edit(res, lambda s: s.replace(old, new))
oldd = f"{root}/android/app/src/main/java/" + old.replace(".", "/"); newd = f"{root}/android/app/src/main/java/" + new.replace(".", "/")
os.makedirs(newd, exist_ok=True)
for f in os.listdir(oldd):
    edit(f"{oldd}/{f}", lambda s: s.replace(f"package {old};", f"package {new};")); shutil.move(f"{oldd}/{f}", f"{newd}/{f}")
p = oldd
while p != f"{root}/android/app/src/main/java" and not os.listdir(p): os.rmdir(p); p = os.path.dirname(p)
print("Package id set to", new, "- now run: npm run sync")
