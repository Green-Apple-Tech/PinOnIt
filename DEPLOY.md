# Deploy pinonit.com (3 steps)

Production UI: **https://pinonit.com** via **Bolt Cloud**  
Repo: **Green-Apple-Tech/PinOnIt** (private, branch `main`)  
Bolt project: https://bolt.new/~/sb1-nzt1kjlj

**`git push` alone does not update the live site.**

---

## Every time you change the frontend

### 1. Cursor — push to GitHub

```bash
cd ~/Projects/PinOnIt
git add .
git commit -m "describe your change"
git push
```

### 2. Bolt — pull from GitHub (use the menu, not chat)

1. Open the Bolt project link above.
2. Click the **GitHub icon** (top right).
3. **Pull / Sync `main`** (~30 seconds).

Do **not** use Bolt chat “pull from repo” for routine deploys.

### 3. Bolt — Publish

**Publish** → confirm **Update** → hard refresh pinonit.com (Cmd+Shift+R).

---

## Optional: terminal reminder after every `git push`

Run once on this Mac:

```bash
cd ~/Projects/PinOnIt
chmod +x .githooks/post-push scripts/enable-deploy-hook.sh
./scripts/enable-deploy-hook.sh
```

After that, every `git push` prints the Bolt sync + Publish reminder.

---

## Supabase (backend only)

When you change edge functions (e.g. SMS coordination):

```bash
supabase functions deploy coordinate-sms --project-ref adlusgtlwgcfyxgeoias
```

Database migrations: `supabase db push --linked`

---

## If Bolt shows “GitHub conflict”

GitHub `main` is newer (usually from Mac). Choose **Pull and discard last message**, then **Publish**. Do not let Bolt push over your Mac commits.

---

## Checklist before Publish

- [ ] Bolt pulled `main` from GitHub menu
- [ ] Expected UI strings present in Bolt editor
- [ ] Publish → Update
- [ ] pinonit.com hard refresh; JS bundle filename hash changed
