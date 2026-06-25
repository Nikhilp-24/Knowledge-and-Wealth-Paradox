
import pandas as pd, os

OUT     = r"C:\Users\nikhi\Downloads\CS661_Dataset"
MASTER  = os.path.join(OUT, "master_dataset.csv")
SCIMAGO = os.path.join(OUT, "scimago_country_rank.csv")  # from Kaggle

master = pd.read_csv(MASTER)
sjr    = pd.read_csv(SCIMAGO)

# Standardise columns - adjust if Kaggle schema differs
sjr = sjr.rename(columns={
    "Country":              "Country_Name_SJR",
    "Documents":            "Total_Docs",
    "Citable documents":    "Citable_Docs",
    "Citations per document":"Citations_Per_Doc",
    "H index":              "H_Index",
    "Year":                 "Year",
})

# Add ISO-3 codes
import pycountry
MANUAL = {"United States":"USA","United Kingdom":"GBR","South Korea":"KOR",
           "Russia":"RUS","Iran":"IRN","Taiwan":"TWN","Hong Kong":"HKG",
           "Vietnam":"VNM","Czech Republic":"CZE"}

def name2iso3(n):
    if n in MANUAL: return MANUAL[n]
    try: return pycountry.countries.search_fuzzy(str(n))[0].alpha_3
    except: return None

sjr["Country_Code"] = sjr["Country_Name_SJR"].map(name2iso3)
sjr["Year"] = sjr["Year"].astype("Int64")
master["Year"] = master["Year"].astype("Int64")

keep = ["Country_Code","Year","Total_Docs","Citable_Docs",
        "Citations_Per_Doc","H_Index"]
if "Q1_Percent" in sjr.columns: keep.append("Q1_Percent")
if "Q4_Percent" in sjr.columns: keep.append("Q4_Percent")

sjr_clean = sjr[[c for c in keep if c in sjr.columns]].dropna(subset=["Country_Code"])
merged = master.merge(sjr_clean, on=["Country_Code","Year"], how="left", suffixes=("","_sjr"))

for col in ["Total_Docs","Citable_Docs","Citations_Per_Doc","H_Index","Q1_Percent","Q4_Percent"]:
    if col + "_sjr" in merged.columns:
        merged[col] = merged[col].fillna(merged[col + "_sjr"])
        merged.drop(columns=[col + "_sjr"], inplace=True)

merged.to_csv(MASTER, index=False)
print(f"Master updated with SCImago data: {len(merged)} rows")
pct = merged["H_Index"].notna().mean() * 100
print(f"H_Index fill rate: {pct:.1f}%")
