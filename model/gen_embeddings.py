# This is the code we used to generate embedding vectors for flights data
# Accuracy of this approach was a bit lower than Random Forest tho

import os, json, math, argparse, calendar, re, sys, subprocess
from typing import Dict, Tuple, List, Optional
import numpy as np
import pandas as pd

TIME_PERIOD_MIN = 1440.0
DISTANCE_SCALE = 1000.0
ELAPSED_SCALE  = 300.0
ROUTE_VEC_DIV  = 2.0
COORD_SCALE    = 1.0

REQUIRED_COLUMNS = [
    "Month", "DayofMonth", "DayOfWeek", "Reporting_Airline",
    "Origin", "Dest", "CRSDepTime", "CRSArrTime",
    "DepDelay", "ArrDelay", "CRSElapsedTime", "Distance",
    "is_christmas_eve", "is_thanksgiving"
]

FALLBACK_AIRPORTS = {
    "LGA": (40.7769, -73.8740),
    "JFK": (40.6413, -73.7781),
    "BDL": (41.9389, -72.6833),
    "BGM": (42.2087, -75.9799),
    "PIT": (40.4914, -80.2329),
    "MSP": (44.8820, -93.2218),
    "BWI": (39.1754, -76.6684),
    "BGR": (44.8074, -68.8281),
}

def hhmm_to_minutes(val) -> Optional[int]:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        ival = int(val)
        h = ival // 100
        m = ival % 100
        if m >= 60:
            h += m // 60
            m = m % 60
        if h == 24:
            h = 0
        return int(h * 60 + m)
    except Exception:
        try:
            s = str(val).strip().zfill(4)[-4:]
            h = int(s[:2]); m = int(s[2:])
            if m >= 60:
                h += m // 60
                m = m % 60
            if h == 24:
                h = 0
            return int(h * 60 + m)
        except Exception:
            return None

def sin_cos(angle_fraction: float) -> Tuple[float, float]:
    a = 2.0 * math.pi * angle_fraction
    return math.sin(a), math.cos(a)

def latlon_to_xyz(lat_deg: float, lon_deg: float) -> Tuple[float, float, float]:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    x = math.cos(lat) * math.cos(lon)
    y = math.cos(lat) * math.sin(lon)
    z = math.sin(lat)
    return (x, y, z)

def initial_bearing_sin_cos(lat1_deg: float, lon1_deg: float, lat2_deg: float, lon2_deg: float) -> Tuple[float, float]:
    lat1 = math.radians(lat1_deg); lon1 = math.radians(lon1_deg)
    lat2 = math.radians(lat2_deg); lon2 = math.radians(lon2_deg)
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return math.sin(bearing), math.cos(bearing)

def read_airports_csv(airports_csv: str) -> Dict[str, Tuple[float, float]]:
    df = pd.read_csv(airports_csv)
    cols = {c.lower(): c for c in df.columns}
    iata_col = None
    for cand in ["iata", "iata_code", "code", "ident"]:
        if cand.lower() in cols:
            iata_col = cols[cand.lower()]
            break
    if iata_col is None:
        raise ValueError("Could not find IATA column in airports CSV. Expected one of: iata, iata_code, code, ident")
    lat_col = None; lon_col = None
    for cand in ["lat", "latitude", "latitude_deg", "lat_deg"]:
        if cand.lower() in cols:
            lat_col = cols[cand.lower()]
            break
    for cand in ["lon", "lng", "longitude", "longitude_deg", "lon_deg"]:
        if cand.lower() in cols:
            lon_col = cols[cand.lower()]
            break
    if lat_col is None or lon_col is None:
        raise ValueError("Could not find latitude/longitude columns in airports CSV.")
    mapping = {}
    for _, row in df.iterrows():
        code = str(row[iata_col]).strip().upper()
        if not code or code == "nan" or len(code) != 3:
            continue
        try:
            lat = float(row[lat_col]); lon = float(row[lon_col])
            if not (math.isnan(lat) or math.isnan(lon)):
                mapping[code] = (lat, lon)
        except Exception:
            continue
    return mapping

