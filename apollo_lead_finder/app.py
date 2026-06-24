import os
import time
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import streamlit as st

APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search"
APOLLO_ENRICH_URL = "https://api.apollo.io/api/v1/people/match"

DEFAULT_TITLES = [
    "Head of Investment Operations",
    "Global Head of Investment Operations",
    "Head of Operations",
    "Chief Operating Officer",
    "COO",
    "Director of Investment Operations",
    "VP Investment Operations",
    "Head of Middle Office",
    "Director Middle Office",
    "Head of Portfolio Operations",
]

SENIORITY_LEVELS = ["owner", "founder", "c_suite", "partner", "vp", "head", "director"]


def get_api_key() -> Optional[str]:
    return st.session_state.get("apollo_api_key") or os.getenv("APOLLO_API_KEY")


def normalize_domain(value: Any) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip().lower()
    text = text.replace("https://", "").replace("http://", "").replace("www.", "")
    return text.split("/")[0]


def score_person(person: Dict[str, Any]) -> Tuple[int, str]:
    title = (person.get("title") or "").lower()
    score = 0
    reasons = []

    if "investment operations" in title:
        score += 55
        reasons.append("exact investment operations title")
    if "middle office" in title:
        score += 35
        reasons.append("middle office title")
    if "operations" in title:
        score += 25
        reasons.append("operations title")
    if "chief operating officer" in title or title == "coo" or " coo" in title:
        score += 20
        reasons.append("COO title")
    if any(word in title for word in ["head", "global head", "chief"]):
        score += 20
        reasons.append("senior/head-level")
    if any(word in title for word in ["director", "vp", "vice president", "managing director"]):
        score += 12
        reasons.append("senior leadership")

    if person.get("linkedin_url"):
        score += 5
        reasons.append("LinkedIn available")

    score = min(score, 100)
    if score >= 75:
        confidence = "High"
    elif score >= 45:
        confidence = "Medium"
    else:
        confidence = "Low"

    return score, f"{confidence}: " + "; ".join(reasons[:4])


def apollo_headers(api_key: str) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": api_key,
    }


