# FROM python:3.10-slim

# WORKDIR /app

# # Install system dependencies for OpenCV
# RUN apt-get update && apt-get install -y \
#     libgl1-mesa-glx \
#     libglib2.0-0 \
#     && apt-get clean \
#     && rm -rf /var/lib/apt/lists/*

# # Copy requirements first to leverage Docker cache
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy the application code
# COPY . /app/

# # Command to run the application
# CMD ["python", "app.py"]

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for building packages
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first for better layer caching
COPY requirements.txt .

# Then install the rest of the requirements
# RUN pip install --no-cache-dir --prefer-binary -r requirements.txt
RUN pip install --prefer-binary -r requirements.txt

# Copy application code
COPY . .

# Expose the port your application runs on
EXPOSE 8000

# Run the application
# CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
# CMD ["fastapi", "run", "app.py"]
CMD ["python", "app.py"]
