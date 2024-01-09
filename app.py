from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_caching import Cache
import requests
from datetime import datetime, timedelta
from collections import defaultdict
import os
from flask_apscheduler import APScheduler

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///weather_data.db'  # SQLite for demonstration
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Global variable to store current weather data
current_weather_data = None

# Scheduler for background tasks
scheduler = APScheduler()
scheduler.init_app(app)
scheduler.start()

# Configure Cache
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

# Database Model
class WeatherData(db.Model):
    ts = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.String(50), nullable=False)
    sensor_data = db.Column(db.JSON, nullable=False)

def init_db():
    with app.app_context():
        db.create_all()

init_db()  # Initialize the database

# Your API key and secret from WeatherLink
API_KEY = os.environ.get("API_KEY", "default_key")
API_SECRET = os.environ.get("API_SECRET", "default_secret")

# Base URL for the WeatherLink V2 API
API_URL = "https://api.weatherlink.com/v2/"

station_id_global = None

import time

def get_letourneau_station_id():
    global station_id_global
    if station_id_global:
        return station_id_global

    full_url = f"{API_URL}stations?api-key={API_KEY}"
    headers = {'x-api-secret': API_SECRET}

    max_retries = 8  # Max number of retries
    backoff_factor = 2  # Factor by which the delay increases
    initial_delay = 1  # Initial delay in seconds

    for attempt in range(1, max_retries + 1):
        try:
            print(f"Attempt {attempt}: Fetching LeTourneau station ID...")
            response = requests.get(full_url, headers=headers)
            response.raise_for_status()
            response_json = response.json()
            stations = response_json["stations"]

            for station in stations:
                if station['station_name'] == 'LeTourneau Civil Engineering Weather Station':
                    station_id_global = station['station_id']
                    print("Station ID found: ", station_id_global)
                    return station_id_global

            print("LeTourneau Civil Engineering Weather Station not found in response.")
            return None

        except requests.HTTPError as e:
            print(f"HTTP Error on attempt {attempt}: {e}")
        except Exception as e:
            print(f"An error occurred on attempt {attempt}: {e}")

        if attempt < max_retries:
            delay = initial_delay * (backoff_factor ** (attempt - 1))
            print(f"Retrying in {delay} seconds...")
            time.sleep(delay)

    print("Exceeded maximum retry attempts. Failed to fetch LeTourneau station ID.")
    return None

def fetch_current_weather():
    global current_weather_data
    station_id = get_letourneau_station_id()
    if not station_id:
        print("LeTourneau station ID not found")
        return

    full_url = f"{API_URL}current/{station_id}?api-key={API_KEY}"
    headers = {'x-api-secret': API_SECRET}

    try:
        response = requests.get(full_url, headers=headers)
        response.raise_for_status()

        # Extract the sensors data
        response_data = response.json()
        all_sensor_data = response_data.get('sensors', [])

        # Initialize an empty map to hold timestamp-keyed data
        ts_data_map = {}

        # Loop through each sensor's data and populate ts_data_map
        for sensor_group in all_sensor_data:
            for data_point in sensor_group.get('data', []):
                ts = data_point.get('ts')
                if ts in ts_data_map:
                    ts_data_map[ts].update(data_point)
                else:
                    ts_data_map[ts] = data_point.copy()

        # Convert the map to a list of dictionaries
        combined_data_list = list(ts_data_map.values())

        # Merge the contents from the second index into the first, prioritizing the first index
        if len(combined_data_list) > 1:
            combined_data_list[0] = {**combined_data_list[1], **combined_data_list[0]}

        # Set the current weather data with the merged first entry
        current_weather_data = {"data": [combined_data_list[0]]}

    except requests.HTTPError as e:
        print(f"HTTP Error: {e}")

    except Exception as e:
        print(f"An error occurred: {e}")

@app.route('/current', methods=['GET'])
def get_current():
    # Get the client IP address from the X-Forwarded-For header since I'm using a reverse-proxy.
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    print(f"Accessed /current from IP: {client_ip}", flush=True)
    if current_weather_data is None:
        return jsonify({"error": "Weather data not available"}), 503
    return jsonify(current_weather_data), 200

@app.route('/clear_database', methods=['GET'])
def clear_database():
    try:
        num_rows_deleted = db.session.query(WeatherData).delete()
        db.session.commit()
        return jsonify({"message": f"Successfully deleted {num_rows_deleted} rows"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"An error occurred: {e}"}), 400

def get_missing_time_ranges(station_id, start_timestamp, end_timestamp):
    existing_entries = WeatherData.query.filter(
        WeatherData.station_id == station_id,
        WeatherData.ts >= start_timestamp - 450,
        WeatherData.ts <= end_timestamp + 450
    ).order_by(WeatherData.ts).all()
    
    existing_timestamps = {entry.ts for entry in existing_entries}
    
    missing_ranges = []
    current_start = None
    
    # Loop over the entire range with 15-minute intervals (900 seconds)
    for ts in range(start_timestamp, end_timestamp + 1, 900):
        # Check if any existing timestamp falls within the range of ±450 seconds around the expected timestamp
        if not any((ts - 450 <= existing_ts <= ts + 450) for existing_ts in existing_timestamps):
            if current_start is None:
                current_start = ts
        else:
            if current_start is not None:
                missing_ranges.append((current_start, ts - 900))  # Subtract 900 to avoid overlapping with the existing entry
                current_start = None
                
    if current_start is not None:
        missing_ranges.append((current_start, end_timestamp))
    
    return missing_ranges

