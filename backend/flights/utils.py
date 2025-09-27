import pandas as pd
import numpy as np
import math
import json
import os
from datetime import datetime
import airportsdata
from zoneinfo import ZoneInfo
from joblib import dump, load
from pandas.tseries.holiday import USFederalHolidayCalendar as USCal
from django.conf import settings
from sklearn.preprocessing import OrdinalEncoder

PARSER_PROMPT: str = """
You are an expert travel document parser. Your task is to extract structured data from a SINGLE uploaded file
(boarding pass PDF/image, mobile pass screenshot, email, or any other document). You must return STRICT JSON ONLY
(conforming exactly to the schema below). Do not include explanations.

GOAL
- Determine if the file is a boarding pass for an airline flight.
- If YES, extract all required fields for each flight segment you can find.
- If NO (e.g., receipt, itinerary, email, unrelated image), set "relevant": false and still include best-effort context in "notes".

OUTPUT SCHEMA (return exactly this JSON shape)
{
  "relevant": true | false,
  "segments": [
    {
      "departure_airport": "AAA",                # 3-letter IATA airport code, uppercase
      "arrival_airport": "BBB",                  # 3-letter IATA airport code, uppercase
      "departure_datetime_local": "YYYY-MM-DDTHH:MM",  # local time at departure airport, 24h
      "arrival_datetime_local": "YYYY-MM-DDTHH:MM",    # local time at arrival airport, 24h
      "airline_iata": "XX",                      # 2-letter IATA airline code, uppercase
      "flight_number": "XX####"                  # airline_iata followed by 1–4 digits, no spaces (e.g., "DL1234")
    }
  ],
  "missing_fields": [                            # list any fields you cannot determine (per segment index if multi)
    "segments[0].arrival_datetime_local",
    "segments[1].airline_iata"
  ],
  "notes": "Short rationale: sources in the text that led to values, assumptions, or ambiguities."
}

STRICT RULES
1) JSON ONLY. No markdown, no comments, no trailing commas.
2) "relevant" MUST be:
   - true  if the file is a boarding pass (mobile, paper, PDF, or screenshot of a pass).
   - false if it is NOT a boarding pass (e.g., itinerary email, booking confirmation, hotel voucher, random image).
3) Required data per segment:
   - departure/arrival date & time (local, 24h, 'YYYY-MM-DDTHH:MM').
   - departure/arrival airport codes (IATA 3-letter, uppercase).
   - airline_iata (MUST be 2-letter IATA code, uppercase).
   - flight_number (airline_iata immediately followed by digits, e.g., "UA15", no spaces).
4) If multiple segments (connections), include ALL segments in chronological order under "segments".
5) If a required field is not present, put null for that field and enumerate it in "missing_fields".
6) DO NOT guess airport codes or airline codes beyond what the document clearly implies.
7) Timezones:
   - Write local times, not UTC, using 24h "YYYY-MM-DDTHH:MM". If only a time is shown without date, infer date from context
     (e.g., same-day on the pass) when clearly indicated; otherwise set to null and explain in notes.
8) Airline code rules:
   - Prefer the 2-letter IATA code printed on the pass.
   - If the flight is shown as "XX1234" (letters+digits with no space or with a space), treat "XX" as airline_iata.
   - If ONLY an airline name (e.g., "Delta Air Lines") is present and no code is shown, attempt to map to the common IATA code
     ONLY IF you are 100% certain from the document text (e.g., same code appears elsewhere); otherwise set airline_iata to null.
9) Airport code rules:
   - Accept only 3-letter uppercase IATA (e.g., "JFK", "LHR"). If only city names are present (e.g., "New York"), do not invent codes:
     leave the code null and list it in "missing_fields".
10) Date/time parsing:
   - Normalize AM/PM to 24h. Examples: "7:05 PM" -> "19:05".
   - Accept formats like "2025-09-26", "26 Sep 2025", "26/09/2025", etc.—normalize to "YYYY-MM-DD".
   - If only month/day appear, infer year if it’s clearly printed elsewhere on the pass; else set null.
11) Barcodes (PDF417/Aztec), SSR/PNR, seat, gate, and sequence numbers are irrelevant unless they directly help find required data.
12) If the file is not a boarding pass, set "relevant": false, and leave "segments" as an empty array [], "missing_fields" empty [],
    and put a brief explanation in "notes" (e.g., "This is a booking confirmation email, not a boarding pass.").

RECOGNITION HINTS (non-exhaustive)
- Common labels: "Boarding Pass", "Passenger", "From/To", "Departure/Arrival", "Dep/Arr", "Flight", "FLIGHT", "FLT",
  "Carrier", "Airline", "Gate", "Seat", "PNR", "Record Locator".
- Flight number patterns: ^([A-Z]{2})\s?(\d{1,4})\b  → airline_iata = group 1, flight_number = group1+group2 (no space).
- Airport codes: \b([A-Z]{3})\b near "From", "To", "DEP", "ARR", or the city names.
- Dates: look for day-month-year or month-day-year near departure/arrival blocks.
- Times: look for HH:MM optionally followed by AM/PM; convert to 24h.

VALIDATION BEFORE OUTPUT
- Uppercase all codes.
- Ensure "flight_number" starts with "airline_iata".
- Ensure time format is "YYYY-MM-DDTHH:MM" or null.
- If any per-segment required field is null, include its dotted path in "missing_fields".

EXAMPLES

# Example 1 (single segment, all fields known)
{
  "relevant": true,
  "segments": [
    {
      "departure_airport": "JFK",
      "arrival_airport": "LAX",
      "departure_datetime_local": "2025-09-26T14:35",
      "arrival_datetime_local": "2025-09-26T17:50",
      "airline_iata": "DL",
      "flight_number": "DL423"
    }
  ],
  "missing_fields": [],
  "notes": "Extracted from labels 'From JFK'/'To LAX'; flight shown as 'DL 423'; times printed as 2:35 PM and 5:50 PM (converted to 24h)."
}

# Example 2 (two segments; one missing arrival time)
{
  "relevant": true,
  "segments": [
    {
      "departure_airport": "ATL",
      "arrival_airport": "ORD",
      "departure_datetime_local": "2025-10-03T06:10",
      "arrival_datetime_local": "2025-10-03T07:45",
      "airline_iata": "UA",
      "flight_number": "UA1102"
    },
    {
      "departure_airport": "ORD",
      "arrival_airport": "SEA",
      "departure_datetime_local": "2025-10-03T09:20",
      "arrival_datetime_local": null,
      "airline_iata": "UA",
      "flight_number": "UA218"
    }
  ],
  "missing_fields": [
    "segments[1].arrival_datetime_local"
  ],
  "notes": "Second leg shows only departure time; no arrival time printed."
}

# Example 3 (not a boarding pass)
{
  "relevant": false,
  "segments": [],
  "missing_fields": [],
  "notes": "This is a booking confirmation email itinerary, not a boarding pass; lacks barcode/boarding labels and segment blocks."
}
"""