def load_airports_from_package() -> Dict[str, Tuple[float, float]]:
    try:
        from airportsdata import load
    except Exception:
        print("Package 'airportsdata' not available. Consider: pip install airportsdata")
        return {}
    try:
        db = load("IATA")
    except Exception as e:
        print(f"airportsdata.load('IATA') failed: {e}")
        return {}
    mapping = {}
    for code, rec in db.items():
        try:
            lat = float(rec.get("lat"))
            lon = float(rec.get("lon"))
            if not (math.isnan(lat) or math.isnan(lon)):
                mapping[str(code).upper()] = (lat, lon)
        except Exception:
            continue
    return mapping

def build_airport_lookup(airports_csv: Optional[str]) -> Dict[str, Tuple[float, float]]:
    mapping = load_airports_from_package()
    if mapping:
        print(f"Loaded {len(mapping):,} airports from 'airportsdata' package.")
        return mapping
    if airports_csv and os.path.exists(airports_csv):
        print(f"Loading airports from CSV: {airports_csv}")
        try:
            return read_airports_csv(airports_csv)
        except Exception as e:
            print(f"Failed to read airports CSV: {e}")
    print("Using fallback mapping (limited). Some rows may be skipped if codes are missing.")
    return dict(FALLBACK_AIRPORTS)

def clean_and_require(df: pd.DataFrame) -> pd.DataFrame:
    for c in REQUIRED_COLUMNS:
        if c in df.columns:
            if df[c].dtype == object:
                df[c] = df[c].astype(str).str.strip()
                df[c] = df[c].replace({"": np.nan, "nan": np.nan, "None": np.nan})
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")
    df2 = df.dropna(subset=REQUIRED_COLUMNS, how="any").copy()
    return df2

def extract_year_month_from_path(path: str) -> Tuple[int, int]:
    m = re.search(r'(\d{4})[\\/](\d{4})_(\d{1,2})\.csv$', path)
    if not m:
        m2 = re.search(r'(\d{4})[\\/].*?(\d{1,2})\.csv$', path)
        if not m2:
            raise ValueError(f"Cannot parse year/month from: {path}")
        return int(m2.group(1)), int(m2.group(2))
    return int(m.group(1)), int(m.group(3))

def days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]

def build_airline_stats(root: str, airport_map: Dict[str, Tuple[float,float]]) -> Dict[str, dict]:
    sums = {}
    counts = {}
    dep_sin_sum = {}
    dep_cos_sum = {}
    distance_sum = {}
    for year_dir in sorted(os.listdir(root)):
        year_path = os.path.join(root, year_dir)
        if not os.path.isdir(year_path) or not year_dir.isdigit():
            continue
        for fname in os.listdir(year_path):
            if not fname.endswith(".csv"):
                continue
            file_path = os.path.join(year_path, fname)
            try:
                year, month = extract_year_month_from_path(file_path)
                df = pd.read_csv(file_path)
            except Exception as e:
                print(f"Skipping {file_path}: {e}")
                continue
            try:
                df = clean_and_require(df)
            except Exception as e:
                print(f"Skipping {file_path} (schema): {e}")
                continue

            dep_min = df["CRSDepTime"].apply(hhmm_to_minutes)
            mask_valid_time = dep_min.notna()
            df = df[mask_valid_time].copy()
            dep_min = dep_min[mask_valid_time].astype(int)

            def map_airport(code):
                return airport_map.get(str(code).strip().upper())

            orig_ll = df["Origin"].map(map_airport)
            dest_ll = df["Dest"].map(map_airport)
            mask_known = orig_ll.notna() & dest_ll.notna()
            df = df[mask_known].copy()
            if df.empty:
                continue
            orig_ll = orig_ll[mask_known]
            dest_ll = dest_ll[mask_known]

            orig_xyz = np.array([latlon_to_xyz(lat, lon) for (lat, lon) in orig_ll])
            dest_xyz = np.array([latlon_to_xyz(lat, lon) for (lat, lon) in dest_ll])
            mid_xyz = (orig_xyz + dest_xyz) / 2.0

            airlines = df["Reporting_Airline"].astype(str).str.strip().values
            dists = pd.to_numeric(df["Distance"], errors="coerce").fillna(0.0).values
            dep_f = dep_min.values.astype(float) / 1440.0
            dep_sin = np.sin(2.0 * np.pi * dep_f)
            dep_cos = np.cos(2.0 * np.pi * dep_f)

            for i, al in enumerate(airlines):
                if al not in sums:
                    sums[al] = np.zeros(3, dtype=float)
                    counts[al] = 0
                    dep_sin_sum[al] = 0.0
                    dep_cos_sum[al] = 0.0
                    distance_sum[al] = 0.0
                sums[al] += mid_xyz[i]
                counts[al] += 1
                dep_sin_sum[al] += float(dep_sin[i])
                dep_cos_sum[al] += float(dep_cos[i])
                distance_sum[al] += float(dists[i])
    stats = {}
    for al, cnt in counts.items():
        if cnt <= 0:
            continue
        centroid = (sums[al] / cnt).tolist()
        s = dep_sin_sum[al] / cnt
        c = dep_cos_sum[al] / cnt
        norm = math.hypot(s, c)
        if norm > 1e-8:
            s /= norm; c /= norm
        mean_dist = distance_sum[al] / cnt
        stats[al] = {
            "centroid_xyz": centroid,
            "typical_dep_sin": float(s),
            "typical_dep_cos": float(c),
            "mean_distance_miles": float(mean_dist),
        }
    return stats

