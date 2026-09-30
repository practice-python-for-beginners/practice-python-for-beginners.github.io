# 🐍 Practice Python for Beginners

[![Deploy to GitHub Pages](https://github.com/practice-python-for-beginners/practice-python-for-beginners.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/practice-python-for-beginners/practice-python-for-beginners.github.io/actions/workflows/deploy.yml)
[![Live Site](https://img.shields.io/badge/Live%20Site-practice--python--for--beginners.github.io-6200ea?style=flat&logo=github)](https://practice-python-for-beginners.github.io/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

> A free, self-contained Python learning platform — **100 lessons** from basics to enterprise apps, with live in-browser code runner and interactive challenges.

**🌐 Live site:** https://practice-python-for-beginners.github.io/

---

## 🚀 Local Development

```bash
# 1. Clone the repo
git clone https://github.com/practice-python-for-beginners/practice-python-for-beginners.github.io.git
cd practice-python-for-beginners.github.io

# 2. Create a virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
.venv\Scripts\activate       # Windows

pip install -r requirements.txt

# 3. Start the live preview server
mkdocs serve
# Open http://127.0.0.1:8000
```

## 📦 Deploy

Every push to `main` automatically builds and deploys via GitHub Actions.
To deploy manually:

```bash
mkdocs gh-deploy --force
```

## 🗺️ Curriculum

| Section | Topics | Lessons |
|---------|--------|---------|
| 🧱 Basics | Syntax, data types, OOP, Flask | 1–10 |
| 🗃️ Databases | SQLite, SQLAlchemy, MongoDB, FastAPI | 11–20 |
| 🌐 Real-World APIs | Weather, news, URL shortener, email | 21–30 |
| ⚙️ Async & CI/CD | asyncio, Celery, Docker, GitHub Actions | 31–40 |
| 🔒 Security | OAuth2, webhooks, microservices | 41–50 |
| 🖥️ Frontend | Streamlit, React, Jinja2, AJAX | 51–60 |
| 📊 Data APIs | Pandas, Matplotlib, Plotly Dash | 61–70 |
| ☁️ Cloud | AWS Lambda, GCP, Azure, WebSockets | 71–80 |
| 🧠 ML & AI | Scikit-Learn, NLP, MLOps, chatbots | 81–90 |
| 🏢 Enterprise | RBAC, multi-tenancy, capstone project | 91–100 |

## 🤝 Contributing

See [CONTRIBUTING](docs/contributing.md) for how to write and submit lessons.

## 📜 License

[GNU General Public License v3.0](LICENSE)
