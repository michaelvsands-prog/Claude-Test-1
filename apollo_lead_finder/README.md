# Apollo Lead Finder MVP

A Streamlit app that takes a list of companies/domains, searches Apollo for target operations leaders, optionally enriches contacts, scores title fit, and exports a CSV.

## What it does

- Upload a CSV with `Company` and `Domain`
- Search Apollo People API by company domain and target titles
- Optionally run Apollo People Enrichment
- Rank contacts with a simple confidence score
- Export results to CSV

## Setup

```bash
python -m venv .venv
source .venv/bin/activate  # Mac/Linux
# .venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Set your Apollo API key:

```bash
export APOLLO_API_KEY="your_api_key_here"
```

Or paste it into the sidebar when the app runs.

## Run

```bash
streamlit run app.py
```

## Input CSV format

```csv
Company,Domain
BlackRock,blackrock.com
Vanguard,vanguard.com
```

## Notes

- Apollo People Search results mask last names and emails by default; the app uses Apollo's enrichment endpoint with the person's Apollo ID to unlock full details.
- Email reveal may consume credits depending on your Apollo plan.
- This MVP avoids direct LinkedIn scraping. It uses LinkedIn URLs returned by Apollo.
- For a production version, add retries, rate limit handling, persistent storage, user auth, and a licensed asset manager universe source.