def build_airport_counts(root: str) -> Dict[str, int]:
    counts = {}
    for year_dir in sorted(os.listdir(root)):
        year_path = os.path.join(root, year_dir)
        if not os.path.isdir(year_path) or not year_dir.isdigit():
            continue
        for fname in os.listdir(year_path):
            if not fname.endswith(".csv"):
                continue
            file_path = os.path.join(year_path, fname)
            try:
                df = pd.read_csv(file_path, usecols=["Origin", "Dest"])
            except Exception:
                continue
            for col in ["Origin", "Dest"]:
                vals = df[col].astype(str).str.strip().str.upper()
                for code in vals:
                    if not code or code == "NAN":
                        continue
                    counts[code] = counts.get(code, 0) + 1
    return counts

def normalize_counts(counts: Dict[str, int]) -> Dict[str, float]:
    if not counts:
        return {}
    arr = np.array(list(counts.values()), dtype=float)
    p95 = np.percentile(arr, 95)
    if p95 <= 0:
        p95 = arr.max() if arr.size else 1.0
    norm = {}
    for k, v in counts.items():
        norm[k] = min(1.0, float(v) / float(p95))
    return norm

def make_feature_names() -> List[str]:
    return [
        "month_sin","month_cos","dom_sin","dom_cos","dow_sin","dow_cos",
        "dep_time_sin","dep_time_cos","arr_time_sin","arr_time_cos",
        "orig_x","orig_y","orig_z","dest_x","dest_y","dest_z",
        "route_dx","route_dy","route_dz","route_bear_sin","route_bear_cos",
        "crs_elapsed_scaled","distance_scaled","is_christmas_eve","is_thanksgiving",
        "airline_cx","airline_cy","airline_cz","airline_dep_sin","airline_dep_cos","airline_mean_distance_scaled",
        "origin_busyness","dest_busyness",
        "DepDelay","ArrDelay",
    ]

