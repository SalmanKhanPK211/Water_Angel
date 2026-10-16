import requests
import pandas as pd
from typing import List, Optional
from config import ML_GATEWAY_URL, HEADERS

def fetch_devices() -> List[str]:
    """
    Fetch all active paired device UUIDs from Supabase via ml-gateway.
    """
    url = f"{ML_GATEWAY_URL}/api/devices"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    payload = resp.json()
    devices = payload.get("devices", [])
    return [str(d) for d in devices if d]

def fetch_daily_usage(device_id: str, days: int = 365) -> pd.DataFrame:
    """
    Fetch historical daily water consumption for a single device.
    Columns returned: usage_date, liters_used, percent_used, readings_count, capacity_liters_snapshot.
    """
    url = f"{ML_GATEWAY_URL}/api/daily-usage/{device_id}?days={days}"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    data = resp.json().get("data", [])
    if not data:
        return pd.DataFrame()

    df = pd.DataFrame(data)
    df["usage_date"] = pd.to_datetime(df["usage_date"])
    df["liters_used"] = pd.to_numeric(df["liters_used"], errors="coerce")

    # Filter out empty or null rows
    df = df.dropna(subset=["usage_date", "liters_used"])

    # Filter out days where sensor was offline (< 5 readings recorded)
    if "readings_count" in df.columns:
        df["readings_count"] = pd.to_numeric(df["readings_count"], errors="coerce").fillna(0)
        df = df[df["readings_count"] >= 5]

    df = df.sort_values("usage_date").reset_index(drop=True)
    df["device_id"] = device_id
    return df

def fetch_all_historical_data(days: int = 365) -> pd.DataFrame:
    """
    Fetch combined historical usage across all registered devices.
    """
    devices = fetch_devices()
    all_dfs = []

    for dev_id in devices:
        try:
            df = fetch_daily_usage(dev_id, days=days)
            if not df.empty:
                all_dfs.append(df)
        except Exception as e:
            print(f"[DATA LOADER] Error fetching data for device {dev_id}: {e}")

    if all_dfs:
        return pd.concat(all_dfs, ignore_index=True)
    return pd.DataFrame()
