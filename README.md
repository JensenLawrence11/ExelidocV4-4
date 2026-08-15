# Exelidoc


AI writing/data assistant across Google Docs, Gmail, Word, Excel, PowerPoint, and Outlook —
like Grammarly/Honey, but powered by your own AI backend.


## Structure


```
Exelidoc/
├── backend/            Flask API — the shared brain. Calls the AI, handles
│                        Stripe subscriptions, auth. Both frontends below
│                        talk to this over HTTPS. Nothing else calls the AI
│                        API directly — keys never leave the server.
├── office-addin/       Task pane add-in for Word/Excel/PowerPoint/Outlook.
│                        HTML/CSS/JS, driven by Office.js. Currently scaffolded
│                        for Excel first.
├── browser-extension/  Manifest V3 extension for Gmail + Google Docs.
│                        Content scripts + popup, HTML/CSS/JS.
└── website/             Static marketing site (plain HTML/CSS/JS). Just a
                          landing page + GitHub download link for now — no
                          backend needed for this piece.
```


## Local dev quick start


### Backend
--Poweshell


cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ../.env.example .env
flask --app app run --debug


### If Activate.ps1 errors with "running scripts is disabled on this system", run this once first:


--powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned


### Office Add-in (Excel)
--powershell


cd office-addin
npm install
npm start                         # sideloads into Excel, serves on https://localhost:3000




### Browser Extension
Chrome/Edge → `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `browser-extension/`


### Website
Just open `website/index.html`, or `python -m http.server` from inside `website/`.


## Environment variables


See `.env.example` at the repo root for the full list (AI provider key, Stripe keys,
Flask secret key, etc). Copy it to `backend/.env` and fill in real values — never commit
the real `.env` file (already covered in `.gitignore`).


## Status


- [x] Project structure scaffolded
- [ ] Backend `/api/analyze` endpoint (real AI logic)
- [ ] Stripe subscription flow
- [ ] Excel task pane wired to backend
- [ ] Browser extension content scripts (Gmail, Google Docs)
- [ ] Marketing site content + design pass


### To stop server
npm stop

