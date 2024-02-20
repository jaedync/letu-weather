
# LETU Civil Weather Dashboard for FENNEC

![example screenshot](/images/Screenshot2024-01-21.png)

## Description
The *Flow Civil Engineering Senior Design* team has a high quality Davis Instruments weather station on *LeTourneau's* campus. The *FENNEC 2023/24 Senior Design* team needed a convenient way to retrieve and monitor historical and live weather data. This was the solution.

The LETU Civil Weather Dashboard is a web application designed to display real-time and historic weather data. Developed with Flask for the backend and JavaScript for the frontend, it offers various visualizations for weather metrics such as temperature, humidity, wind speed, and more. Data is fetched from the WeatherLink API, and cached to void rate-limiting issues. This allows an arbitrary number of clients to use our new keyless API without issue.

## Features
- Real-time weather data display
- Historic weather data visualization
- Dynamic chart rendering using Plotly
- Responsive design for desktop and mobile viewing
- Accessible Keyless API for extensible application use

## Installation

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)
- Docker (optional, for containerization)
- Docker Compose (optional, for easy environment management and deployment)

### Setup
1. **Clone the Repository**
   ```bash
   git clone https://github.com/jaedync/letu-weather.git
   cd letu-weather
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**
   Create a `.env` file in the root directory and set the following variables:
   ```
   API_KEY=your_weatherlink_api_key
   API_SECRET=your_weatherlink_api_secret
   ```
   Replace `your_weatherlink_api_key` and `your_weatherlink_api_secret` with your actual WeatherLink API credentials.

### Using Docker
1. **Build the Docker Image**
   ```bash
   docker build -t letu-weather .
   ```

2. **Run the Docker Container**
   ```bash
   docker run -p 5000:5000 -e API_KEY=your_api_key -e API_SECRET=your_api_secret letu-weather
   ```
   Replace `your_api_key` and `your_api_secret` with your actual API credentials.

### Using Docker Compose
1. **Create a Docker Compose File**
   Create a `docker-compose.yml` file with the following content:
   ```yaml
   version: '3.8'
   services:
     web:
       build: .
       ports:
         - "5000:5000"
       env_file:
         - .env
   ```

2. **Start the Application**
   ```bash
   docker-compose up -d
   ```

## Usage
After starting the application, navigate to `http://localhost:5000` in your web browser to view the dashboard.

## License
[MIT License](LICENSE)

## Contact
For any queries or suggestions, please contact [me@jaedynchilton.com](mailto:me@jaedynchilton.com).