# --- helpers (from your script) ---
def hhmm_to_min_of_day(val):
    s = str(val).zfill(4)
    hh, mm = int(s[:-2]), int(s[-2:])
    return (hh * 60 + mm) % 1440

def hour_from_minute_of_day(minute):
    return (minute % 1440) // 60

def part_of_day_from_hour(h):
    bins = ["night"]*6 + ["morning"]*6 + ["afternoon"]*6 + ["evening"]*6
    return bins[h]

def add_cyclical_raw(value, period):
    angle = 2.0 * np.pi * (value % period) / period
    return np.sin(angle), np.cos(angle)

def season_from_month(m):
    if m in [12,1,2]: return "DJF"
    if m in [3,4,5]:  return "MAM"
    if m in [6,7,8]:  return "JJA"
    if m in [9,10,11]:return "SON"

def us_holiday_flags(date):
    cal = USCal()
    hol = cal.holidays(start=date - pd.Timedelta(days=2), end=date + pd.Timedelta(days=2))
    hol = pd.to_datetime(hol).normalize()
    is_holiday = date.normalize() in hol
    before = (date - pd.Timedelta(days=1)).normalize() in hol
    after  = (date + pd.Timedelta(days=1)).normalize() in hol
    return int(is_holiday), int(is_holiday or before or after)

def thanksgiving_week_flag(date):
    y = date.year
    fourth_thu = pd.date_range(f"{y}-11-01", f"{y}-11-30", freq="W-THU")[3]
    return int((date >= (fourth_thu - pd.Timedelta(days=3))) and (date <= (fourth_thu + pd.Timedelta(days=3))))

def xmas_nye_window_flag(date):
    m, d = date.month, date.day
    return int((m == 12 and d >= 20) or (m == 1 and d <= 5))

