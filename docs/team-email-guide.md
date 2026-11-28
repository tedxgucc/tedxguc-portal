# Your @tedxguc.org email: setup guide for members

You get an address like `name@tedxguc.org` (or a team address like `media@tedxguc.org`).
Mail sent to it arrives in your own Gmail, and you can reply **from** it. It takes 5 minutes, once,
on a computer (not the phone app).

## What you get from the board (privately, never in a group chat)
- Your address, for example `salma.hany@tedxguc.org`
- Your sending key: a long code starting with `re_`

## 1. Check that mail reaches you
Ask someone to email your new address. It should land in your Gmail inbox within a minute.
(Gmail hides mail you send to yourself, so test from another account.)

## 2. Add the address to Gmail
1. Gmail on a computer → **⚙ Settings → See all settings → Accounts and Import**.
2. Under **Send mail as**, click **Add another email address**.
3. Fill in:
   - **Name:** `Your Name | TEDxGUC`
   - **Email address:** your `@tedxguc.org` address
   - Keep **Treat as an alias** ticked → **Next step**
4. On the next screen:
   - **SMTP Server:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your `re_…` key
   - Choose **Secured connection using SSL** → **Add account**
5. Gmail sends a confirmation email to your new address; it arrives in this same inbox.
   Open the **newest** one and click the **first** link, then **Confirm**.
   - Don't click the link at the bottom of that email: it cancels the request.
   - If you get "bad confirmation link", delete the address in Settings, add it again, and use only the new email.

## 3. Make replies come from it
Back in **Settings → Accounts and Import → Send mail as**:
- Select **Reply from the same address to which the message was sent**.
- Optional: **make default** next to your @tedxguc.org address, so new emails use it too.

## 4. Send
Compose → click **From** → choose your @tedxguc.org address. On the phone, the Gmail app shows the
same choice once it's set up on a computer.

## Rules
- Use it for TEDxGUC work only. Everything you send represents the club.
- Don't share your `re_` key. If it leaks, tell the board and they'll replace it.
- The whole club shares a daily sending limit. For mass emails (many sponsors at once) ask the board first.
- When you leave the club, the board turns the address and key off.

---

## For the board: adding a member
1. **ImprovMX** (improvmx.com, club account) → tedxguc.org → add alias → forwards to their Gmail.
2. **Resend** (resend.com) → API Keys → Create → name it after them, **Sending access**, domain `tedxguc.org`.
   Copy the key (shown once) and send it to them privately.
3. Send them this guide.

**When someone leaves:** delete their key in Resend and change or delete their alias in ImprovMX.
Role addresses (`media@`, `chairman@`…) stay; just point them to the next person.