def search_people(api_key: str, domain: str, titles: List[str], page: int = 1, per_page: int = 10) -> List[Dict[str, Any]]:
    payload = {
        "q_organization_domains_list": [domain],
        "person_titles": titles,
        "person_seniorities": SENIORITY_LEVELS,
        "include_similar_titles": True,
        "page": page,
        "per_page": per_page,
    }
    resp = requests.post(APOLLO_SEARCH_URL, headers=apollo_headers(api_key), json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    people = data.get("people") or data.get("contacts") or []
    st.session_state["last_raw_search_response"] = data
    return people


def enrich_person(api_key: str, person: Dict[str, Any], domain: str, reveal_emails: bool) -> Dict[str, Any]:
    person_id = person.get("id")
    name = person.get("name") or ""
    first_name = person.get("first_name") or (name.split()[0] if name else None)
    last_name = person.get("last_name") or (name.split()[-1] if len(name.split()) > 1 else None)
    linkedin_url = person.get("linkedin_url")

    if not person_id and not first_name and not last_name and not linkedin_url:
        raise ValueError(
            "Apollo search result has no id, name, or LinkedIn URL to match on "
            "(check 'Show raw Apollo response' below to see what Apollo actually returned)"
        )

    # Search results mask last names (e.g. "Sh***a") and omit emails for
    # privacy. Apollo's own person "id" from the search result lets us
    # unlock the full record directly instead of re-matching on a masked name.
    payload = {
        "id": person_id,
        "first_name": first_name,
        "last_name": last_name,
        "organization_name": (person.get("organization") or {}).get("name"),
        "domain": domain,
        "linkedin_url": linkedin_url,
        "reveal_personal_emails": False,
    }
    if reveal_emails:
        payload["reveal_personal_emails"] = True
        # run_waterfall_email requires a webhook_url for its async callback,
        # which doesn't apply to this local script, so we skip it.

    payload = {k: v for k, v in payload.items() if v}
    resp = requests.post(APOLLO_ENRICH_URL, headers=apollo_headers(api_key), json=payload, timeout=30)
    if resp.status_code == 400:
        raise ValueError(f"Apollo rejected the enrichment request: {resp.text[:300]}")
    resp.raise_for_status()
    data = resp.json()
    return data.get("person") or data.get("contact") or {}


def build_row(company: str, domain: str, person: Dict[str, Any], enriched: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    enriched = enriched or {}
    merged = {**person, **{k: v for k, v in enriched.items() if v}}
    org = merged.get("organization") or person.get("organization") or {}
    score, confidence = score_person(merged)

    email = merged.get("email") or merged.get("sanitized_email") or ""
    if not email and merged.get("email_status") == "unavailable":
        email = "Unavailable"

    return {
        "Company": company,
        "Domain": domain,
        "Person": merged.get("name") or "",
        "Title": merged.get("title") or "",
        "LinkedIn": merged.get("linkedin_url") or "",
        "Email": email,
        "Email Status": merged.get("email_status") or "",
        "Apollo Person ID": merged.get("id") or person.get("id") or "",
        "Organization": org.get("name") or company,
        "Confidence Score": score,
        "Confidence Notes": confidence,
    }


def process_companies(df: pd.DataFrame, company_col: str, domain_col: str, titles: List[str], max_people: int, enrich: bool, reveal_emails: bool) -> pd.DataFrame:
    api_key = get_api_key()
    if not api_key:
        st.error("Add your Apollo API key in the sidebar or set APOLLO_API_KEY in your environment.")
        return pd.DataFrame()

    rows = []
    progress = st.progress(0)
    status = st.empty()

    clean_df = df.copy()
    clean_df[domain_col] = clean_df[domain_col].apply(normalize_domain)
    clean_df = clean_df[clean_df[domain_col].astype(bool)]

    total = len(clean_df)
    for i, (_, record) in enumerate(clean_df.iterrows(), start=1):
        company = str(record[company_col]).strip()
        domain = str(record[domain_col]).strip()
        status.write(f"Searching {company} ({domain})...")
        try:
            people = search_people(api_key, domain, titles, per_page=max_people)
            if not people:
                rows.append({"Company": company, "Domain": domain, "Person": "", "Title": "", "LinkedIn": "", "Email": "", "Email Status": "", "Apollo Person ID": "", "Organization": company, "Confidence Score": 0, "Confidence Notes": "No match found"})
            for person in people:
                enriched = {}
                if enrich:
                    try:
                        enriched = enrich_person(api_key, person, domain, reveal_emails)
                        time.sleep(0.2)
                    except Exception as e:
                        enriched = {"email_status": f"enrichment error: {e}"}
                rows.append(build_row(company, domain, person, enriched))
        except Exception as e:
            rows.append({"Company": company, "Domain": domain, "Person": "", "Title": "", "LinkedIn": "", "Email": "", "Email Status": "", "Apollo Person ID": "", "Organization": company, "Confidence Score": 0, "Confidence Notes": f"Search error: {e}"})

        progress.progress(i / total if total else 1.0)
        time.sleep(0.1)

    result = pd.DataFrame(rows)
    if not result.empty:
        result = result.sort_values(["Company", "Confidence Score"], ascending=[True, False])
    status.write("Done.")
    return result


st.set_page_config(page_title="Apollo Lead Finder", layout="wide")
st.title("Apollo Lead Finder")
st.caption("Find target contacts by company domain, rank title fit, enrich, and export.")

with st.sidebar:
    st.header("Settings")
    st.session_state["apollo_api_key"] = st.text_input("Apollo API Key", type="password", value=st.session_state.get("apollo_api_key", ""))
    max_people = st.slider("Max people per company", 1, 25, 8)
    enrich = st.checkbox("Run Apollo enrichment", value=True)
    reveal_emails = st.checkbox("Reveal emails / run waterfall email", value=True, help="May consume Apollo credits depending on your plan.")

st.subheader("1. Upload company CSV")
st.write("Your CSV should include at least company name and domain columns.")
uploaded = st.file_uploader("Upload CSV", type=["csv"])

if uploaded:
    input_df = pd.read_csv(uploaded)
else:
    input_df = pd.DataFrame({
        "Company": ["BlackRock", "Vanguard", "Fidelity Investments"],
        "Domain": ["blackrock.com", "vanguard.com", "fidelity.com"],
    })
    st.info("Using sample data until you upload a CSV.")

st.dataframe(input_df, use_container_width=True)

cols = list(input_df.columns)
company_col = st.selectbox("Company column", cols, index=cols.index("Company") if "Company" in cols else 0)
domain_col = st.selectbox("Domain column", cols, index=cols.index("Domain") if "Domain" in cols else min(1, len(cols) - 1))

st.subheader("2. Define target titles")
titles_text = st.text_area("Titles to search", value="\n".join(DEFAULT_TITLES), height=180)
titles = [t.strip() for t in titles_text.splitlines() if t.strip()]

st.subheader("3. Run search")
if st.button("Find contacts", type="primary"):
    results = process_companies(input_df, company_col, domain_col, titles, max_people, enrich, reveal_emails)
    st.session_state["results"] = results

results_df = st.session_state.get("results")
if isinstance(results_df, pd.DataFrame) and not results_df.empty:
    st.subheader("Results")
    st.dataframe(results_df, use_container_width=True)
    csv = results_df.to_csv(index=False).encode("utf-8")
    st.download_button("Download CSV", csv, "apollo_lead_finder_results.csv", "text/csv")

raw_response = st.session_state.get("last_raw_search_response")
if raw_response:
    with st.expander("Show raw Apollo response (debug)"):
        st.json(raw_response)
