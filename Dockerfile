FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY config/ ./config/
RUN pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "carbonshift.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