def fetch_historic_data(station_id, start_timestamp, end_timestamp):
    full_url = f"{API_URL}historic/{station_id}?api-key={API_KEY}&start-timestamp={start_timestamp}&end-timestamp={end_timestamp}"
    headers = {'x-api-secret': API_SECRET}
    
    response = requests.get(full_url, headers=headers)
    if response.status_code == 200:
        return response.json().get("sensors", [])
    else:
        return None
    
def fetch_historic_data_for_range(station_id, start_timestamp, end_timestamp):
    station_id = get_letourneau_station_id()
    if not station_id:
        return jsonify({"error": "LeTourneau station ID not found"}), 400
    # Placeholder for the final accumulated data
    all_sensor_data = []
    
    # Split the time range into 24-hour blocks
    current_start = start_timestamp
    one_day_in_seconds = 24 * 60 * 60
    
    while current_start < end_timestamp:
        current_end = min(current_start + one_day_in_seconds, end_timestamp)
        print("fetching datas!")
        # Fetch and accumulate data for the current 24-hour block
        sensor_data_list = fetch_historic_data(station_id, current_start, current_end)
        
        if sensor_data_list:
            all_sensor_data.extend(sensor_data_list)
        
        current_start = current_end
    
    return all_sensor_data

@app.route('/historic', methods=['GET'])
@cache.cached(timeout=300)
def get_historic():
    # Get the client IP address from the X-Forwarded-For header
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    print(f"Accessed /historic from IP: {client_ip}", flush=True)

    station_id = get_letourneau_station_id()
    if not station_id:
        return jsonify({"error": "LeTourneau station ID not found"}), 400
    
    
    try:
        start_timestamp = int(request.args.get('start-timestamp', default=(datetime.utcnow() - timedelta(hours=24*7)).timestamp()))
        end_timestamp = int(request.args.get('end-timestamp', default=datetime.utcnow().timestamp()))
    except (ValueError, TypeError):
        app.logger.warning('Warning! No valid timestamp provided.')
        return jsonify({"error": "start-timestamp and end-timestamp must be integers"}), 400

    print(f"Received Start Timestamp: {start_timestamp}, End Timestamp: {end_timestamp}")  # New line

    # Check if the requested range exceeds one month
    one_day_in_seconds = 24 * 60 * 60  # 24 hours in seconds
    one_month_in_seconds = 30 * one_day_in_seconds  # Approximately one month in seconds
    if end_timestamp - start_timestamp > one_month_in_seconds:
        return jsonify({"message": "Error: Time range exceeds 30 days. Please request a shorter range."}), 400

    # Step 1: Identify missing ranges and fetch them from the API
    missing_ranges = get_missing_time_ranges(station_id, start_timestamp, end_timestamp)

    all_sensor_data = []
    new_entries_count = 0  # Counter for new database entries

    for start, end in missing_ranges:
        if end - start > one_day_in_seconds:
            current_start = start
            while current_start < end:
                print("multi-entry")
                current_end = min(current_start + one_day_in_seconds, end)
                fetched_data = fetch_historic_data(station_id, current_start, current_end)
                if fetched_data:
                    all_sensor_data.extend(fetched_data)
                current_start = current_end
        else:
            print("single entry")
            fetched_data = fetch_historic_data(station_id, start, end)
            if fetched_data:
                all_sensor_data.extend(fetched_data)

    # Accumulate and store the new data
    ts_data_map = {}
    for sensor_group in all_sensor_data:
        for data_point in sensor_group.get('data', []):
            ts = data_point.get('ts')
            if ts in ts_data_map:
                ts_data_map[ts].update(data_point)
            else:
                ts_data_map[ts] = data_point.copy()

    for ts, accumulated_data in ts_data_map.items():
        existing_entry = WeatherData.query.filter_by(ts=ts, station_id=station_id).first()
        if not existing_entry:
            new_entry = WeatherData(ts=ts, station_id=station_id, sensor_data=accumulated_data)
            db.session.add(new_entry)
            new_entries_count += 1

    db.session.commit()

    # Step 2: Retrieve the entire range from the database
    stored_data = WeatherData.query.filter(
        WeatherData.ts >= start_timestamp,
        WeatherData.ts <= end_timestamp,
        WeatherData.station_id == station_id
    ).all()

    response_data = [entry.sensor_data for entry in stored_data]

    return jsonify({
        "message": f"Successfully retrieved WeatherLink API data. Added {new_entries_count} new entries.",
        "data": response_data
    }), 200

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

# Background task to fetch weather data every 5 minutes plus 30 seconds
@scheduler.task('cron', id='fetch_weather', minute='0,5,10,15,20,25,30,35,40,45,50,55', second=30)
def scheduled_fetch_weather():
    fetch_current_weather()

if __name__ == '__main__':
    fetch_current_weather()  # Initial fetch
    app.run(host='0.0.0.0', port=5000)