CARRIER_CATEGORY = {
    "AA":"legacy","UA":"legacy","DL":"legacy",
    "AS":"hybrid","B6":"lcc","WN":"lcc","HA":"hybrid",
    "NK":"ulcc","F9":"ulcc","G4":"ulcc",
    "9E":"regional","OO":"regional","YX":"regional","MQ":"regional","QX":"regional","YV":"regional"
}
SLOT_AIRPORTS = {"JFK","LGA","EWR","DCA"}

def map(date, airline, flight_number, origin, dest, dep_time, arr_time, elapsed_time, distance):
    # Parse date
    d = pd.to_datetime(date).normalize()
    year, month, dom, dow, quarter = d.year, d.month, d.day, d.isoweekday(), (d.month-1)//3 + 1

    week_of_year = d.isocalendar().week
    day_of_year = d.day_of_year
    is_month_start = int(d.is_month_start)
    is_month_end = int(d.is_month_end)
    is_weekend = int(dow in [6,7])
    season = season_from_month(month)
    is_us_holiday, is_holiday_window = us_holiday_flags(d)
    is_thanksgiving_week = thanksgiving_week_flag(d)
    is_xmas_nye_window = xmas_nye_window_flag(d)
    is_peak_summer = int(month in [6,7,8])
    is_spring_break_season = int(month in [3,4])

    fn_int = int(''.join(filter(str.isdigit, str(flight_number))) or 0)
    fn_mod100 = fn_int % 100
    fn_series100s = fn_int // 100
    is_even = int(fn_int % 2 == 0)
    carrier_cat = CARRIER_CATEGORY.get(airline, "other")

    route = f"{origin}-{dest}"
    carrier_route = f"{airline}:{route}"
    origin_slot = int(origin in SLOT_AIRPORTS)
    dest_slot   = int(dest in SLOT_AIRPORTS)

    sched_dep_minute = hhmm_to_min_of_day(dep_time)
    sched_arr_minute = hhmm_to_min_of_day(arr_time)
    dep_hour = hour_from_minute_of_day(sched_dep_minute)
    arr_hour = hour_from_minute_of_day(sched_arr_minute)
    dep_minute_of_hour = sched_dep_minute % 60
    arr_minute_of_hour = sched_arr_minute % 60
    dep_min_sin, dep_min_cos = add_cyclical_raw(dep_minute_of_hour,60)
    arr_min_sin, arr_min_cos = add_cyclical_raw(arr_minute_of_hour,60)
    dep_part = part_of_day_from_hour(dep_hour)
    arr_part = part_of_day_from_hour(arr_hour)
    dep_hour_sin, dep_hour_cos = add_cyclical_raw(dep_hour,24)
    arr_hour_sin, arr_hour_cos = add_cyclical_raw(arr_hour,24)
    dow_sin, dow_cos = add_cyclical_raw(dow,7)
    month_sin, month_cos = add_cyclical_raw(month,12)

    dep_is_quarter = int(dep_minute_of_hour in [0,15,30,45])
    arr_is_quarter = int(arr_minute_of_hour in [0,15,30,45])
    dep_minute_quarter_delta = min(dep_minute_of_hour,60-dep_minute_of_hour,abs(dep_minute_of_hour-15),abs(dep_minute_of_hour-30),abs(dep_minute_of_hour-45))
    arr_minute_quarter_delta = min(arr_minute_of_hour,60-arr_minute_of_hour,abs(arr_minute_of_hour-15),abs(arr_minute_of_hour-30),abs(arr_minute_of_hour-45))

    is_first_wave     = int(dep_hour < 7)
    is_morning_rush   = int(7 <= dep_hour <= 9)
    is_midday         = int(10 <= dep_hour <= 15)
    is_afternoon_rush = int(16 <= dep_hour <= 19)
    is_late_night     = int(21 <= dep_hour <= 23)

    arrives_next_day_local = int((arr_hour < dep_hour) or (arr_hour == dep_hour and arr_minute_of_hour < dep_minute_of_hour))

    scheduled_avg_speed_mph = float(distance) / (float(elapsed_time)/60.0) if elapsed_time>0 else np.nan
    log_distance = np.log1p(distance)
    log_elapsed  = np.log1p(elapsed_time)
    baseline_minutes = distance * 60.0 / 450.0
    schedule_buffer_minutes = float(elapsed_time) - baseline_minutes

    row = {
        "FlightDate": d.strftime("%Y-%m-%d"), "Year":year,"Month":month,"DayofMonth":dom,"DayOfWeek":dow,"Quarter":quarter,
        "week_of_year":week_of_year,"day_of_year":day_of_year,"is_month_start":is_month_start,"is_month_end":is_month_end,
        "is_weekend":is_weekend,"season":season,"is_us_holiday":is_us_holiday,"is_holiday_window":is_holiday_window,
        "is_thanksgiving_week":is_thanksgiving_week,"is_xmas_nye_window":is_xmas_nye_window,
        "is_peak_summer":is_peak_summer,"is_spring_break_season":is_spring_break_season,
        "Reporting_Airline":airline,"Flight_Number_Reporting_Airline":flight_number,
        "flight_num_int":fn_int,"flight_num_mod100":fn_mod100,"flight_series_100s":fn_series100s,"is_even_flight":is_even,
        "carrier_category":carrier_cat,"Origin":origin,"Dest":dest,"route":route,"carrier_route":carrier_route,
        "origin_slot_controlled":origin_slot,"dest_slot_controlled":dest_slot,
        "CRSElapsedTime":elapsed_time,"Distance":distance,"scheduled_avg_speed_mph":scheduled_avg_speed_mph,
        "log_distance":log_distance,"log_crs_elapsed":log_elapsed,"schedule_buffer_minutes":schedule_buffer_minutes,
        "sched_dep_minute_of_day":sched_dep_minute,"sched_arr_minute_of_day":sched_arr_minute,
        "dep_hour":dep_hour,"arr_hour":arr_hour,"dep_minute_of_hour":dep_minute_of_hour,"arr_minute_of_hour":arr_minute_of_hour,
        "dep_minute_sin":dep_min_sin,"dep_minute_cos":dep_min_cos,"arr_minute_sin":arr_min_sin,"arr_minute_cos":arr_min_cos,
        "dep_part_of_day":dep_part,"arr_part_of_day":arr_part,"dep_hour_sin":dep_hour_sin,"dep_hour_cos":dep_hour_cos,
        "arr_hour_sin":arr_hour_sin,"arr_hour_cos":arr_hour_cos,"DayOfWeek_sin":dow_sin,"DayOfWeek_cos":dow_cos,
        "Month_sin":month_sin,"Month_cos":month_cos,"dep_is_quarter":dep_is_quarter,"arr_is_quarter":arr_is_quarter,
        "dep_minute_quarter_delta":dep_minute_quarter_delta,"arr_minute_quarter_delta":arr_minute_quarter_delta,
        "is_first_wave":is_first_wave,"is_morning_rush":is_morning_rush,"is_midday":is_midday,
        "is_afternoon_rush":is_afternoon_rush,"is_late_night":is_late_night,
        "arrives_next_day_local":arrives_next_day_local
    }

    return pd.DataFrame([row])


