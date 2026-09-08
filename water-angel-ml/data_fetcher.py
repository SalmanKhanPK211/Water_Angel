import requests
import pandas as pd
from config import ML_GATEWAY_URL, HEADERS

def fetch_daily_usage(device_id: str, days: int = 90) -> pd.DataFrame:
    """
    Fetch historical daily usage for a single device via Lovable Gateway.
    Returns DataFrame with columns: usage_date, liters_used, (optional) readings_count.
    """
    url = f"{ML_GATEWAY_URL}/api/daily-usage/{device_id}?days={days}"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    
    data = resp.json().get("data", [])
    if not data:
        return pd.DataFrame()
    
    df = pd.DataFrame(data)
    df['usage_date'] = pd.to_datetime(df['usage_date'])
    
    # Filter out days with less than 5 readings (sensor offline)
    if 'readings_count' in df.columns:
        df = df[df['readings_count'] >= 5]
    
    return df

def fetch_all_devices() -> list:
    """
    Fetch all device IDs for the authenticated user via Lovable Gateway.
    Returns list of UUID strings.
    """
    url = f"{ML_GATEWAY_URL}/api/devices"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    
    return resp.json().get("devices", [])

def fetch_all_historical_data(days: int = 90) -> pd.DataFrame:
    """
    Fetch historical data for ALL devices and combine into one DataFrame.
    Each row includes 'device_id' for grouping.
    """
    devices = fetch_all_devices()
    all_data = []
    
    for dev_id in devices:
        df = fetch_daily_usage(dev_id, days)
        if not df.empty:
            df['device_id'] = dev_id
            all_data.append(df)
    
    if all_data:
        return pd.concat(all_data, ignore_index=True)
    return pd.DataFrame()