def embed_row(row: pd.Series,
              year: int,
              airport_map: Dict[str, Tuple[float,float]],
              airline_stats: Dict[str, dict],
              airport_busyness: Dict[str, float]) -> Optional[List[float]]:
    try:
        month  = int(row["Month"])
        dom    = int(row["DayofMonth"])
        dow    = int(row["DayOfWeek"])
        dep_m  = hhmm_to_minutes(row["CRSDepTime"])
        arr_m  = hhmm_to_minutes(row["CRSArrTime"])
        dist   = float(row["Distance"])
        elap   = float(row["CRSElapsedTime"])
        xmas   = int(row["is_christmas_eve"])
        tgiv   = int(row["is_thanksgiving"])
        dep_delay = float(row["DepDelay"])
        arr_delay = float(row["ArrDelay"])
    except Exception:
        return None

    if None in (dep_m, arr_m):
        return None

    try:
        dim = calendar.monthrange(year, month)[1]
    except Exception:
        dim = 31

    ms, mc = sin_cos((month - 1) / 12.0)
    ds, dc = sin_cos((dom - 1) / float(max(1, dim)))
    ws, wc = sin_cos((dow - 1) / 7.0)
    dps, dpc = sin_cos(dep_m / TIME_PERIOD_MIN)
    ars, arc = sin_cos(arr_m / TIME_PERIOD_MIN)

    o_code = str(row["Origin"]).strip().upper()
    d_code = str(row["Dest"]).strip().upper()
    if o_code not in airport_map or d_code not in airport_map:
        return None
    o_lat, o_lon = airport_map[o_code]
    d_lat, d_lon = airport_map[d_code]
    o_xyz = np.array(latlon_to_xyz(o_lat, o_lon), dtype=float)
    d_xyz = np.array(latlon_to_xyz(d_lat, d_lon), dtype=float)

    route_vec = (d_xyz - o_xyz) / ROUTE_VEC_DIV
    rbs, rbc = initial_bearing_sin_cos(o_lat, o_lon, d_lat, d_lon)

    o_xyz *= COORD_SCALE
    d_xyz *= COORD_SCALE
    route_vec *= COORD_SCALE

    elap_s = elap / ELAPSED_SCALE
    dist_s = dist / DISTANCE_SCALE

    al = str(row["Reporting_Airline"]).strip()
    a_cx = a_cy = a_cz = a_ds = a_dc = 0.0
    a_md = 0.0
    if al in airline_stats:
        ainfo = airline_stats[al]
        cx, cy, cz = ainfo["centroid_xyz"]
        a_cx, a_cy, a_cz = COORD_SCALE * float(cx), COORD_SCALE * float(cy), COORD_SCALE * float(cz)
        a_ds, a_dc = float(ainfo["typical_dep_sin"]), float(ainfo["typical_dep_cos"])
        a_md = float(ainfo["mean_distance_miles"]) / DISTANCE_SCALE

    ob = airport_busyness.get(o_code, 0.0)
    db = airport_busyness.get(d_code, 0.0)

    vec = [
        ms, mc, ds, dc, ws, wc, dps, dpc, ars, arc,
        float(o_xyz[0]), float(o_xyz[1]), float(o_xyz[2]),
        float(d_xyz[0]), float(d_xyz[1]), float(d_xyz[2]),
        float(route_vec[0]), float(route_vec[1]), float(route_vec[2]),
        rbs, rbc,
        elap_s, dist_s, float(xmas), float(tgiv),
        a_cx, a_cy, a_cz, a_ds, a_dc, a_md,
        float(ob), float(db),
        dep_delay, arr_delay
    ]
    return vec