json_file_path = os.path.join(settings.BASE_DIR, 'flights', 'data', 'airports.json')
with open(json_file_path, 'r') as file:
    airports = json.load(file)


def get_coordinates(airport_code):
    return airports[airport_code]


def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
  
  
def minutes_after_midnight(datetime_str):
    dt = datetime.fromisoformat(datetime_str.replace('T', ' '))
    return dt.hour * 60 + dt.minute
  

airports_data = airportsdata.load('IATA')
  
def calculate_flight_duration(departureDateTime, arrivalDateTime, departureAirport, arrivalAirport):
    dep_naive = datetime.fromisoformat(departureDateTime)
    arr_naive = datetime.fromisoformat(arrivalDateTime)

    dep_tz = ZoneInfo(airports_data[departureAirport]['tz'])
    arr_tz = ZoneInfo(airports_data[arrivalAirport]['tz'])

    dep_time = dep_naive.replace(tzinfo=dep_tz)
    arr_time = arr_naive.replace(tzinfo=arr_tz)

    duration = arr_time.astimezone(ZoneInfo("UTC")) - dep_time.astimezone(ZoneInfo("UTC"))
    return duration.total_seconds() / 60


model_file_path = os.path.join(settings.BASE_DIR, 'flights', 'data', 'random_forest_model.joblib')
rf_loaded = load(model_file_path)

def predict(df_row):
    X_test = df_row
    cat_cols = X_test.select_dtypes(include=["object"]).columns
    num_cols = X_test.select_dtypes(exclude=["object"]).columns

    if len(cat_cols) > 0:
        enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        X_test[cat_cols] = enc.fit_transform(X_test[cat_cols])
        
    return rf_loaded.predict_proba(X_test)