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

FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .

# Try to use pre-built wheels when possible
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy the rest of your application
COPY . .

# Command to run the application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]