def process_month_file(file_path: str,
                       output_dir: str,
                       airport_map: Dict[str, Tuple[float,float]],
                       airline_stats: Dict[str, dict],
                       airport_busyness: Dict[str, float]) -> dict:
    year, month = extract_year_month_from_path(file_path)
    print(f"Embedding {file_path} ...")
    df = pd.read_csv(file_path)
    df = clean_and_require(df)

    df["dep_min"] = df["CRSDepTime"].apply(hhmm_to_minutes)
    df["arr_min"] = df["CRSArrTime"].apply(hhmm_to_minutes)
    df = df[df["dep_min"].notna() & df["arr_min"].notna()].copy()

    feature_names = make_feature_names()
    rows = []
    ids = []
    dropped_unknown_airport = 0
    for idx, row in df.iterrows():
        vec = embed_row(row, year, airport_map, airline_stats, airport_busyness)
        if vec is None:
            o = str(row.get("Origin", "")); d = str(row.get("Dest", ""))
            if o.upper() not in airport_map or d.upper() not in airport_map:
                dropped_unknown_airport += 1
            continue
        rows.append(vec)
        rid = f"{year}-{int(row['Month']):02d}-{int(row['DayofMonth']):02d}_{row['Reporting_Airline']}_{row['Origin']}-{row['Dest']}_{row['CRSDepTime']}"
        ids.append(rid)

    X = np.array(rows, dtype=np.float32)
    os.makedirs(output_dir, exist_ok=True)
    year_dir = os.path.join(output_dir, str(year))
    os.makedirs(year_dir, exist_ok=True)

    base = os.path.splitext(os.path.basename(file_path))[0]
    csv_path = os.path.join(year_dir, f"{base}_embeddings.csv")

    out_df = pd.DataFrame(X, columns=feature_names)
    out_df.insert(0, "row_id", ids)
    out_df.to_csv(csv_path, index=False)

    stats = {
        "file": file_path,
        "year": year,
        "month": month,
        "rows_in": int(len(df)),
        "rows_out": int(X.shape[0]),
        "dropped_unknown_airport": int(dropped_unknown_airport),
        "csv": csv_path,
        "coord_scale": COORD_SCALE,
        "route_vec_div": ROUTE_VEC_DIV,
    }
    print(f" -> {X.shape[0]} embeddings written | dropped_unknown_airport={dropped_unknown_airport}")
    return stats

def main():
    parser = argparse.ArgumentParser(description="Convert flights to vector embeddings")
    parser.add_argument("--root", default="/Users/maksimkrylykov/Desktop/HackGT/flights_data")
    parser.add_argument("--output", default="./flights_embeddings")
    parser.add_argument("--airports-csv", default=None)
    args = parser.parse_args()

    root = args.root
    out_dir = args.output

    airport_map = build_airport_lookup(airports_csv=args.airports_csv)

    print("First pass: computing airline embeddings and airport busyness...")
    airline_stats = build_airline_stats(root, airport_map)
    airport_counts = build_airport_counts(root)
    airport_busyness = normalize_counts(airport_counts)
    print(f"Computed airline stats for {len(airline_stats)} airlines; airport busyness for {len(airport_busyness)} airports.")

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "airline_embeddings.json"), "w", encoding="utf-8") as f:
        json.dump(airline_stats, f, indent=2)
    with open(os.path.join(out_dir, "airport_busyness.json"), "w", encoding="utf-8") as f:
        json.dump(airport_busyness, f, indent=2)
    with open(os.path.join(out_dir, "feature_schema.json"), "w", encoding="utf-8") as f:
        json.dump({"features": make_feature_names()}, f, indent=2)
    with open(os.path.join(out_dir, "config.json"), "w", encoding="utf-8") as f:
        json.dump({
            "root": root,
            "distance_scale": DISTANCE_SCALE,
            "elapsed_scale": ELAPSED_SCALE,
            "route_vec_div": ROUTE_VEC_DIV,
            "coord_scale": COORD_SCALE,
            "airports_source": "airportsdata/csv/fallback"
        }, f, indent=2)

    manifest = {"root": root, "output_dir": out_dir, "files": []}
    for year_dir in sorted(os.listdir(root)):
        year_path = os.path.join(root, year_dir)
        if not os.path.isdir(year_path) or not year_dir.isdigit():
            continue
        for fname in sorted(os.listdir(year_path)):
            if not fname.endswith(".csv"):
                continue
            file_path = os.path.join(year_path, fname)
            try:
                stats = process_month_file(file_path, out_dir, airport_map, airline_stats, airport_busyness)
                manifest["files"].append(stats)
            except Exception as e:
                print(f"Failed to process {file_path}: {e}")

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone. Embeddings and metadata are in: {os.path.abspath(out_dir)}")

if __name__ == "__main__":
    main()

'''
python3 gen_embeddings.py \
  --root "/Users/maksimkrylykov/Desktop/HackGT/flights_data" \
  --output "./flights_embeddings"
'''